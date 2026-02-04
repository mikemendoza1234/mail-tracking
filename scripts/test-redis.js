#!/usr/bin/env node
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar environment based on NODE_ENV, default to .env.production for this test context if NODE_ENV=production
if (process.env.NODE_ENV === 'production') {
    dotenv.config({ path: join(__dirname, '..', '.env.production') });
} else {
    dotenv.config({ path: join(__dirname, '..', '.env') });
}


console.log('🔍 Testing Redis Connection for BullMQ\n');

async function testRedisConnection() {
    console.log('Redis URL:', process.env.REDIS_URL ? 'Set (hidden)' : 'Not set');

    if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
        console.log('❌ REDIS_URL not set in production');
        return false;
    }

    // Configuración compatible con BullMQ
    let redisConfig;
    if (process.env.REDIS_URL) {
        const url = new URL(process.env.REDIS_URL);
        redisConfig = {
            host: url.hostname,
            port: parseInt(url.port),
            username: url.username || undefined,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
            maxRetriesPerRequest: null, // BullMQ requirement
            enableReadyCheck: false,
            retryDelayOnFailover: 1000,
            lazyConnect: true
        };
    } else {
        redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            maxRetriesPerRequest: null, // BullMQ requirement
            enableReadyCheck: false
        };
    }

    console.log('Redis Config:', {
        host: redisConfig.host,
        port: redisConfig.port,
        tls: !!redisConfig.tls,
        maxRetriesPerRequest: redisConfig.maxRetriesPerRequest
    });

    const redis = new IORedis(redisConfig);

    try {
        // Test básico
        await redis.connect();
        console.log('✅ Connected to Redis');

        // Ping
        const pong = await redis.ping();
        console.log(`🧪 Ping response: ${pong}`);

        // Info
        const info = await redis.info();
        const versionLine = info.split('\n').find(l => l.startsWith('redis_version'));
        console.log(`📊 Redis version: ${versionLine ? versionLine.split(':')[1] : 'unknown'}`);

        // Test de escritura/lectura
        await redis.set('bullmq_test', Date.now());
        const testValue = await redis.get('bullmq_test');
        console.log(`📝 Test set/get: ${testValue ? 'OK' : 'Failed'}`);

        // Test de lista (usado por BullMQ)
        await redis.lpush('bullmq_test_queue', 'test_item');
        const item = await redis.rpop('bullmq_test_queue');
        console.log(`📋 List operations: ${item === 'test_item' ? 'OK' : 'Failed'}`);

        // Limpiar
        await redis.del('bullmq_test');

        await redis.quit();
        console.log('\n🎉 Redis connection test passed! Ready for BullMQ.');
        return true;

    } catch (error) {
        console.error('❌ Redis connection test failed:', error.message);
        console.error('Error details:', error);
        return false;
    }
}

testRedisConnection().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
