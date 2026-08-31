# Plateforme de Formations

For a realistic local demo dataset and development-only credentials, see
[`Docs/DEVELOPMENT_SEED.md`](Docs/DEVELOPMENT_SEED.md).

Monorepo for the shared Web/Mobile training platform. The implementation follows
`Docs/SOURCE_OF_TRUTH.md`, then `PLAN.md`, then the client development prompts.

## Current implementation phase

Phases 0 through 12 are complete. The repository provides the engineering foundation, shared
authentication and user management, the Training catalogue and ownership slice, protected
training content, in-person Session planning, and the Stripe test-mode payment, Enrollment, and
Invoice access boundary, self-paced progression, in-person Attendance completion, complete
Evaluation attempts/grading, bounded Gemini-assisted draft question generation, Certificates, and
immutable satisfaction Feedback, explicit costs, and the Admin statistics/profitability dashboard.
Phase 12 completes the public website, role-specific shell and dashboards, responsive and
accessible UX states, consistent pagination, security hardening, API verification, critical
workflow coverage, and production operations documentation.

## Phase 0 status

Phase 0 provides the engineering foundation only:

- an Express/Mongoose backend in `Web/backend`;
- a Vite/React Web client in `Web/frontend`;
- an Expo/React Native Mobile client in `Mobile`;
- strict TypeScript, Oxlint, Prettier, tests, and production builds;
- typed backend configuration, structured/redacted request logs, a central error contract,
  database-aware health, and an OpenAPI shell;
- MongoDB 8 as a single-node replica set plus persistent database and upload volumes;
- a CI workflow that runs all checks and starts the real Compose stack.

Phase 0 itself defined no business collections, indexes, data migrations, or seed data. Phase 1
identity models now own their index declarations, which the backend initializes before it listens.
The initial Admin seed uses `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`; those values are
validated only for the seed command and remain unnecessary for a normal backend start.

## Phase 1 status

Phase 1 includes:

- strict User, refresh-session, and single-use password-reset persistence with the required unique,
  lookup, and TTL indexes;
- public Learner-only registration, login, 15-minute access JWTs, seven-day rotating refresh
  tokens, logout, password reset, password change, and profile updates;
- an idempotent initial-Admin CLI seed and Admin-only Trainer creation/deactivation;
- mandatory first password change for seeded Admins and new Trainers before other protected work;
- backend role/self authorization that re-checks the active user on every protected request;
- Web auth/reset/profile/Admin-user screens, in-memory access tokens, secure refresh-cookie flow,
  guards, and role layouts;
- synchronized OpenAPI routes plus unit, Web, and real replica-set HTTP integration coverage.

The Web refresh token is an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). Mobile
receives the same rotating refresh token in authenticated response bodies so its later client phase
can store it in platform secure storage. MongoDB stores only token hashes, and password change,
password reset, or account deactivation revokes every active refresh session for that user.

## Phase 2 status

Phase 2 includes:

- archived-capable Training categories and strict Training persistence with catalogue/owner
  indexes;
- the exact immutable `SELF_PACED_ONLINE` and `IN_PERSON` types, strictly positive integer minor
  unit EUR prices, and the in-person attendance threshold default of 80 percent;
- backend-enforced ownership: Trainer creators own their Training, Admin creators select an active
  Trainer, and only an Admin can transfer ownership;
- `DRAFT` to `PUBLISHED` to `ARCHIVED` lifecycle rules, public visibility limited to published
  Training, and conflict-safe hard deletion of unused drafts only;
- a public responsive catalogue/detail UI and authenticated Admin/owner management workspace with
  loading, error, empty, filtering, lifecycle, category, and ownership-transfer states;
- complete OpenAPI descriptions plus unit, Web, and real replica-set HTTP integration coverage.

Self-paced publication checks for at least one active Module containing an active Lesson. An
in-person Training may be published without a Session as required.

## Phase 3 status

Phase 3 includes:

- ordered Modules, Lessons, and FILE or EXTERNAL_URL Resources, with archive and progress-safe
  hard-deletion rules enforced by the backend;
- self-paced publication validation against the persisted active content hierarchy;
- Admin/owner authoring, assigned-Session-Trainer reading, and Enrollment-backed Learner reading;
- generated, sharded local filenames and a persistent Compose upload volume, with no public static
  file route or internal storage path in API responses;
