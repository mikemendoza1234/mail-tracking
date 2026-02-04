import pg from 'pg';
const { Pool } = pg;

function createPool() {
    // Usar DATABASE_URL si está disponible (Supabase)
    if (process.env.DATABASE_URL) {
        return new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? {
                rejectUnauthorized: false
            } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        });
    }

    // Fallback a configuración individual
    return new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'mail_tracking',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });
}

export const pool = createPool();

// Query helper con logging en producción
export const db = {
    query: async (text, params) => {
        const start = Date.now();
        try {
            const result = await pool.query(text, params);
            const duration = Date.now() - start;

            if (process.env.NODE_ENV === 'production' && duration > 1000) {
                console.warn(`⚠️ Slow query (${duration}ms): ${text.substring(0, 100)}...`);
            }

            return result;
        } catch (error) {
            console.error('❌ Database query error:', {
                query: text.substring(0, 200),
                params: params,
                error: error.message
            });
            throw error;
        }
    },
    pool
};

// Event handlers
pool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err);
});
