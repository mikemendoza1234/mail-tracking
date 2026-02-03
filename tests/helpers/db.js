import pg from 'pg';
import { randomBytes } from 'crypto';

const { Client } = pg;

// Shared DB connection reused across tests is not ideal for parallel tests,
// but fine for --runInBand.
// We will connect to the standard test database.

export async function createTestClient() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'mail_tracking_test'
    });

    await client.connect();

    // Clean up data before starting
    await truncateAllTables(client);

    return { client, dbName: process.env.DB_NAME };
}

export async function cleanupTestDatabase(testClient) {
    if (!testClient || !testClient.client) return;

    // Clean up data after tests
    await truncateAllTables(testClient.client);
    await testClient.client.end();
}

async function truncateAllTables(client) {
    // Truncate all tables in correct order or use CASCADE
    const tables = ['events', 'emails', 'contacts', 'users', 'organizations'];
    try {
        console.log('Truncating tables:', tables.join(', '));
        await client.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
        console.log('✅ Tables truncated');
    } catch (error) {
        console.error('Error truncating tables:', error.message);
        // Ignore "relation does not exist" if tables don't exist yet (first run?)
        // But setup should have run.
    }
}
