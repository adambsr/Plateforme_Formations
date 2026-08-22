# Deployment guide

This guide deploys the Phase 12 Web application without changing its single-tenant MVP
architecture. The backend is shared by Web and Mobile and remains authoritative.

## Build and release

Requirements: Node.js 24+, npm 11+, MongoDB 8 configured as a replica set, HTTPS termination,
SMTP, Stripe, and a persistent filesystem volume.

1. Copy Web/backend/.env.example to Web/backend/.env for a direct backend process. Copy
   Web/frontend/.env.example to Web/frontend/.env for the Web build. For Compose overrides, copy
   the root .env.example to the ignored root .env.
2. Replace every secret placeholder. Never commit .env files. Generate a random
   JWT_ACCESS_SECRET of at least 32 characters.
3. Run npm ci, npm run check, and npm run build.
4. Start Web/backend/dist/server.js with Node, or build and start the backend container.
5. Serve Web/frontend/dist through an HTTPS reverse proxy with SPA fallback to index.html.
6. Run npm run seed:admin once with INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD, then remove
   those two values from the runtime environment.
7. Verify /api/health, /api/openapi.json, /api/docs/, login, a protected download, and a Stripe
   test checkout and webhook before accepting traffic.

## Environment contract

Web/backend/.env.example is the complete backend contract. Production needs NODE_ENV=production,
the exact HTTPS WEB_APP_URL and CORS_ORIGINS, a replica-set MONGODB_URI, JWT configuration, SMTP,
Stripe, durable UPLOAD_DIR, Gemini, and centre identity. Database credentials belong inside the
MongoDB URI and must be URL-encoded.

The Web build exposes only VITE-prefixed variables. Set VITE_API_BASE_URL to the public backend URL
ending in /api. Never put MongoDB, JWT, Stripe secret/webhook, SMTP, or AI keys in frontend
configuration. Stripe test environments use sk_test_. Production availability for a
Tunisia-established Stripe account requires a separate launch review.

## Production topology and security

- Terminate TLS at the reverse proxy and redirect HTTP to HTTPS. The backend emits HSTS in
  production plus anti-sniffing, anti-framing, referrer, opener, and permissions headers.
- Do not expose MongoDB publicly. Permit CORS only from deployed client origins.
- Run one backend instance for this MVP because protected uploads use a local persistent volume.
  Horizontal file replication and object storage are outside scope.
- Web refresh tokens are HttpOnly and Secure in production; access tokens remain in Web memory.
- Store secrets in the hosting secret manager. Rotate any credential exposed in chat, logs, or
  committed files.

## Persistent state and rollback

MongoDB must support transactions through a replica set. Declared indexes initialize at startup;
there is no separate migration command. Uploaded resources, invoices, and certificates live under
UPLOAD_DIR, so a database-only backup is insufficient.

Use BACKUP_RESTORE.md before releases. Keep the previous backend image and frontend artifact.
Rollback code first. Restore data only if persistent state was changed or corrupted, because a
restore overwrites newer records and needs an approved maintenance window.

