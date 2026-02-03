import { query } from '../db.js';

// 1x1 transparent PNG
const TRANSPARENT_PIXEL = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d040000000049454e44ae426082',
    'hex'
);

export default async function pixelRoute(fastify, options) {
    fastify.get('/o/:emailId.png', async (request, reply) => {
        const { emailId } = request.params;

        // Log the event asynchronously (fire-and-forget style for speed, 
        // or await if data integrity is critical. Requirement: "must log event". 
        // I will await to be safe, but catch errors to ensure pixel is always returned)
        try {
            const id = parseInt(emailId);
            if (!isNaN(id)) {
                await query(
                    'INSERT INTO events (email_id, type) VALUES ($1, $2)',
                    [id, 'email_opened']
                );
                request.log.info({ emailId: id }, 'Logged email_opened event');
            } else {
                request.log.warn({ emailId }, 'Invalid emailId for tracking');
            }
        } catch (err) {
            // Log error but still return the pixel so the user experience isn't broken
            request.log.error(err, 'Failed to log email open event');
        }

        // Return transparent pixel
        reply
            .header('Content-Type', 'image/png')
            .header('Cache-Control', 'no-cache, no-store, must-revalidate')
            .header('Pragma', 'no-cache')
            .header('Expires', '0')
            .send(TRANSPARENT_PIXEL);
    });
}
