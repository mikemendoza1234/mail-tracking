import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { db } from './database/db.js';
import { emailService } from './services/emailService.js';
import { workflowService } from './services/workflowService.js';
import { render } from './utils/templateRenderer.js';

// Configurar conexión Redis compatible con BullMQ
function createRedisConnection() {
    if (process.env.REDIS_URL) {
        // Parse URL para Upstash
        const url = new URL(process.env.REDIS_URL);

        return new IORedis({
            host: url.hostname,
            port: parseInt(url.port),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {
                rejectUnauthorized: false
            } : undefined,
            maxRetriesPerRequest: null, // REQUIRED for BullMQ
            enableReadyCheck: false,    // Disable for better compatibility
            retryDelayOnFailover: 1000,
            retryDelayOnTryAgain: 1000,
            lazyConnect: true
        });
    }

    // Fallback a local Redis
    return new IORedis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        maxRetriesPerRequest: null, // REQUIRED for BullMQ
        enableReadyCheck: false
    });
}

const connection = createRedisConnection();

// Crear cola
export const workflowQueue = new Queue('workflows', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: 100, // Mantener últimos 100 jobs completados
        removeOnFail: 50       // Mantener últimos 50 jobs fallados
    }
});

// Helper to fetch contact
async function getContact(contactId) {
    const res = await db.query('SELECT * FROM contacts WHERE id = $1', [contactId]);
    return res.rows[0];
}

const processors = {
    email: async (node, execution, context) => {
        console.log(`[Worker] Processing Email Node: ${node.id}`);
        const contact = await getContact(execution.contact_id);
        if (!contact) throw new Error('Contact not found');

        // Render content
        const subject = render(node.config.subject, { ...contact, ...execution.data });
        const body = render(node.config.template || 'Default Template', { ...contact, ...execution.data });

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

// Crear worker
const worker = new Worker('workflows', async (job) => {
    // Support both job structures for backward compatibility if needed, but primary is execute-node
    const { executionId, nodeId } = job.data;
    console.log(`🔧 Processing job ${job.id}: ${job.name} (Exec: ${executionId}, Node: ${nodeId})`);

    try {
        // 1. Fetch Execution & Workflow
        const execRes = await db.query(
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
            await db.query("UPDATE workflow_executions SET status = 'completed', completed_at = NOW() WHERE id = $1", [executionId]);
            return;
        }

        // 3. Update Status to Running Node
        await db.query(
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

        // 6. Update Execution Data
        await db.query(
            'UPDATE workflow_executions SET data = $1 WHERE id = $2',
            [{ ...execution.data, [nodeId]: result }, executionId]
        );

        // 7. Schedule Next Job via Queue
        if (nextNodeId) {
            console.log(`[Worker] Scheduling next node: ${nextNodeId}, Delay: ${requestedDelay}ms`);

            // If wait node, we update status to 'waiting'
            if (requestedDelay > 0) {
                await db.query("UPDATE workflow_executions SET status = 'waiting' WHERE id = $1", [executionId]);
            }

            // We use the exported workflowQueue
            await workflowQueue.add(
                'execute-node',
                { executionId, nodeId: nextNodeId },
                { delay: requestedDelay }
            );
        } else {
            console.log(`[Worker] No next node. Workflow completed.`);
            await db.query("UPDATE workflow_executions SET status = 'completed', completed_at = NOW() WHERE id = $1", [executionId]);
        }

        await job.updateProgress(100);
        console.log(`✅ Job ${job.id} completed successfully`);

    } catch (error) {
        console.error(`❌ Job ${job.id} failed:`, error);
        await db.query(
            "UPDATE workflow_executions SET status = 'failed', error_message = $1 WHERE id = $2",
            [error.message, executionId]
        );
        throw error; // BullMQ manejará el reintento
    }
}, {
    connection,
    concurrency: process.env.WORKER_CONCURRENCY || 5,
    limiter: {
        max: 10,    // Máximo 10 jobs por segundo
        duration: 1000
    }
});

// Event handlers
worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
});

worker.on('error', (err) => {
    console.error('❌ Worker error:', err);
});

// Inicialización
console.log('🚀 Workflow Worker Started');
console.log(`📊 Redis: ${process.env.REDIS_URL ? 'Upstash (Production)' : 'Local'}`);
console.log(`👷 Concurrency: ${worker.opts.concurrency}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down worker gracefully...');
    await worker.close();
    await connection.quit();
    console.log('✅ Worker shutdown complete');
    process.exit(0);
});
