import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { dirname } from 'path';
import config from '../src/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!config.databaseUrl) {
    console.error('DATABASE_URL is not set in environment or .env file');
    process.exit(1);
}

// Logic for SSL matches src/db.js
const sslConfig = config.nodeEnv === 'production'
    ? { rejectUnauthorized: false }
    : false;

const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: sslConfig,
});

const schemaPath = path.join(__dirname, '..', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

async function setup() {
    console.log('Connecting to database...');
    let client;
    try {
        client = await pool.connect();
        console.log('Connected. applying schema...');
        await client.query('BEGIN');
        await client.query(schema);
        await client.query('COMMIT');
        console.log('Database schema applied successfully');
    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error('Failed to apply schema:', e);
        process.exit(1);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

setup();
