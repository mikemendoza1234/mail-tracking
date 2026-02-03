import { query } from '../db.js';
import { requireAuth } from '../auth/index.js';

export default async function contactRoutes(fastify, options) {

    // Protect all routes
    fastify.addHook('preHandler', requireAuth);

    // GET /contacts
    fastify.get('/', async (request, reply) => {
        const { orgId } = request.user;
        const { limit = 50, offset = 0 } = request.query;

        const res = await query(
            'SELECT * FROM contacts WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [orgId, limit, offset]
        );
        return res.rows;
    });

    // POST /contacts
    fastify.post('/', async (request, reply) => {
        const { orgId } = request.user;
        const { email, firstName, lastName, metadata } = request.body;

        if (!email) {
            return reply.code(400).send({ error: 'Email is required' });
        }

        try {
            const res = await query(
                `INSERT INTO contacts (organization_id, email, first_name, last_name, metadata) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (organization_id, email) DO UPDATE SET 
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                metadata = contacts.metadata || EXCLUDED.metadata
             RETURNING id, email, created_at`,
                [orgId, email, firstName, lastName, metadata || {}]
            );
            return res.rows[0];
        } catch (err) {
            request.log.error(err);
            return reply.code(500).send({ error: 'Failed to create contact' });
        }
    });
}
