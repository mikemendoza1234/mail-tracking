import { Worker } from 'bullmq';
import { connection, workflowQueue } from './queue/index.js';
import { query } from './db.js';
import { emailService } from './services/emailService.js';
import { workflowService } from './services/workflowService.js';
import { render } from './utils/templateRenderer.js';

// Helper to fetch contact
async function getContact(contactId) {
    const res = await query('SELECT * FROM contacts WHERE id = $1', [contactId]);
    return res.rows[0];
}

const processors = {
    email: async (node, execution, context) => {
        console.log(`[Worker] Processing Email Node: ${node.id}`);
        const contact = await getContact(execution.contact_id);
        if (!contact) throw new Error('Contact not found');

        // Render content
        const subject = render(node.config.subject, { ...contact, ...execution.data });
        const body = render(node.config.template || 'Default Template', { ...contact, ...execution.data }); // Simplified template logic

        // Send Email
        const result = await emailService.sendEmail({
            organizationId: execution.organization_id,
            contactId: execution.contact_id,
            email: contact.email,
            subject,
            bodyHtml: body,
            workflowExecutionId: execution.id
        });

        return { status: 'sent', emailId: result.emailId };
    },

    wait: async (node, execution) => {
        // The existence of this job means the wait is starting. 
        // We calculate the duration and return it so the main loop schedules the next job with delay.
        const days = node.config.days || 0;
        const hours = node.config.hours || 0;
        const delayMs = (days * 24 * 60 * 60 * 1000) + (hours * 60 * 60 * 1000);

        console.log(`[Worker] Wait Node: ${node.id}, Delay: ${delayMs}ms`);
        return { status: 'waiting', requestedDelay: delayMs };
    },

    condition: async (node, execution) => {
        console.log(`[Worker] Condition Node: ${node.id}`);
        const isTrue = await workflowService.evaluateCondition(
            execution.organization_id,
            execution.contact_id,
            node.config
        );

        const branch = isTrue ? 'true' : 'false';
        console.log(`[Worker] Condition result: ${branch}`);
        return { status: 'evaluated', branch };
    }
};

const worker = new Worker('workflow-queue', async (job) => {
    const { executionId, nodeId } = job.data;
    console.log(`[Worker] Starting Job: Exec ${executionId}, Node ${nodeId}`);

    try {
        // 1. Fetch Execution & Workflow
        const execRes = await query(
            `SELECT e.*, w.nodes 
             FROM workflow_executions e 
             JOIN workflows w ON e.workflow_id = w.id 
             WHERE e.id = $1`,
            [executionId]
        );

        if (execRes.rows.length === 0) {
            console.error(`[Worker] Execution ${executionId} not found`);
            return;
        }
        const execution = execRes.rows[0];
        const nodes = execution.nodes || [];

        // 2. Find Current Node
        const nodeDef = nodes.find(n => n.id === nodeId);
        if (!nodeDef) {
            console.log(`[Worker] Node ${nodeId} not found or flow ended.`);
            await query("UPDATE workflow_executions SET status = 'completed', completed_at = NOW() WHERE id = $1", [executionId]);
            return;
        }

        // 3. Update Status to Running Node
        await query(
            'UPDATE workflow_executions SET current_node = $1, current_node_type = $2, updated_at = NOW() WHERE id = $3',
            [nodeId, nodeDef.type, executionId]
        );

        // 4. Process Node
        const processor = processors[nodeDef.type];
        let result = {};
        let requestedDelay = 0;

        if (processor) {
            result = await processor(nodeDef, execution);
            if (result.requestedDelay) {
                requestedDelay = result.requestedDelay;
            }
        } else {
            console.warn(`[Worker] Unknown node type: ${nodeDef.type}`);
        }

        // 5. Determine Next Node
        let nextNodeId = null;

        if (nodeDef.type === 'condition') {
            const branch = result.branch || 'false';
            nextNodeId = nodeDef.branches?.[branch];
        } else {
            // Sequential: find current index and get next
            const idx = nodes.findIndex(n => n.id === nodeId);
            if (idx >= 0 && idx < nodes.length - 1) {
                nextNodeId = nodes[idx + 1].id;
            }
        }

        // 6. Special Handling for WAIT nodes acting as delays for the NEXT node
        // If the current node was a 'wait' node, `requestedDelay` is set.
        // We schedule the NEXT node with that delay.

        // Update Execution Data
        await query(
            'UPDATE workflow_executions SET data = $1 WHERE id = $2',
            [{ ...execution.data, [nodeId]: result }, executionId]
        );

        // 7. Schedule Next Job via Queue
        if (nextNodeId) {
            console.log(`[Worker] Scheduling next node: ${nextNodeId}, Delay: ${requestedDelay}ms`);

            // If wait node, we update status to 'waiting'
            if (requestedDelay > 0) {
                await query("UPDATE workflow_executions SET status = 'waiting' WHERE id = $1", [executionId]);
            }

            await workflowQueue.add(
                'execute-node',
                { executionId, nodeId: nextNodeId },
                { delay: requestedDelay }
            );
        } else {
            console.log(`[Worker] No next node. Workflow completed.`);
            await query("UPDATE workflow_executions SET status = 'completed', completed_at = NOW() WHERE id = $1", [executionId]);
        }

    } catch (err) {
        console.error(`[Worker] Job Failed: ${err.message}`, err);
        await query(
            "UPDATE workflow_executions SET status = 'failed', error_message = $1 WHERE id = $2",
            [err.message, executionId]
        );
        throw err; // Retry logic in BullMQ
    }
}, {
    connection,
    concurrency: 5
});

console.log('Worker started and listening for jobs...');
