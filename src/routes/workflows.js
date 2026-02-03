import { query } from '../db.js';
import { requireAuth } from '../auth/index.js';

export default async function workflowRoutes(fastify, options) {
    fastify.addHook('preHandler', requireAuth);

    // CREATE Workflow
    fastify.post('/', async (request, reply) => {
        const { orgId } = request.user;
        const { name, description, triggerType, trigger_type, triggerConfig, trigger_config, nodes, is_active } = request.body;

        // Normalize inputs
        const finalTriggerType = triggerType || trigger_type;
        const finalTriggerConfig = triggerConfig || trigger_config || {};
        const finalIsActive = is_active !== false; // Default true

        // Validate required
        if (!name) return reply.code(400).send({ error: 'Missing name' });
        if (!finalTriggerType) return reply.code(400).send({ error: 'Missing triggerType' });

        try {
            const res = await query(
                `INSERT INTO workflows (organization_id, name, trigger_type, trigger_config, nodes) 
                 VALUES ($1, $2, $3, $4, $5) 
                 RETURNING id`,
                [
                    orgId,
                    name,
                    finalTriggerType,
                    finalTriggerConfig,
                    JSON.stringify(nodes || [])
                ]
            );
            return res.rows[0];
        } catch (err) {
            request.log.error(err);
            // Return actual error for debugging
            return reply.code(500).send({
                error: 'Failed to create workflow',
                details: err.message,
                code: err.code
            });
        }
    });

    // TRIGGER Workflow (Manual/API trigger)
    // POST /api/workflows/:id/trigger
    fastify.post('/:id/trigger', async (request, reply) => {
        const { orgId } = request.user;
        const { id } = request.params;
        const { contactId, data } = request.body;

        // 1. Verify workflow belongs to org
        const wfRes = await query('SELECT * FROM workflows WHERE id = $1 AND organization_id = $2', [id, orgId]);
        if (wfRes.rows.length === 0) {
            return reply.code(404).send({ error: 'Workflow not found' });
        }
        const workflow = wfRes.rows[0];

        // 2. Create Execution
        // Ideally we verify contact exists
        const execRes = await query(
            `INSERT INTO workflow_executions (workflow_id, contact_id, status, data, current_node)
         VALUES ($1, $2, 'running', $3, $4) RETURNING id`,
            [id, contactId, data || {}, workflow.nodes[0]?.id || 'end']
        );

        // 3. Enqueue Job in BullMQ (Simplification: just log for now)
        // In real implementation: workflowQueue.add('execute-node', { executionId: ... })
        request.log.info({ executionId: execRes.rows[0].id }, 'Workflow triggered');

        return { executionId: execRes.rows[0].id, status: 'started' };
    });
}
