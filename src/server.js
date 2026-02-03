import Fastify from 'fastify';
import pixelRoute from './routes/pixel.js';

export async function buildServer() {
    const fastify = Fastify({
        logger: true
    });

    // Register routes
    fastify.register(pixelRoute);

    // Health check
    fastify.get('/health', async () => {
        return { status: 'ok' };
    });

    return fastify;
}
