import config from './config.js';
import { buildServer } from './server.js';
import pool from './db.js';

const start = async () => {
    const fastify = await buildServer();
    const PORT = config.port;

    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Server listening on port ${PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
        process.on(signal, async () => {
            console.log(`Received ${signal}, shutting down...`);
            await fastify.close();
            await pool.end();
            process.exit(0);
        });
    });
};

start();
