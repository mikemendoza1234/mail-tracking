# Endpoints Reference

## Base URL: `http://localhost:3000` (Local)

## Authentication

### Register Organization

`POST /api/auth/register`

Register a new organization and create its admin user.

**Request Body:**

```json
{
  "orgName": "Acme Corp",
  "email": "admin@acme.com",
  "password": "securepassword",
  "domain": "acme.com" 
}
```

**Response:**

```json
{
  "token": "jwt_token...",
  "user": { "id": "...", "email": "...", "role": "admin" },
  "organization": { "id": "...", "name": "Acme Corp" }
}
```

### Login

`POST /api/auth/login`

**Request Body:**

```json
{
  "email": "admin@acme.com",
  "password": "securepassword"
}
```

## Contacts

### List Contacts

`GET /api/contacts`
*Headers:* `Authorization: Bearer <token>`
*Query Params:* `limit` (default 50), `offset` (default 0)

### Create Contact

`POST /api/contacts`
*Headers:* `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "email": "client@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "metadata": { "source": "web" }
}
```

## Tracking

### Open Pixel

`GET /o/:orgId/:emailId.png`
Returns a 1x1 transparent PNG and logs the open event.

### Click Redirect

`GET /c/:orgId/:emailId/:encodedUrl`
Logs the click and redirects to the decoded URL.

## Workflows

### Create Workflow

`POST /api/workflows`
*Headers:* `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "name": "Onboarding",
  "triggerType": "manual",
  "nodes": [
    { "id": "1", "type": "email", "config": { "subject": "Hi" } }
  ]
}
```

### Trigger Workflow

`POST /api/workflows/:id/trigger`
*Headers:* `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "contactId": "uuid...",
  "data": { "foo": "bar" }
}
```
