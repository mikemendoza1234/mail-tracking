import { query } from './database/db.js';
import { workflowQueue } from './worker.js';

export async function healthCheck() {
    const checks = {
        database: false,
        redis: false,
        uptime: process.uptime()
    };

    try {
        // Check database
        await query('SELECT 1');
        checks.database = true;
    } catch (error) {
        checks.database_error = error.message;
    }

    try {
        // Check Redis
        await workflowQueue.client.ping();
        checks.redis = true;
    } catch (error) {
        checks.redis_error = error.message;
    }

    return {
        status: checks.database && checks.redis ? 'healthy' : 'degraded',
        checks,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    };
}
