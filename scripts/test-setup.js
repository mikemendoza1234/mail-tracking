import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno de testing
dotenv.config({ path: join(__dirname, '..', '.env.test') });

const execAsync = promisify(exec);
const { Client } = pg;

async function readSqlFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading SQL file ${filePath}:`, error.message);
        return null;
    }
}

async function setupTestDatabase() {
    console.log('Setting up test database...');

    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: 'postgres'
    });

    try {
        await client.connect();

        // Crear base de datos de testing si no existe
        const dbName = process.env.DB_NAME || 'mail_tracking_test';

        // Terminar conexiones existentes
        await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = '${dbName}'
      AND pid <> pg_backend_pid();
    `);

        await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
        await client.query(`CREATE DATABASE ${dbName}`);

        console.log(`✅ Test database ${dbName} created successfully.`);

        await client.end();

    } catch (error) {
        console.error('Error dropping/creating database:', error.message);
        await client.end();
        throw error;
    }

    // Conectar a la nueva base de datos
    const testClient = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'mail_tracking_test'
    });

    try {
        await testClient.connect();
        console.log('✅ Connected to test database');

        // Habilitar extensiones
        await testClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        // Verificar si el schema.sql existe
        const schemaPath = join(__dirname, '..', 'sql', 'schema.sql');

        if (!fs.existsSync(schemaPath)) {
            console.log('⚠️  schema.sql not found, creating default schema...');
            // Crear el esquema básico si no existe
            await createBasicSchema(testClient);
        } else {
            // Ejecutar schema.sql
            const sql = await readSqlFile(schemaPath);
            if (sql) {
                console.log('📄 Executing schema.sql...');
                await testClient.query(sql);
                console.log('✅ Schema created successfully.');
            } else {
                await createBasicSchema(testClient);
            }
        }

        // Insertar datos de prueba
        await seedTestData(testClient);

        await testClient.end();
        console.log('✅ Test database setup completed');

    } catch (error) {
        console.error('❌ Error setting up schema:', error.message);
        console.error(error);
        await testClient.end();
        throw error;
    }
}

