import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config.js';

// ---- Utils ----

export const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

export const signToken = (payload, expiresIn = '1h') => {
    return jwt.sign(payload, config.jwtSecret, { expiresIn });
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, config.jwtSecret);
    } catch (err) {
        return null;
    }
};

// ---- Middleware ----

// Fastify Middleware/Hook
export const requireAuth = async (request, reply) => {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ error: 'Unauthorized: Missing or invalid token' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (!decoded) {
            return reply.code(401).send({ error: 'Unauthorized: Invalid token' });
        }

        // Attach user to request
        request.user = decoded;

        // Optionally: check if user still exists in DB or if stripped of access
    } catch (err) {
        request.log.error(err);
        return reply.code(401).send({ error: 'Unauthorized' });
    }
};
