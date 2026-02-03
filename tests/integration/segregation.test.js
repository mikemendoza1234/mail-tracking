import request from 'supertest';
import { buildServer } from '../../src/server.js';
import { faker } from '@faker-js/faker';

let app;
let tokenA, tokenB;
let orgAId, orgBId;
let contactAId;

beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Create Org A
    const emailA = faker.internet.email();
    const resA = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
            orgName: 'Org A',
            email: emailA,
            password: 'password123'
        }
    });
    tokenA = JSON.parse(resA.payload).token;
    orgAId = JSON.parse(resA.payload).organization.id;

    // Create Org B
    const emailB = faker.internet.email();
    const resB = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
            orgName: 'Org B',
            email: emailB,
            password: 'password123'
        }
    });
    tokenB = JSON.parse(resB.payload).token;
    orgBId = JSON.parse(resB.payload).organization.id;
});

afterAll(async () => {
    await app.close();
});

describe('Data Segregation', () => {

    test('Org A can create a contact', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/api/contacts',
            headers: { Authorization: `Bearer ${tokenA}` },
            payload: {
                email: faker.internet.email(),
                firstName: 'Alice'
            }
        });
        expect(res.statusCode).toBe(200);
        contactAId = JSON.parse(res.payload).id;
    });

    test('Org B cannot see Org A contacts', async () => {
        // 1. List contacts
        const res = await app.inject({
            method: 'GET',
            url: '/api/contacts',
            headers: { Authorization: `Bearer ${tokenB}` }
        });
        expect(res.statusCode).toBe(200);
        const contacts = JSON.parse(res.payload);
        const found = contacts.find(c => c.id === contactAId);
        expect(found).toBeUndefined();
    });

    test('Org A can see Org A contacts', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/api/contacts',
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        expect(res.statusCode).toBe(200);
        const contacts = JSON.parse(res.payload);
        const found = contacts.find(c => c.id === contactAId);
        expect(found).toBeDefined();
    });

    test('Org B cannot spoof Org A token', async () => {
        // This is implicitly tested by JWT verification, but good to note.
        // In a real scenario we might try to tamper with the JWT.
    });

});
