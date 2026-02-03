# Quick Start Guide

## Prerequisites

- Node.js >= 18
- PostgreSQL
- Redis (optional for queuing, but recommended)

## Setup

1. **Install dependencies:**

   ```bash
   npm install --legacy-peer-deps
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env` and update DB credentials.

3. **Database Setup:**

   ```bash
   npm run test:setup
   ```

4. **Start Server:**

   ```bash
   npm run dev
   ```

## Basic Usage with Curl

**1. Register Organization**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"orgName":"My Company","email":"admin@company.com","password":"secret123"}'
```

*Save the `token` from the response.*

**2. Create a Contact**

```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"client@example.com","firstName":"John"}'
```

**3. Test Tracking**
Visit in browser: `http://localhost:3000/o/ORG_ID/EMAIL_ID.png`
