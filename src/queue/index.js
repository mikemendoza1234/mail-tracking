import { Queue, Worker } from 'bullmq';
import config from '../config.js';
import IORedis from 'ioredis';

const connection = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
});

export const workflowQueue = new Queue('workflow-queue', { connection });

async function processNode(job) {
    const { executionId, nodeId } = job.data;
    console.log(`Processing execution ${executionId} at node ${nodeId}`);

    // Logic to be implemented in worker.js or here if small.
    // Ideally we import the processor logic to keep this file clean.
    // For now we just return mock success.
    return { status: 'processed', nodeId };
}

// We export the connection for reuse if needed
export { connection };
