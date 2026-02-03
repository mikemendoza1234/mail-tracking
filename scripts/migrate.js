import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config();

const { Client } = pg;
const execAsync = promisify(exec);

async function runMigrations() {
    console.log('Running database migrations...\n');

    const client = new Client({
        connectionString: process.env.DATABASE_URL ||
            `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Crear tabla de migraciones si no existe
        await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Obtener migraciones ya aplicadas
        const appliedResult = await client.query(
            'SELECT name FROM migrations ORDER BY id'
        );
        const appliedMigrations = new Set(appliedResult.rows.map(row => row.name));

        // Leer archivos de migración
        const migrationsDir = join(__dirname, '..', 'sql', 'migrations');

        if (!fs.existsSync(migrationsDir)) {
            console.log('⚠️  No migrations directory found, creating initial schema...');

            // Ejecutar schema.sql completo
            const schemaPath = join(__dirname, '..', 'sql', 'schema.sql');
            if (fs.existsSync(schemaPath)) {
                const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
                await client.query(schemaSQL);

                // Registrar migración inicial
                await client.query(
                    'INSERT INTO migrations (name) VALUES ($1)',
                    ['initial_schema']
                );

                console.log('✅ Initial schema applied');
            }

            await client.end();
            return;
        }

        // Leer archivos de migración ordenados
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();

        console.log(`Found ${migrationFiles.length} migration files`);

        let appliedCount = 0;

        for (const file of migrationFiles) {
            if (appliedMigrations.has(file)) {
                console.log(`⏭️  Already applied: ${file}`);
                continue;
            }

            console.log(`📄 Applying: ${file}`);

            const migrationPath = join(migrationsDir, file);
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

            // Ejecutar en transacción
            await client.query('BEGIN');

            try {
                await client.query(migrationSQL);
                await client.query(
                    'INSERT INTO migrations (name) VALUES ($1)',
                    [file]
                );
                await client.query('COMMIT');

                console.log(`✅ Applied: ${file}`);
                appliedCount++;
            } catch (error) {
                await client.query('ROLLBACK');
                console.error(`❌ Failed to apply ${file}:`, error.message);
                throw error;
            }
        }

        if (appliedCount === 0) {
            console.log('\n✅ Database is already up to date');
        } else {
            console.log(`\n✅ Applied ${appliedCount} migration(s)`);
        }

        await client.end();

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        process.exit(1);
    }
}

async function checkDatabaseExists() {
    const adminClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: 'postgres'
    });

    try {
        await adminClient.connect();

        const dbName = process.env.DB_NAME || 'mail_tracking';
        const result = await adminClient.query(
            'SELECT 1 FROM pg_database WHERE datname = $1',
            [dbName]
        );

        await adminClient.end();

        if (result.rows.length === 0) {
            console.log(`\n⚠️  Database '${dbName}' does not exist. Creating...`);

            await execAsync(
                `createdb -h ${process.env.DB_HOST || 'localhost'} -p ${process.env.DB_PORT || 5432} -U ${process.env.DB_USER || 'postgres'} ${dbName}`
            );

            console.log(`✅ Database '${dbName}' created`);
        }

        return true;

    } catch (error) {
        console.error('Error checking database:', error.message);
        return false;
    }
}

async function main() {
    console.log('=== DATABASE MIGRATION TOOL ===\n');

    // Verificar si la base de datos existe
    await checkDatabaseExists();

    // Ejecutar migraciones
    await runMigrations();

    console.log('\n=== MIGRATION COMPLETED ===');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}

export { runMigrations };