- extension, declared MIME, detected signature, maximum-size, SHA-256 checksum, and traversal
  validation for PDF, PNG, JPEG, GIF, WebP, DOCX, PPTX, XLSX, ZIP, TXT, and CSV files;
- HTTP(S)-only external links that are stored without server-side fetching;
- a role-filtered Web content reader/authoring workspace and authenticated file downloads;
- complete OpenAPI, unit, Web, and real replica-set HTTP integration coverage.

Local files are removed only after their Resource is hard-deleted and no other Resource references
the same stored path. Content with learner progress is archived instead of cascading history.
Learner access depends on an Enrollment record, which Phase 5 creates only after a verified Stripe
test webhook.

## Phase 4 status

Phase 4 includes:

- in-person-only Sessions with the exact PLANNED, IN_PROGRESS, COMPLETED, and CANCELLED states;
- any number of SessionSchedule dates, optional Module/Lesson associations, derived overall dates,
  capacity, and available-seat views;
- Admin/owner structural management and assignment of multiple active Trainers, while assigned
  Trainers receive read/start/complete operational permissions only;
- exact Trainer and normalized location/room overlap checks across non-cancelled Sessions, with
  adjacent date ranges allowed;
- cancellation blocked by Enrollment history, schedule deletion blocked by Attendance, Session
  deletion blocked by Enrollment or Payment, and completion blocked until Attendance coverage is
  complete;
- a public available-Session view and a role-aware Web scheduling workspace with multiple-date,
  assignment, lifecycle, loading, empty, error, and conflict states;
- complete OpenAPI, unit, Web, and real replica-set HTTP integration coverage.

The API accepts only ISO 8601 Session instants containing `Z` or an explicit offset and stores them
as UTC dates. Web date inputs and displays use the IANA zone `Africa/Tunis`; server and container
processes remain on `TZ=UTC`.

## Phase 5 status

Phase 5 includes:

- Payment, Enrollment, Invoice, and InvoiceItem persistence with explicit uniqueness, lookup, and
  financial-reporting indexes initialized during backend startup;
- Learner-only hosted Stripe Checkout created from published Training and available Session data,
  with the positive integer EUR price sourced exclusively from the backend;
- raw-body Stripe signature verification and transaction-backed, idempotent webhook fulfillment;
- duplicate-Enrollment protection and an atomic in-person capacity gate without seat reservations;
- Enrollment-backed paid content access, with Admin-wide and Learner-own payment, Enrollment, and
  Invoice views while Trainers have no financial access;
- immutable purchase, learner, issuer, and line-item snapshots plus idempotently generated,
  protected Invoice PDFs;
- responsive catalogue purchase controls, Checkout-return confirmation, and payment/Enrollment/
  Invoice views with loading, empty, error, and conflict states;
- synchronized OpenAPI documentation plus unit, Web, signed-webhook, PDF-content, and real
  replica-set integration coverage.

No Phase 5 seed or data migration is required. Startup creates the model indexes. Existing content
access tests may construct Enrollment prerequisites directly, but production Enrollment creation
is owned exclusively by successful verified payment fulfillment.

## Phase 6 status

Phase 6 includes:

- LessonProgress persistence unique per Enrollment and Lesson, with learner/training lookup indexes;
- Learner-only mark/unmark behavior resolved through the paid self-paced Enrollment;
- server-calculated active-Lesson counts, percentages, and exact 100-percent completion;
- archived Module/Lesson exclusion and recalculation when applicable published content changes;
- Certificate issuance cutoff handling: applicable completion history is preserved, later Lessons
  do not change the issued eligibility snapshot, and served progress becomes immutable;
- progress-aware hard-deletion conflicts, a responsive Learner overview, and lesson-level controls;
- synchronized OpenAPI, strict DTO/index tests, Web state tests, and real replica-set lifecycle
  coverage.

## Phase 7 status

Phase 7 includes:

- Attendance persistence unique per Enrollment and SessionSchedule with only PRESENT and ABSENT;
- authorized bulk upsert by Admins and Trainers assigned to the Session, while owners without an
  assignment receive no implicit Attendance permission;
