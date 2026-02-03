import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { buildServer } from '../../src/server.js';
import { createTestClient, cleanupTestDatabase } from '../helpers/db.js';

let app;
let dbClient;

describe('Authentication and Organization Segregation', () => {
    beforeAll(async () => {
        app = await buildServer();
        await app.ready();
        dbClient = await createTestClient();
    });

    afterAll(async () => {
        await app.close();
        await cleanupTestDatabase(dbClient);
    });

    it('should register two organizations separately', async () => {
        // Register Org A
        const emailA = faker.internet.email();
        const orgAResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: {
                orgName: 'Org A',
                email: emailA,
                password: 'password123'
            }
        });

        expect(orgAResponse.statusCode).toBe(200);
        const bodyA = JSON.parse(orgAResponse.payload);
        expect(bodyA.token).toBeDefined();

        const tokenA = bodyA.token;

        // Register Org B
        const emailB = faker.internet.email();
        const orgBResponse = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: {
                orgName: 'Org B',
                email: emailB,
                password: 'password123'
            }
        });

        expect(orgBResponse.statusCode).toBe(200);
        const bodyB = JSON.parse(orgBResponse.payload);
        const tokenB = bodyB.token;
    });

    it('should prevent cross-organization data access', async () => {
        // 1. Create Org A
        const emailA = faker.internet.email();
        const resA = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { orgName: 'Test Org A', email: emailA, password: 'password123' }
        });
        const tokenA = JSON.parse(resA.payload).token;

        // 2. Create Org B
        const emailB = faker.internet.email();
        const resB = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { orgName: 'Test Org B', email: emailB, password: 'password123' }
        });
        const tokenB = JSON.parse(resB.payload).token;

        // 3. Create Contact in Org A
        const contactEmail = faker.internet.email();
        const contactRes = await app.inject({
            method: 'POST',
            url: '/api/contacts',
            headers: { Authorization: `Bearer ${tokenA}` },
            payload: { email: contactEmail, firstName: 'Contact', lastName: 'A' }
        });

        expect(contactRes.statusCode).toBe(200);
        const contactAId = JSON.parse(contactRes.payload).id;

        // 4. Try to access Org A's contact with Org B's token
        const listRes = await app.inject({
            method: 'GET',
            url: '/api/contacts',
            headers: { Authorization: `Bearer ${tokenB}` }
        });

        expect(listRes.statusCode).toBe(200);
        const contactsB = JSON.parse(listRes.payload);
        const found = contactsB.find(c => c.id === contactAId);
        expect(found).toBeUndefined();
    });
});
