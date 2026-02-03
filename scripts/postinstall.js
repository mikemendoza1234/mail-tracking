import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Running postinstall setup...');

// The directories to create
const directories = [
    'tests/results',
    'tests/data',
    'sql/migrations',
    'logs',
    'scripts'
];

directories.forEach(dir => {
    const fullPath = join(__dirname, '..', dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
    }
});

// Create .env.example if it doesn't exist
const envExample = `# Production Environment
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
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

const envExamplePath = join(__dirname, '..', '.env.example');
if (!fs.existsSync(envExamplePath)) {
    fs.writeFileSync(envExamplePath, envExample);
    console.log('✅ Created .env.example');
}

// Create initial migration file if it doesn't exist
const migrationsDir = join(__dirname, '..', 'sql', 'migrations');
const initialMigration = join(migrationsDir, '001_initial_schema.sql');

if (!fs.existsSync(initialMigration) && fs.existsSync(migrationsDir)) {
    const initialSchema = `-- Migration: 001_initial_schema.sql
-- Description: Initial schema for mail tracking platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, email)
);

-- Emails table
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  subject VARCHAR(500),
  body_html TEXT,
  body_text TEXT,
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  tracking_pixel_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'draft',
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  location JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_email_id ON events(email_id);
CREATE INDEX IF NOT EXISTS idx_events_organization_id ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_emails_organization_id ON emails(organization_id);
CREATE INDEX IF NOT EXISTS idx_emails_contact_id ON emails(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at 
    BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at 
    BEFORE UPDATE ON contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

    fs.writeFileSync(initialMigration, initialSchema);
    console.log('✅ Created initial migration file');
}

// Create run-load-tests.js check
const runLoadTestsPath = join(__dirname, '..', 'scripts', 'run-load-tests.js');
if (!fs.existsSync(runLoadTestsPath)) {
    const runLoadTests = `import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Running all load tests...\\n');

const tests = [
  { name: 'register', file: 'tests/load/register.yml' },
  { name: 'tracking', file: 'tests/load/tracking.yml' }
];

try {
  for (const test of tests) {
    console.log(\`📊 Running \${test.name} load test...\`);
    
    const command = \`npx artillery run \${test.file} --output tests/results/\${test.name}-report.json\`;
    console.log(\`Command: \${command}\`);
    
    execSync(command, { stdio: 'inherit' });
    
    // Generate HTML report
    const reportCommand = \`npx artillery report tests/results/\${test.name}-report.json --output tests/results/\${test.name}-report.html\`;
    execSync(reportCommand, { stdio: 'inherit' });
    
    console.log(\`✅ \${test.name} test completed. Report saved to tests/results/\${test.name}-report.html\\n\`);
  }
  
  console.log('🎉 All load tests completed successfully!');
  console.log('📈 Reports available in tests/results/');
  
} catch (error) {
  console.error('❌ Load test failed:', error.message);
  process.exit(1);
}
`;

    fs.writeFileSync(runLoadTestsPath, runLoadTests);
    console.log('✅ Created load test runner');
}

console.log('✅ Postinstall setup completed');
