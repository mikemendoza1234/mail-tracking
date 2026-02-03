import pg from 'pg';
import config from './config.js';

// SSL Configuration for Production/Railway
// If the URL ends with ?sslmode=require, pg handles it, but often we need explicit parameters.
// Railway Postgres usually requires SSL unless internal networking is used.
const sslConfig = config.nodeEnv === 'production'
  ? { rejectUnauthorized: false } // Common requirement for managed Postgres services
  : false;

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: sslConfig,
});

// Test connection on startup
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
