#!/usr/bin/env node
import pg from 'pg';
import Redis from 'ioredis';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Checking Production Connections\n');

async function checkPostgreSQL() {
    console.log('1. Testing PostgreSQL (Supabase)...');

    const connectionString = process.env.DATABASE_URL ||
        `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

    const client = new pg.Client({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000
    });

    try {
        await client.connect();
        console.log('   ✅ Connected to PostgreSQL');

        // Check version
        const versionResult = await client.query('SELECT version()');
        console.log(`   📊 PostgreSQL Version: ${versionResult.rows[0].version.split(' ')[1]}`);

        // Check tables
        const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

        console.log(`   📋 Tables found: ${tablesResult.rows.length}`);
        if (tablesResult.rows.length > 0) {
            console.log('   📝 Tables:', tablesResult.rows.map(r => r.table_name).join(', '));
        } else {
            console.log('   ⚠️ No tables found. Run migrations with: npm run migrate:supabase');
        }

        await client.end();
        return true;

    } catch (error) {
        console.error(`   ❌ PostgreSQL connection failed: ${error.message}`);
        return false;
    }
}

async function checkRedis() {
    console.log('\n2. Testing Redis (Upstash)...');

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.log('   ⚠️ REDIS_URL not set');
        return false;
    }

    const redis = new Redis(redisUrl, {
        tls: {},
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 100, 3000);
        }
    });

    try {
        // Test connection
        await redis.ping();
        console.log('   ✅ Connected to Redis');

        // Get info
        const info = await redis.info();
        const versionLine = info.split('\n').find(line => line.startsWith('redis_version'));
        const version = versionLine ? versionLine.split(':')[1] : 'unknown';

        console.log(`   📊 Redis Version: ${version}`);
        console.log(`   🏷️  Host: ${redis.options.host}`);

        // Test simple set/get
        await redis.set('connection_test', Date.now());
        const testValue = await redis.get('connection_test');
        console.log(`   🧪 Test set/get: ${testValue ? 'OK' : 'Failed'}`);

        await redis.quit();
        return true;

    } catch (error) {
        console.error(`   ❌ Redis connection failed: ${error.message}`);
        return false;
    }
}

async function checkEnvironment() {
    console.log('\n3. Checking Environment...');

    const requiredVars = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];
    const missing = [];

    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    if (missing.length > 0) {
        console.log(`   ❌ Missing required variables: ${missing.join(', ')}`);
        console.log('   📝 Load from .env.production: source .env.production');
        return false;
    }

    console.log('   ✅ All required environment variables present');
    console.log(`   🌐 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

    // Check JWT secret strength
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.log('   ⚠️ JWT_SECRET might be too short. Consider generating a stronger one:');
        console.log('      openssl rand -base64 32');
    }

    return true;
}

async function runAllChecks() {
    console.log('=== PRODUCTION CONNECTION CHECKS ===\n');

    const results = {
        environment: await checkEnvironment(),
        postgresql: await checkPostgreSQL(),
        redis: await checkRedis()
    };

    console.log('\n=== CHECK RESULTS ===');
    console.log(`Environment: ${results.environment ? '✅' : '❌'}`);
    console.log(`PostgreSQL:  ${results.postgresql ? '✅' : '❌'}`);
    console.log(`Redis:       ${results.redis ? '✅' : '❌'}`);

    const allPassed = Object.values(results).every(Boolean);

    if (allPassed) {
        console.log('\n🎉 All connections successful! Ready for production.');
        console.log('\nNext steps:');
        console.log('   1. Run migrations: npm run migrate:supabase');
        console.log('   2. Start app: npm run start:production');
        console.log('   3. Test API: npm run test:production');
    } else {
        console.log('\n⚠️ Some checks failed. Fix issues before deployment.');
        process.exit(1);
    }
}

// Load production environment if not already loaded
if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') {
    // Use dynamic import for dotenv to avoid issues if not used or needed elsewhere in ESM
    import('dotenv').then(dotenv => {
        dotenv.config({ path: join(__dirname, '..', '.env.production') });
        runAllChecks().catch(console.error);
    }).catch(err => {
        console.error("Failed to load dotenv", err);
    });
} else {
    runAllChecks().catch(console.error);
}
