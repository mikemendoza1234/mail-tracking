import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.test') });

const { Client } = pg;

async function cleanupTestDatabase() {
    console.log('Cleaning up test database...');

    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '1234',
        database: 'postgres'
    });

    try {
        await client.connect();

        // Terminar todas las conexiones a la base de datos de testing
        const dbName = process.env.DB_NAME || 'mail_tracking_test';

        await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${dbName}'
      AND pid <> pg_backend_pid();
    `);

        // Eliminar la base de datos
        await client.query(`DROP DATABASE IF EXISTS ${dbName}`);

        console.log(`Test database ${dbName} dropped successfully.`);

        await client.end();

    } catch (error) {
        console.error('Error cleaning up test database:', error);
    }
}

async function main() {
    console.log('=== TEST ENVIRONMENT CLEANUP ===');
    await cleanupTestDatabase();
    console.log('=== CLEANUP COMPLETED ===');
}

main().catch(console.error);
