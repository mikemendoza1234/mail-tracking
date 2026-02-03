import { query } from '../db.js';
import { requireAuth } from '../auth/index.js';

export default async function emailRoutes(fastify, options) {
    fastify.addHook('preHandler', requireAuth);

    // List emails for organization
    fastify.get('/', async (request, reply) => {
        const { orgId } = request.user;
        const res = await query(
            `SELECT * FROM emails 
             WHERE organization_id = $1 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [orgId]
        );
        return res.rows;
    });

    // Get specific email
    fastify.get('/:id', async (request, reply) => {
        const { orgId } = request.user;
        const { id } = request.params;

        const res = await query(
            `SELECT * FROM emails 
             WHERE id = $1 AND organization_id = $2`,
            [id, orgId]
        );

        if (res.rows.length === 0) {
            return reply.code(404).send({ error: 'Email not found' });
        }

        return res.rows[0];
    });

    // Create email
    fastify.post('/', {
        schema: {
            body: {
                type: 'object',
                required: ['subject', 'bodyHtml'],
                properties: {
                    subject: { type: 'string' },
                    bodyHtml: { type: 'string' },
                    bodyText: { type: 'string' },
                    contactId: { type: 'string' },
                    fromEmail: { type: 'string' },
                    fromName: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { orgId } = request.user;
        const { subject, bodyHtml, bodyText, contactId, fromEmail, fromName } = request.body;

        // Generate tracking pixel URL
        // Warning: config.baseUrl/process.env.API_URL needs to be robust
        const baseUrl = process.env.API_URL || 'http://localhost:3000';

        // We can't generate the full pixel URL without the email ID first if following /o/:orgId/:emailId approach
        // So allow inserting first, then updating, or calculate ID if UUID (can gen UUID in app)
        // Let's rely on DB generation for ID

        const res = await query(
            `INSERT INTO emails 
             (organization_id, contact_id, subject, body_html, body_text, from_email, from_name) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING id, created_at`,
            [
                orgId,
                contactId,
                subject,
                bodyHtml,
                bodyText || '',
                fromEmail,
                fromName || ''
            ]
        );

        const email = res.rows[0];
        const trackingPixelUrl = `${baseUrl}/o/${orgId}/${email.id}.png`;

        await query('UPDATE emails SET tracking_pixel_url = $1 WHERE id = $2', [trackingPixelUrl, email.id]);

        return { ...email, tracking_pixel_url: trackingPixelUrl };
    });
}
