import { query } from '../db.js';

// 1x1 transparent PNG
const TRANSPARENT_PIXEL = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d040000000049454e44ae426082',
    'hex'
);

export default async function trackingRoutes(fastify, options) {

    // New Pixel with Org support
    // GET /o/:orgId/:emailId.png
    fastify.get('/o/:orgId/:emailId.png', async (request, reply) => {
        const { orgId, emailId } = request.params;
        const { contactId } = request.query; // Optional: track specific contact if provided

        // TODO: Validate UUIDs to prevent SQL injection if using raw query without parameterization properly
        // Postgre's uuid type validation happens at DB level usually, but good to be safe.

        // Log event
        try {
            // Fire and forget, or queue
            // For simplicity: direct insert
            await query(
                'INSERT INTO events (organization_id, email_id, type) VALUES ($1, $2, $3)',
                [orgId, emailId || null, 'email_opened']
                // Note: emailId can be null if generic pixel? Usually email_id points to specific campaign email row.
                // If emailId is strictly integer as per old schema, we might have issues if we switch to UUIDs everywhere.
                // For this implementation, we assume Email ID comes from the emails table.
            );

            // Check triggers for workflows (TODO: enqueue job)
        } catch (err) {
            request.log.error(err, 'Tracking error');
        }

        reply
            .header('Content-Type', 'image/png')
            .header('Cache-Control', 'no-cache, no-store, must-revalidate')
            .send(TRANSPARENT_PIXEL);
    });

    // Click Tracking
    // GET /c/:orgId/:emailId/:encodedUrl
    fastify.get('/c/:orgId/:emailId/:encodedUrl', async (request, reply) => {
        const { orgId, emailId, encodedUrl } = request.params;
        const { contactId } = request.query;

        let destination = 'http://example.com';
        try {
            destination = Buffer.from(encodedUrl, 'base64').toString('utf-8');

            // Log click
            await query(
                'INSERT INTO click_events (organization_id, email_id, contact_id, url) VALUES ($1, $2, $3, $4)',
                [orgId, emailId || null, contactId || null, destination]
            );

        } catch (err) {
            request.log.error(err, 'Click tracking error');
        }

        // Redirect
        return reply.redirect(destination);
    });
}
