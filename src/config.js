import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Fix for ESM not having __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file explicitly from the root directory to avoid path issues
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
    port: process.env.PORT || 3000,
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV || 'development',
    // Railway provides DATABASE_PUBLIC_URL etc, but usually DATABASE_URL is sufficient.
    // We can add more robust parsing here if needed.
};

if (!config.databaseUrl) {
    console.error('CRITICAL: DATABASE_URL is not defined in environment variables or .env file.');
    console.error('Please check your .env file or environment configuration.');
    // We don't exit here to allow for testing imports, but db connection will fail.
}

export default config;
