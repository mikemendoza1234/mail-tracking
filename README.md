# Email Tracking Microservice

A production-grade microservice for tracking email opens using an invisible pixel.

## Features

- GET `/o/:emailId.png` returns a transparent 1x1 PNG.
- Logs "email_opened" events to PostgreSQL.
- Built with Fastify, PostgreSQL (raw SQL with `pg`), and ES Modules.

## Prerequisites

- Node.js 20+
- PostgreSQL database

## Setup

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure Environment**
   Duplicate `.env.example` to `.env` and update the `DATABASE_URL`.

   ```bash
   # Windows PowerShell
   Copy-Item .env.example .env
   ```

   Edit `.env`:

   ```ini
   DATABASE_URL=postgresql://user:password@localhost:5432/mail_tracking
   PORT=3000
   ```

3. **Database Setup**
   Ensure your PostgreSQL server is running and the database specified in `DATABASE_URL` exists.
   Then run the migration script to create the tables:

   ```bash
   npm run db:setup
   ```

## Running the Server

Start the application:

```bash
npm start
```

The server will start on `http://localhost:3000` (or `PORT` in .env).

## Verification

To verify the installation works as expected:

1. **Start the server** in one terminal:

   ```bash
   npm start
   ```

2. **Run the test script** in a new terminal:

   ```bash
   node scripts/test-pixel.js
   ```

   This script will:
   - Insert a dummy email into the DB.
   - Request the pixel for that email.
   - Verify the pixel response (200 OK, PNG content).
   - Verify the event was logged in the `events` table.

## API Reference

### Get Tracking Pixel

`GET /o/:emailId.png`

Returns a 1x1 transparent PNG image and logs the access.

**Parameters:**

- `emailId`: Integer ID of the email to track.
