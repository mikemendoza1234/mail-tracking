-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations (Tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  settings JSONB DEFAULT '{}'
);

-- Users (Admins/Members of organizations)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contacts (People being tracked/marketed to)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL, -- 'event', 'schedule', 'api'
  trigger_config JSONB DEFAULT '{}',
  nodes JSONB NOT NULL, -- Logical definition of the flow
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Workflow Executions (Instances of a running flow)
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  contact_id UUID REFERENCES contacts(id),
  current_node VARCHAR(100),
  status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed', 'waiting'
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Emails (Sent messages)
-- Note: Assuming we migrate existing table or recreate it. 
-- For production safety we usually ADD columns, but here we redefine for clarity as "IF NOT EXISTS" handles existing.
-- However, strict schema evolution might require ALTER in a separate script.
-- For this "from scratch" expansion, we will use ALTER if table exists logic in the setup script or just extensive DDL here.
-- Since previous schema was: id serial, we are changing to UUID potentially or keeping serial but adding org_id.
-- To keep it simple and compatible with existing data (if we wanted to keep it), we'd keep serial/integer ids for legacy tables
-- but new tables use UUID. However, mixing is messy.
-- Let's stick to the user's SQL which implies a mix or fresh start. The user provided ALTERs.
-- WE WILL DEFINE THE FINAL STATE HERE.

CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY, -- Maintaining legacy SERIAL for now, or could switch to UUID if we drop table
  organization_id UUID REFERENCES organizations(id),
  workflow_id UUID REFERENCES workflows(id),
  workflow_execution_id UUID REFERENCES workflow_executions(id),
  subject VARCHAR(255),
  recipient VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Click Events
CREATE TABLE IF NOT EXISTS click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  email_id INTEGER REFERENCES emails(id), -- Note: Matching emails.id type
  contact_id UUID REFERENCES contacts(id),
  url TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Conversion Events
CREATE TABLE IF NOT EXISTS conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  contact_id UUID REFERENCES contacts(id),
  event_type VARCHAR(100) NOT NULL,
  event_value DECIMAL(10,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Events (Open tracking) - Update to include Org
-- Originally: id, email_id, type, created_at
ALTER TABLE events ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
