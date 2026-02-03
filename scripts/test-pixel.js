import http from 'http';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runTest() {
    console.log('Starting verification...');

    if (!process.env.DATABASE_URL) {
        console.error('Error: DATABASE_URL not set. Please create a .env file.');
        process.exit(1);
    }

    // 1. Insert test email
    let emailId;
    let client;
    try {
        client = await pool.connect();
        const res = await client.query(
            "INSERT INTO emails (subject, recipient) VALUES ('Test Email', 'test@example.com') RETURNING id"
        );
        emailId = res.rows[0].id;
        console.log(`Step 1: Created test email with ID: ${emailId}`);
    } catch (err) {
        console.error('Failed to insert test email. Is the DB running and schema applied?', err);
        process.exit(1);
    } finally {
        if (client) client.release();
    }

    // 2. Request pixel
    const port = process.env.PORT || 3000;
    const url = `http://localhost:${port}/o/${emailId}.png`;
    console.log(`Step 2: Requesting pixel at ${url}...`);

    const req = http.get(url, async (res) => {
        console.log(`Response Status: ${res.statusCode}`);
        console.log(`Content-Type: ${res.headers['content-type']}`);

        let failed = false;
        if (res.statusCode !== 200) {
            console.error('FAILED: Status code is not 200');
            failed = true;
        }

        if (res.headers['content-type'] !== 'image/png') {
            console.error('FAILED: Content-Type is not image/png');
            failed = true;
        }

        if (failed) {
            process.exit(1);
        }

        // consume response data to free up memory
        res.resume();

        // 3. Verify event
        console.log('Step 3: Verifying event log in database...');
        // Give it a moment for async insert
        await new Promise(resolve => setTimeout(resolve, 500));

        let eventClient;
        try {
            eventClient = await pool.connect();
            const res = await eventClient.query(
                'SELECT * FROM events WHERE email_id = $1 AND type = $2',
                [emailId, 'email_opened']
            );

            if (res.rows.length > 0) {
                console.log('SUCCESS: Event found in database!');
                console.log('Event Data:', res.rows[0]);
            } else {
                console.error('FAILED: Event NOT found in database.');
                process.exit(1);
            }
        } catch (err) {
            console.error('Error querying events:', err);
            process.exit(1);
        } finally {
            if (eventClient) eventClient.release();
            await pool.end();
        }

    });

    req.on('error', (e) => {
        console.error(`Request error: ${e.message}`);
        console.error('Make sure the server is running (npm start)!');
        process.exit(1);
    });
}

runTest();
