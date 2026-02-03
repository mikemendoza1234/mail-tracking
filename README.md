# 📧 Mail Marketing Platform

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your settings

# Setup database
npm run test:setup

# Start in development
# Option 1: Run both API and Worker (Windows/Linux compatible via concurrently)
npm run dev:all

# Option 2: Run separately
npm run dev      # Terminal 1: API server
npm run worker   # Terminal 2: Workflow worker
```

### Testing

```bash
# Test workflow system
npm run test:workflow

# Run all tests
npm run test

# Load testing
npm run test:load:register
```

### Production (Railway)

```bash
# Deploy to Railway
npm run railway:deploy

# Check logs
npm run railway:logs
npm run railway:worker-logs

# Verify deployment
npm run verify:production
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/auth/register` - Register organization
- `POST /api/auth/login` - Login
- `POST /api/contacts` - Create contact
- `POST /api/workflows` - Create workflow
- `POST /api/workflows/:id/trigger` - Trigger workflow
- `GET /o/:orgId/:emailId.png` - Tracking pixel
- `GET /c/:orgId/:emailId/:encodedUrl` - Click tracking
