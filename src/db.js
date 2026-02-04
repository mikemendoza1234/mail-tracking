import { db } from './database/db.js';

export const query = db.query;
export const pool = db.pool;
export const getClient = () => db.pool.connect();
export default db.pool;
