import { query } from '../db.js';
import { hashPassword, comparePassword, signToken } from '../auth/index.js';

export default async function authRoutes(fastify, options) {

    // Register Organization & User
    fastify.post('/register', async (request, reply) => {
        const { orgName, domain, email, password } = request.body || {};

        if (!orgName || !email || !password) {
            return reply.code(400).send({ error: 'Missing required fields' });
        }

        // Fixed: removed fastify.pg.connect()

        try {
            // 1. Check if user exists
            const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
            if (existingUser.rows.length > 0) {
                return reply.code(409).send({ error: 'User already exists' });
            }

            // 2. Create Organization
            const orgRes = await query(
                'INSERT INTO organizations (name, domain) VALUES ($1, $2) RETURNING id',
                [orgName, domain || null]
            );
            const orgId = orgRes.rows[0].id;

            // 3. Create User
            const hashed = await hashPassword(password);
            const userRes = await query(
                'INSERT INTO users (organization_id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
                [orgId, email, hashed, 'admin']
            );
            const userId = userRes.rows[0].id;

            // 4. Generate Token
            const token = signToken({ userId, orgId, role: 'admin' });

            return {
                token,
                user: { id: userId, email, role: 'admin' },
                organization: { id: orgId, name: orgName }
            };

        } catch (err) {
            request.log.error(err);
            return reply.code(500).send({ error: 'Internal Server Error', details: err.message, code: err.code });
        }
    });

    // Login
    fastify.post('/login', async (request, reply) => {
        const { email, password } = request.body || {};

        if (!email || !password) {
            return reply.code(400).send({ error: 'Missing email or password' });
        }

        try {
            const res = await query('SELECT * FROM users WHERE email = $1', [email]);
            if (res.rows.length === 0) {
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            const user = res.rows[0];
            const valid = await comparePassword(password, user.password_hash);

            if (!valid) {
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            const token = signToken({
                userId: user.id,
                orgId: user.organization_id,
                role: user.role
            });

            return { token };
        } catch (err) {
            request.log.error(err);
            return reply.code(500).send({ error: 'Login failed' });
        }
    });
}