async function createBasicSchema(client) {
    console.log('Creating basic schema...');

    const basicSchema = `
    -- Tabla de organizaciones
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Tabla de emails
    CREATE TABLE IF NOT EXISTS emails (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id UUID REFERENCES organizations(id),
      subject VARCHAR(500),
      tracking_pixel_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Tabla de eventos
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email_id UUID REFERENCES emails(id),
      type VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

    await client.query(basicSchema);
    console.log('✅ Basic schema created');
}

async function seedTestData(client) {
    console.log('Seeding test data...');

    // Insertar organización de prueba
    await client.query(`
    INSERT INTO organizations (name) 
    VALUES ('Test Organization')
    ON CONFLICT DO NOTHING;
  `);

    // Insertar emails de prueba (skip if table different, simplified try)
    // Our new schema has many constraints, so simplistic insertion might fail if FKs missing.
    // Let's rely on standard registration flows or just careful seeding.
    // The provided code tries simple insertion:
    try {
        await client.query(`
        INSERT INTO emails (organization_id, subject, tracking_pixel_url)
        SELECT id, 'Test Email', 'http://localhost:3001/o/test.png'
        FROM organizations
        LIMIT 5;
      `);
        console.log('✅ Test data seeded');
    } catch (e) {
        console.log('⚠️  Could not seed emails (schema constraint?): ' + e.message);
    }
}

async function installArtillery() {
    console.log('Checking Artillery installation...');

    try {
        // Check if artillery is in node_modules
        const { execSync } = await import('child_process');

        // Use npx to avoid global installation issues
        console.log('Using npx for Artillery...');

        // Test that it works
        execSync('npx artillery --version', { stdio: 'pipe' });
        console.log('✅ Artillery available via npx');

    } catch (error) {
        console.log('⚠️  Artillery not found, installing as dev dependency...');

        try {
            // Install locally
            const { execSync } = await import('child_process');
            execSync('npm install artillery@2.0.12 --save-dev', { stdio: 'inherit' });
            console.log('✅ Artillery installed locally');
        } catch (installError) {
            console.log('⚠️  Could not install Artillery. Tests will use npx from npm registry.');
        }
    }
}

async function createEnvFiles() {
    console.log('Creating environment files...');

    const fs = await import('fs');
    const envTestPath = join(__dirname, '..', '.env.test');
    const envExamplePath = join(__dirname, '..', '.env.example');

    // Crear .env.test si no existe
    if (!fs.existsSync(envTestPath)) {
        const envTemplate = `# Test Environment
NODE_ENV=test
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=1234
DB_NAME=mail_tracking_test
JWT_SECRET=test-secret-key-change-in-production
REDIS_URL=redis://localhost:6379
API_PORT=3001
LOG_LEVEL=info
`;

        fs.writeFileSync(envTestPath, envTemplate);
        console.log('✅ .env.test file created');
    }

    // Crear .env.example si no existe
    if (!fs.existsSync(envExamplePath)) {
        const envExample = `# Production Environment
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=mail_tracking
JWT_SECRET=your-super-secret-jwt-key-change-this
REDIS_URL=redis://localhost:6379
API_PORT=3000
LOG_LEVEL=info
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
`;

        fs.writeFileSync(envExamplePath, envExample);
        console.log('✅ .env.example file created');
    }
}

async function checkPostgresConnection() {
    console.log('Checking PostgreSQL connection...');

    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: 'postgres',
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        console.log('✅ PostgreSQL connection successful');
        await client.end();
        return true;
    } catch (error) {
        // Try with docker password '1234' if default fails
        if (process.env.DB_PASSWORD === 'postgres') {
            const client2 = new Client({ ...client.options, password: '1234' });
            try {
                await client2.connect();
                console.log('✅ PostgreSQL connection successful (password 1234)');
                process.env.DB_PASSWORD = '1234'; // Update env for subsequent steps
                await client2.end();
                return true;
            } catch (e) { }
        }

        console.error('❌ Cannot connect to PostgreSQL:', error.message);
        console.log('\n⚠️  Please ensure PostgreSQL is running:');
        console.log('   For Windows: Start PostgreSQL service');
        console.log('   For Linux/Mac: sudo service postgresql start');
        console.log('\nOr start with Docker:');
        console.log('   docker run -d --name postgres-test -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15');
        return false;
    }
}

async function main() {
    console.log('=== TEST ENVIRONMENT SETUP ===\n');

    // 1. Crear archivos de entorno
    await createEnvFiles();

    // 2. Verificar conexión a PostgreSQL
    const pgConnected = await checkPostgresConnection();
    if (!pgConnected) {
        console.log('\n❌ Setup failed: PostgreSQL not available');
        process.exit(1);
    }

    // 3. Instalar Artillery
    await installArtillery();

    // 4. Configurar base de datos de testing
    await setupTestDatabase();

    // 5. Crear estructura de directorios
    const fs = await import('fs');
    const dirs = [
        'tests/results',
        'tests/data',
        'sql/migrations',
        'logs'
    ];

    for (const dir of dirs) {
        const fullPath = join(__dirname, '..', dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }
    }

    // 6. Crear archivo de datos de prueba para Artillery
    const testDataPath = join(__dirname, '..', 'tests', 'data', 'organizations.csv');
    if (!fs.existsSync(testDataPath)) {
        const csvData = `name,email,password
Test Org 1,org1@test.com,password123
Test Org 2,org2@test.com,password123
Test Org 3,org3@test.com,password123
Test Org 4,org4@test.com,password123
Test Org 5,org5@test.com,password123`;

        fs.writeFileSync(testDataPath, csvData);
        console.log('✅ Test data CSV created');
    }

    console.log('\n=== SETUP COMPLETED SUCCESSFULLY ===');
    console.log('\nNext steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Run integration tests: npm run test:integration');
    console.log('3. Run load tests: npm run test:load:register');
    console.log('\nOr run all tests: npm test');
}

main().catch(error => {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
});
