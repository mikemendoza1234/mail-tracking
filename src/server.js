import Fastify from 'fastify';
import pixelRoute from './routes/pixel.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import trackingRoutes from './routes/tracking.js';
import workflowRoutes from './routes/workflows.js';
import emailRoutes from './routes/emails.js';

export async function buildServer() {
    const fastify = Fastify({
        logger: true
    });

    // Health check endpoint
    fastify.get('/health', async (request, reply) => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Register routes
    fastify.register(pixelRoute); // Legacy
    fastify.register(trackingRoutes); // New tracking /o/:orgId/...
    fastify.register(authRoutes, { prefix: '/api/auth' });
    fastify.register(contactRoutes, { prefix: '/api/contacts' });
    fastify.register(workflowRoutes, { prefix: '/api/workflows' });
    fastify.register(emailRoutes, { prefix: '/api/emails' });

    return fastify;
}
