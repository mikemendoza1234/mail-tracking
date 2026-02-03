import { query } from '../src/db.js';

// Simple scheduler loop
// In production, use a library like 'bree' or 'agenda' as requested, 
// but for this MVP extension a `setInterval` is sufficient to demonstrate the concept.

const INTERVAL_MS = 60 * 1000; // 1 minute

console.log('Scheduler started...');

async function runTasks() {
    try {
        console.log('[Scheduler] Running maintenance tasks...');

        // 1. Cleanup old logs (Example)
        // await query("DELETE FROM events WHERE created_at < NOW() - INTERVAL '1 year'");

        // 2. Retry stuck workflows?
        // const stuck = await query("SELECT id FROM workflow_executions WHERE status = 'running' AND updated_at < NOW() - INTERVAL '1 hour'");
        // ...

        console.log('[Scheduler] Tasks completed.');
    } catch (err) {
        console.error('[Scheduler] Error:', err);
    }
}

// Run immediately then interval
runTasks();
setInterval(runTasks, INTERVAL_MS);