- explicit missing-entry representation: an unsupplied Attendance remains null and is never
  interpreted as ABSENT;
- unweighted per-schedule percentage calculation, Training threshold evaluation, and reusable
  in-person completion results;
- transactional full-coverage gating before Session completion and immutable Attendance afterward;
- enrolled-Learner Session discovery, own schedule/Attendance views, and compact Admin/Trainer
  roster entry with loading, empty, error, and conflict states;
- synchronized OpenAPI and integration coverage for authorization, missing coverage, thresholds,
  completion, and immutability.

Phases 6 and 7 require no seed or one-off data migration. Backend startup initializes the
LessonProgress and Attendance indexes. Existing Enrollments remain valid and acquire progress or
Attendance records only when users perform the corresponding actions.

## Phase 8 status

Phase 8 includes owner-only draft Evaluation and objective Question authoring, publication and
archive rules, one published certifying Evaluation per Training, enrolled-Learner Attempts with
server timestamps and optional expiry, exact-set automatic grading without partial credit,
immutable submitted/expired answer snapshots, answer release only after a pass or final attempt,
and owner/Admin result views. The Web workspace supports authoring, review, lifecycle actions,
timed attempts, immediate results, and role-specific loading, empty, validation, and error states.

## Phase 9 status

Phase 9 adds on-demand text extraction for text PDFs, DOCX, PPTX, and TXT, a deterministic
`AI_MAX_CONTEXT_CHARS` bound, and selected-Training-only context construction. Unsupported,
no-text, and failed resources are reported explicitly; there is no OCR, URL crawling, embedding,
vector store, or RAG. The backend calls Gemini with a JSON schema, validates the response again
with the same question DTO, and transactionally imports only draft questions. The owner must
review/edit/delete the proposals and explicitly publish; AI cannot publish or designate a
certifying Evaluation.

Phases 8 and 9 require no seed or one-off migration. Backend startup initializes the Evaluation,
Question, Attempt, and Answer indexes. Existing Trainings and Enrollments remain valid.

## Phase 10 status

Phase 10 adds one shared backend eligibility calculation for self-paced completion, completed
in-person Session attendance, and any designated certifying Evaluation. No role, including Admin,
can force issuance or Feedback while those rules fail. Certificate generation is idempotent per
Enrollment, snapshots Learner, Training, completion evidence, relevant dates/duration, and centre
identity, and materializes an authorization-protected PDF without changing the Certificate number.
Learners can submit one immutable integer 1-to-5 rating per eligible Enrollment, with no comment,
edit, moderation, or public display. Admin statistics expose count, average, and the complete
1-to-5 distribution globally and per Training. The Web workspace includes Learner generation,
download, and rating controls, Admin issuance/satisfaction views, and relevant Trainer Certificate
history.

Phase 10 requires no seed, backfill, or one-off data migration. Backend startup creates unique
Certificate indexes for Enrollment and number plus Feedback Enrollment and Training/rating
indexes. Existing Enrollments remain valid and produce records only on an authorized request after
current eligibility is recalculated. Generated PDFs live below the persistent configured
`UPLOAD_DIR`; preserve and back up that volume together with MongoDB.

## Phase 11 status

Phase 11 adds Admin-only monthly `TrainerCost` upserts, unique by Trainer/year/month, and explicit
dated `TrainingCost` records optionally linked to a matching Session. All money remains positive
integer EUR centimes. The backend calculates operational counts, schedule-based participation,
self-paced progression, Evaluation results, satisfaction, paid revenue, costs, result, and
profitability through MongoDB aggregations over explicit inclusive `Africa/Tunis` calendar-date
ranges. Trainer costs apply only when the selected range contains their complete calendar month.
Zero revenue returns `null` profitability. Per-Training reporting subtracts explicit Training
costs only and is labelled as result before fixed Trainer costs; salaries are never inferred or
allocated to a Training.

The responsive Admin Web dashboard provides period filtering, loading/error/empty states, the
centre metrics, monthly Trainer-cost upserts, and Training-cost create/edit/delete workflows.
OpenAPI documents every cost and dashboard endpoint.

Phase 11 requires no seed, backfill, or one-off data migration. Backend startup creates the unique
Trainer/month index and the Trainer calendar, Training-cost period, and Training/Session target
indexes. Existing Payments, Enrollments, Attendance, progress, Evaluations, and Feedback remain
unchanged; dashboard values are calculated from their existing persisted records.

