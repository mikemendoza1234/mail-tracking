#!/usr/bin/env node
import pg from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de producción
dotenv.config({ path: join(__dirname, '..', '.env.production') });

const { Client } = pg;

async function runMigrations() {
    console.log('🚀 Running Supabase Migrations\n');

    const connectionString = process.env.DATABASE_URL ||
        `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Supabase PostgreSQL');

        // Crear tabla de migraciones si no existe
        await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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
            console.log('⚠️ No migrations directory, using schema.sql...');
            const schemaPath = join(__dirname, '..', 'sql', 'schema.sql');
            if (fs.existsSync(schemaPath)) {
                const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
                await client.query(schemaSQL);
                await client.query(
                    'INSERT INTO migrations (name) VALUES ($1)',
                    ['initial_schema']
                );
                console.log('✅ Initial schema applied');
            }
            await client.end();
            return;
        }

        // Ejecutar migraciones en orden
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

        // Verificar estructura final
        console.log('\n📋 Verifying database structure...');
        const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

        console.log(`Total tables: ${tablesResult.rows.length}`);
        tablesResult.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        await client.end();

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

runMigrations().catch(console.error);