## Phase 12 status

Phase 12 completes the Web product and hardening work planned after the domain slices:

- public website pages, shared public/authenticated layouts, and role-specific Admin, Trainer, and
  Learner navigation;
- responsive catalogue, training, session, payment, content, progress, evaluation, certificate,
  feedback, user-management, attendance, and profitability workflows;
- consistent pagination and reusable loading, error, empty, validation, conflict, and success
  states across the Web client;
- keyboard-accessible controls, visible focus states, semantic labels, responsive layouts, and
  mobile-width Web behavior;
- completed OpenAPI coverage and backend authorization/validation for the exposed workflows;
- security-focused checks for authentication, protected files, Stripe webhook handling, upload
  validation, redacted logs, and test-only configuration boundaries;
- critical Web and real-replica-set workflow verification through the existing test commands.

## Phase 13 status

Phase 13 completes the Expo/React Native application through roadmap item 13.9. Mobile now uses
the same backend contracts for secure rotating-token authentication, catalogue and Training
management, self-paced content/progress, Sessions and schedules, Stripe Checkout and paid
Enrollments, Evaluations and AI-assisted draft review, protected Invoices/Certificates/resources,
Feedback, Attendance, Admin users/categories/costs, and backend-calculated dashboard statistics.
The interface uses native stacks, safe areas, touch-sized cards/forms, pull-to-refresh, system
browser Checkout, application deep links, SecureStore, and Expo download/share/picker APIs; no
mobile-specific backend or duplicated business rule was introduced.

The only shared contract extension is client-aware return routing. `MOBILE_APP_SCHEME` must match
`EXPO_PUBLIC_APP_SCHEME` and the Expo `scheme` value. Mobile forgot-password requests receive a
`plateforme-formations://reset-password?token=…` link, and Mobile Stripe Checkout returns to
`plateforme-formations://payments/success|cancel?paymentId=…`. A return link never proves payment:
Mobile always reloads the Payment whose status is confirmed by the backend webhook.

Phase 13 adds no collection, migration, database index, seed, or Firebase dependency. Firebase
remains the optional Web Analytics preparation described below.

## Prerequisites

- Node.js 24.19 or newer in the Node 24 line
- npm 11.17 or newer
- Docker Desktop with Docker Compose

## Local setup

This is the reproducible setup for a fresh machine. Do not copy `node_modules`, build output,
local uploads, or `.env` files from the old machine. Clone or copy the repository, then recreate
those machine-specific files and restore data only when required.

1. Install Node.js 24.19+ in the Node 24 line, npm 11.17+, and Docker Desktop with Docker Compose.
   On Windows, enable the Docker Desktop WSL 2 backend and ensure Docker is running before
   starting Compose. Git is also required if the repository will be cloned.
2. Clone the repository and open a terminal at its root.
3. Install the workspace dependencies:

```sh
npm ci
```

4. Copy the examples before running applications directly:

```powershell
Copy-Item Web/backend/.env.example Web/backend/.env
Copy-Item Web/frontend/.env.example Web/frontend/.env
Copy-Item Mobile/.env.example Mobile/.env
```

5. Replace every placeholder with a suitable local value. The backend fails before listening when
   required configuration is missing or invalid. It accepts Stripe test keys only. Empty SMTP user
   and password values select an unauthenticated local SMTP server; otherwise both values are
   required. Keep all real secrets out of Git.

To inspect the local application database in MongoDB Compass, create a connection with:

```text
mongodb://localhost:27017/plateforme_formations?directConnection=true
```

Use the `plateforme_formations` database shown by that connection. MongoDB's `admin`, `config`,
and `local` databases are system databases and should be left intact.

For the normal Docker path, the repository-root `.env` is optional. Copy `.env.example` to `.env`
only when overriding Compose Stripe or Gemini values:

```powershell
Copy-Item .env.example .env
```

The root `.env`, all workspace `.env` files, `uploads/`, and Docker volumes are intentionally
ignored by Git. If moving an existing development installation, transfer secrets through a secure
channel and restore data only as described in [Data backup and restore](#data-backup-and-restore).
Never commit secrets.

Run an individual application from the repository root:

```sh
npm run dev:backend
npm run dev:frontend
npm run dev:mobile
```

The Web client is available at the Vite URL printed in the terminal (normally
`http://localhost:5173`). For Android Emulator, the checked-in Mobile example uses
`http://10.0.2.2:3000/api` because that address maps to the host machine. A physical device needs
the host PC's LAN IP instead, and the device and PC must be on the same network. Do not expose the
backend to an untrusted network.

Copy `Mobile/.env.example` to the ignored `Mobile/.env` when its defaults do not match the target
device. `EXPO_PUBLIC_API_BASE_URL` must end at the shared backend `/api`; do not put secrets in an
`EXPO_PUBLIC_*` variable. Password reset and Stripe browser returns require the same scheme in
`Mobile/app.json`, `EXPO_PUBLIC_APP_SCHEME`, and backend `MOBILE_APP_SCHEME`.

Mobile verification commands are:

```sh
npm run typecheck --workspace Mobile
npm run lint --workspace Mobile
npm run test --workspace Mobile
npm exec --workspace Mobile -- expo-doctor
npm exec --workspace Mobile -- expo export --platform all --output-dir dist
```

The generated `Mobile/dist` directory is ignored. Android Emulator and physical-device API host
rules still apply as described above.

The backend expects a transaction-capable MongoDB replica set. The easiest supported local path
is Compose:

```sh
npm run docker:up
```

Compose builds the backend, initializes the idempotent `rs0` replica set, waits for database and
API health, starts a local SMTP capture service, and binds exposed ports to loopback only. Its
checked-in credentials and provider values are non-production placeholders used to validate
integration boundaries; they do not grant access to any external service.

`plateforme-formations-mongodb-init-1` is intentionally a one-shot initialization container. It
waits for MongoDB, creates or confirms replica set `rs0`, and then exits with status 0. An
`Exited (0)` state is success, not an unavailable database; the long-running `mongodb` and
`backend` services should remain healthy.

Useful endpoints after startup:

- API health: <http://127.0.0.1:3000/api/health>
- OpenAPI JSON: <http://127.0.0.1:3000/api/openapi.json>
- Swagger UI: <http://127.0.0.1:3000/api/docs/>
- Mailpit development inbox: <http://127.0.0.1:8025/>

Useful lifecycle commands:

```sh
npm run docker:config
npm run docker:logs
npm run docker:down
```

`docker:down` preserves the named `mongodb_data` and `backend_uploads` volumes. Deleting those
volumes destroys local database and uploaded-file data and is not part of the normal workflow.

After a fresh checkout, initialize a local Admin with `npm run seed:admin`, or populate the
complete deterministic demonstration dataset using [`Docs/DEVELOPMENT_SEED.md`](Docs/DEVELOPMENT_SEED.md).
The development seed is destructive and must target only the local MongoDB
database `plateforme_formations`.

## Initial Admin seed

Set `MONGODB_URI`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` in the untracked
`Web/backend/.env`, then run:

```sh
npm run seed:admin
```

The command creates an `ADMIN` only when no Admin exists. It normalizes the email, stores only a
salted password hash, marks the account active, and requires a password change at first login.
Repeated runs leave the existing Admin unchanged. If the configured email already belongs to a
non-Admin, the command fails instead of promoting that account. The MVP permits only the initial
Admin, enforced by a partial unique database index.

For local development, use the MongoDB connection string
`mongodb://localhost:27017/plateforme_formations?replicaSet=rs0&directConnection=true` in the
ignored `.env` file. Never commit or paste database credentials into source files, issue trackers,
or chat.

## Stripe test boundary

Phase 5 calls Stripe only in test mode. `STRIPE_SECRET_KEY` must begin with `sk_test_`, while the
checked-in defaults are inert placeholders that keep the local stack configurable but cannot create
a real Checkout Session. For a directly started backend, put the account's test secret key in the
untracked `Web/backend/.env`. For Compose, copy the repository-root `.env.example` to `.env` and
replace its Stripe placeholders; Compose reads those ignored overrides without changing tracked
YAML.

**Important: every local Stripe Checkout test requires a running Stripe CLI listener.** Stripe
does not deliver Dashboard events to `localhost`, and the Docker backend does not start this host
process for you. Start this command in a separate terminal *before* testing Checkout, and leave it
running for the entire test session:

```powershell
stripe listen --forward-to http://127.0.0.1:3000/api/payments/webhook/stripe
```

Copy the `whsec_...` secret printed by that command into `STRIPE_WEBHOOK_SECRET` and restart the
backend whenever the value changes. If the listener is stopped, Checkout can succeed in Stripe
while the application remains at **En attente du webhook** because no event reaches
`/api/payments/webhook/stripe`. Checkout redirects are never treated as proof of payment: the Web
client waits for backend status, and only a verified successful webhook can create the Enrollment
and Invoice. Automated tests use an injected Checkout adapter and locally signed webhook fixtures,
so they create no Stripe objects or charges. Never place account secrets in Compose or Git.
Production support for a Tunisia-established Stripe account remains a separate pre-launch
readiness check.

## Gemini AI question generation

This implementation uses the Gemini API. Create a Gemini API auth key in Google AI Studio and
keep it backend-only. For Docker Compose, put these values in the ignored repository-root `.env`:

```dotenv
AI_API_KEY=your_real_gemini_key
AI_MODEL=gemini-3.7-flash
AI_MAX_CONTEXT_CHARS=100000
```

For `npm run dev:backend` without Compose, put the same values in the ignored
`Web/backend/.env` instead. Do not add the key to Web, Mobile, tracked `.env.example` files,
source code, or `docker-compose.yml`. Leave `AI_BASE_URL` empty for Google's normal endpoint and
restart/rebuild the backend after changing environment values.

When an owner clicks **Générer avec Gemini**, the backend gathers only that Evaluation's selected
Training context, sends bounded educational text with a strict JSON schema, validates the response
locally, and imports editable questions into the `DRAFT` Evaluation. It never sends Learner,
Attendance, Payment, or other Training data, and it never publishes. Production use still sends
Training content to an external provider, so use the centre's approved Google project, quota,
billing, and data policy.

## Quality and CI

The former `Docs/DEPLOYMENT.md` and `Docs/BACKUP_RESTORE.md` files are no longer present. The
operational instructions that were needed from them are kept in this README under [Deployment
and operations](#deployment-and-operations) and [Data backup and restore](#data-backup-and-restore).

Run the complete local quality gate:

```sh
npm run check
```

This checks formatting, linting, strict types (including tests), all workspace tests, and backend
and Web builds. `npm run ci` adds Compose configuration validation. GitHub Actions also builds and
starts the stack, checks the HTTP health endpoint and writable MongoDB primary, runs the Phase 1
through Phase 11 integration lifecycles, prints logs on failure, and removes only its disposable CI
volumes. The workflow is defined in `.github/workflows/ci.yml` and runs on pushes to `main` and on
pull requests.

To run that transaction-backed integration lifecycle locally after Compose is healthy:

```powershell
$env:TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/plateforme_formations_integration?replicaSet=rs0&directConnection=true'
npm run test:integration
```

To run the consolidated Phase 12 critical Web and real-API workflow suite:

```powershell
$env:TEST_MONGODB_URI = 'mongodb://127.0.0.1:27017/plateforme_formations_integration?replicaSet=rs0&directConnection=true'
npm run test:e2e
```

The suite covers learner online and in-person prerequisites, Trainer management, attendance and
evaluation duties, and Admin identity, catalogue, Session, payment, statistics, and Certificate
operations across the phase integration lifecycles.

The integration command accepts only the dedicated
`plateforme_formations_integration` database name and cleans that test database's phase-specific
collections before and after each integration suite.

## Deployment and operations

The checked-in Compose stack is a development and integration environment, not a production
deployment. It uses placeholder credentials, local MongoDB storage, Mailpit, loopback port
bindings, and Stripe test mode. Before any production deployment, provide a managed or hardened
MongoDB replica set, secret storage and rotation, TLS/reverse proxy, restricted network access,
real SMTP, monitored persistent upload storage, and a verified Stripe account/configuration.

For local operation, verify the stack before using it:

```powershell
docker compose config --quiet
docker compose up --build --detach --wait
Invoke-WebRequest http://127.0.0.1:3000/api/health
docker compose ps
```

The API is ready only when MongoDB is healthy and writable and the backend health endpoint returns
success. The `mongodb-init` container is expected to exit with code 0 after creating or confirming
replica set `rs0`. Monitor `docker compose logs --follow` and stop the stack with
`docker compose down`; do not add `--volumes` unless the local data is intentionally disposable.

## Data backup and restore

The application state consists of the MongoDB database and the `backend_uploads` volume. Back up
both together; restoring only MongoDB can leave Certificate or Resource file references broken.
For a local Compose backup, first stop writes and create a Mongo archive plus an upload-volume
archive from a temporary container:

```powershell
New-Item -ItemType Directory -Force .local-backups | Out-Null
docker compose exec --no-TTY mongodb mongodump --archive --gzip --db plateforme_formations > .local-backups\plateforme_formations.archive.gz
docker run --rm -v plateforme-formations_backend_uploads:/data:ro -v ${PWD}\.local-backups:/backup alpine tar czf /backup/backend_uploads.tar.gz -C /data .
```

The exact volume name is based on the Compose project name; check it with `docker volume ls` if the
project was started with a different name. Store backup files outside Git, protect them like
production data, and test restores periodically.

To restore into a disposable local environment, start MongoDB and its dependencies, restore the
database, restore the upload archive into the upload volume, then restart the backend:

```powershell
docker compose up --detach --wait mongodb mongodb-init mailpit
Get-Content .local-backups\plateforme_formations.archive.gz -Raw -AsByteStream | docker compose exec -T mongodb mongorestore --archive --gzip --drop
docker run --rm -v plateforme-formations_backend_uploads:/data -v ${PWD}\.local-backups:/backup alpine sh -c "rm -rf /data/*; tar xzf /backup/backend_uploads.tar.gz -C /data"
docker compose up --detach --wait backend
```

Validate `/api/health`, login, a representative protected file download, and a certificate
download after restoration. Do not use `--drop` or overwrite a non-disposable environment without
an approved recovery procedure and a verified backup.

## Backend environment contract

The complete annotated contract is in `Web/backend/.env.example`. It covers application/database,
JWT lifetime and secret values, SMTP, Stripe test mode, local uploads, the backend-only AI adapter,
and immutable centre identity. Defaults are limited to the values documented by `PLAN.md`:
`PORT=3000`, `TZ=UTC`, `LOG_LEVEL=info`, access JWT 15 minutes, refresh token 7 days, password reset
30 minutes, upload size 20 MB, and AI context 100,000 characters.

Web and Mobile build-time public values live in their respective `.env.example` files. Secret
provider values must remain backend-only.

## Firebase Analytics (Web)

The Web client has an optional Firebase Analytics integration. It is disabled by
default, makes no backend/API changes, and tracks consented client-side route page
views plus privacy-safe recommendation impressions, clicks, and backend-confirmed
recommendation enrollments when all Firebase values below are provided and
`VITE_FIREBASE_ANALYTICS_ENABLED=true`. The recommendation event model and reporting
setup are documented in [`Docs/AI_RECOMMENDATIONS_PHASE1.md`](Docs/AI_RECOMMENDATIONS_PHASE1.md).

Create one Firebase project for the platform and register the Web client as a Web
app. Enable Google Analytics for the Firebase project, then copy the Web app
configuration values from **Project settings > Your apps** into the ignored
`Web/frontend/.env` file:

```dotenv
VITE_FIREBASE_ANALYTICS_ENABLED=true
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=G-...
```

These are public client configuration identifiers, not service-account secrets.
Do not add a Firebase service-account key to the Web client or commit `.env` files.
Before enabling production collection, ensure the centre's privacy notice and any
required visitor-consent process cover Analytics. Firebase Analytics must not receive
emails, user IDs, payment references, or other personal data.

When the Mobile phase starts, register the Android and iOS applications in this same
Firebase project; they will have their own app identifiers and configuration files.
That future FCM work will use a backend-only service-account credential.

## Architecture boundaries

`Web/backend` is the only backend for both clients. Business rules, validation, and authorization
belong there. Client packages may handle presentation and local interaction state but must not
duplicate backend business decisions. New functionality should be added phase-by-phase as the
vertical slices in `PLAN.md`; later-phase entities and workflows should not be scaffolded early.
