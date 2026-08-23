# Technical Implementation Plan

## 1. Purpose and authority

This document translates `Docs/SOURCE_OF_TRUTH.md` into an implementation architecture and recommended delivery order. It does not add product functionality and does not replace the Source of Truth.

Document precedence during development is:

1. `Docs/SOURCE_OF_TRUTH.md`
2. this implementation plan
3. the Web and Mobile development prompts

Where an older prompt example differs from the Source of Truth, the Source of Truth wins. In particular, the implemented payment statuses are only `PENDING`, `PAID`, `FAILED`, and `CANCELLED`; there is no refund or enrollment-cancellation workflow.

## 2. Locked scope decisions

The following decisions are resolved and must not be reopened during ordinary implementation:

- exactly three roles: `ADMIN`, `TRAINER`, and `LEARNER`;
- public registration creates Learners only;
- the first Admin is created by an idempotent CLI seed;
- an Admin creates Trainers with a temporary password;
- each Training has exactly one owner Trainer;
- a Session can have multiple assigned Trainers;
- exactly two immutable Training types: `SELF_PACED_ONLINE` and `IN_PERSON`;
- every Training has a strictly positive price in EUR;
- an Enrollment exists only after a successful Stripe webhook confirmation;
- Enrollment has no payment status, pending state, cancellation state, or refund state;
- no `SeatReservation`, unpaid entity, or separate overdue-payment concept;
- Sessions can contain multiple `SessionSchedule` dates;
- attendance statuses are only `PRESENT` and `ABSENT`;
- certificate eligibility is always recalculated by the backend;
- evaluation questions are objective and automatically graded;
- one immutable 1-to-5 Feedback is allowed per eligible Enrollment;
- Training type is immutable from creation;
- business timezone is `Africa/Tunis`, while instants are persisted in UTC;
- local persistent file storage is used for the MVP;
- AI extracts supported documents on demand and creates drafts only;
- EUR is the only currency, taxes are not calculated, and an Invoice is created automatically for a paid Payment;
- Trainer salary costs are monthly centre-level costs and are not allocated to Trainings;
- historical business records are retained; destructive deletion is limited to unused drafts;
- centre identity comes from environment configuration, not a settings entity or UI.

## 3. Target repository structure

Use the existing repository boundaries:

```text
Plateforme_Formations/
├── Docs/
│   ├── SOURCE_OF_TRUTH.md
│   ├── WEB_DEVELOPMENT_PROMPT.md
│   └── MOBILE_DEVELOPMENT_PROMPT.md
├── Web/
│   ├── backend/
│   └── frontend/
├── Mobile/
├── PLAN.md
├── docker-compose.yml
└── README.md
```

The backend is shared by the Web and Mobile clients. There is no mobile-specific backend and no direct database access from either client.

## 4. Functional modules

| Module | Responsibilities |
|---|---|
| Configuration | Typed environment loading, startup validation, centre identity, CORS, timezone, external-service configuration |
| Authentication | Registration, login, access JWT, refresh rotation, logout, password change/reset, forced first password change |
| Users | User lifecycle, profiles, Admin-managed Trainers and Learners, account deactivation |
| Training catalogue | Categories, Training CRUD, owner assignment/transfer, type-specific validation, publication and archive |
| Learning content | Modules, Lessons, Resources, ordering, protected file access, archival rules |
| Sessions and schedules | In-person Sessions, multiple schedule dates, Trainer assignment, capacity, room/Trainer conflict validation, status transitions |
| Payments | Stripe Checkout creation, technical Payment records, verified idempotent webhook processing |
| Enrollments and access | Paid Enrollment creation, duplicate prevention, capacity enforcement, content access checks |
| Progress | Per-Enrollment Lesson completion and derived self-paced completion percentage |
| Attendance | Per-Enrollment and per-Schedule attendance, completion coverage, attendance percentage |
| Evaluations | Draft authoring, question management, publication/archive, attempts, timer enforcement, automatic grading |
| AI generation | Authorized context construction, supported document extraction, structured draft generation and validation |
| Certificates | Eligibility service, unique Certificate record, immutable issuer/learner snapshots, PDF generation/download |
| Feedback | One eligible immutable 1-to-5 rating per Enrollment and Admin satisfaction aggregates |
| Invoices | Automatic one-per-paid-Payment Invoice, immutable snapshots, PDF materialization/download |
| Costs | Monthly Trainer costs and explicit Training/Session costs |
| Dashboard | Operational, learning, satisfaction, financial, and profitability aggregates |
| File management | Local persistence, metadata, validation, checksums, authorization, protected streaming, cleanup rules |
| API documentation | OpenAPI generation and endpoint/error/security documentation |

## 5. Roles and authorization

Authorization is enforced in backend services after authentication. Client guards only control navigation and presentation.

| Capability | Admin | Training owner | Assigned Session Trainer | Learner |
|---|---:|---:|---:|---:|
| Create public Learner account | Public route | Public route | Public route | Public route |
| Create/deactivate Trainer | Yes | No | No | No |
| Manage Learner accounts | Yes | No | No | Own profile only |
| Create Training | Yes, owner required | Yes, self becomes owner | Yes, self becomes owner | No |
| Edit/archive Training | Yes | Own Training | No | No |
| Transfer Training ownership | Yes | No | No | No |
| Manage modules/Lessons/Resources | Yes | Own Training | Read required content | Read enrolled content |
| Manage Sessions | Yes | Sessions of own Training | Assigned operational Session only | No |
| Assign Session Trainers | Yes | Own Training Sessions | No | No |
| Record attendance | Yes | When assigned or Admin | Assigned Sessions | No |
| Create/edit/publish Evaluation | Supervise/archive | Own Training | No | No |
| Generate Evaluation with AI | No authoring requirement | Own Training | No | No |
| Take Evaluation | No | No | No | Own enrolled Training |
| Create Stripe Checkout | No | No | No | Own purchase |
| View Payments/Invoices | All | No financial access implied | No financial access implied | Own only |
| Generate/view Certificate | All records subject to eligibility | Relevant results only | Relevant Session results only | Own only |
| Create Feedback | No | No | No | Own eligible Enrollment |
| View Feedback statistics | Yes | No per-Training view required | No | No public display |
| Manage costs/profitability | Yes | No | No | No |

Reusable authorization policies should express ownership and assignment checks, for example `requireAdmin`, `requireTrainingOwner`, `requireSessionAccess`, and `requireSelfOrAdmin`. Policies must query the relevant current records and must not trust IDs or roles supplied by clients.

## 6. Core data model

Use MongoDB with Mongoose and strict TypeScript DTOs. Store references as `ObjectId`s, monetary values as integer minor units, and timestamps as UTC `Date` values. Enable timestamps on mutable collections and use schema validation plus service-level invariants.

### 6.1 Identity and security

**User**

- normalized unique email;
- password hash;
- role enum;
- active flag;
- `mustChangePassword` flag;
- name and common profile fields;
- password-change timestamp.

**TrainerProfile** and **LearnerProfile**

- one-to-one with User when role-specific profile data is needed;
- no role duplication that could disagree with `User.role`.

**RefreshSession** and **PasswordResetToken** are technical security records, not business entities. They store token hashes, expiry/revocation metadata, and the owning User. Raw tokens are never persisted.

Important indexes:

- unique normalized `User.email`;
- TTL index for expired password-reset tokens;
- indexes on refresh-session `userId`, expiry, and revocation fields.

### 6.2 Training catalogue and content

**TrainingCategory**

- name, optional description, archive state.

**Training**

- title, description, category, level, duration, objectives, prerequisites;
- immutable `type`;
- strictly positive `priceMinor` and fixed currency `EUR`;
- exactly one `ownerTrainerId`;
- lifecycle `DRAFT`, `PUBLISHED`, `ARCHIVED`;
- `minimumAttendancePercent` only for `IN_PERSON`, default 80;
- optional `certifyingEvaluationId` referencing one published Evaluation.

**TrainingModule**

- Training reference, title, description, order, archive state.

**Lesson**

- Module and derived Training references, title, description, text content, instructions, order, archive state.

**TrainingResource**

- Lesson and derived Training references;
- type `FILE` or `EXTERNAL_URL`;
- title, description, order, visibility;
- protected storage metadata for a file or validated HTTP(S) URL for an external resource.

Important indexes:

- Training catalogue status/category/type indexes;
- `ownerTrainerId` for owner dashboards;
- unique order within parent Module/Lesson where practical;
- Training reference on all content for authorization and extraction queries.

Publication validation:

- a self-paced Training requires at least one Module containing at least one Lesson;
- an in-person Training may be published without a Session;
- checkout for an in-person Training requires a selected planned, non-cancelled Session with availability.

Training type is excluded from update DTOs and guarded again in the service layer.

### 6.3 Sessions, schedules, and attendance

**TrainingSession**

- parent in-person Training;
- title/identifier, capacity, location metadata;
- assigned Trainer IDs;
- lifecycle `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`;
- `enrolledCount` maintained only as the atomic capacity gate.

**SessionSchedule**

- Session reference;
- `startAt` and `endAt` UTC instants;
- optional location/room override where supported by the Session form;
- optional Module/Lesson references belonging to the parent Training;
- Trainer IDs limited to Trainers assigned to the Session.

Session start/end dates are derived from the earliest/latest schedule entries. A Session contains one or more schedule entries and therefore naturally supports examples such as ten teaching dates in April.

**Attendance**

- Enrollment reference;
- SessionSchedule reference;
- status `PRESENT` or `ABSENT`;
- recorded by and recorded timestamp.

Important indexes:

- unique `Attendance(enrollmentId, scheduleId)`;
- indexes on Session, schedule dates, assigned Trainers, and normalized room/location fields;
- service-level overlap query using `existing.startAt < proposed.endAt && proposed.startAt < existing.endAt`;
- atomic `enrolledCount < capacity` update when fulfilling a paid in-person purchase.

The Session cannot become `COMPLETED` until every Enrollment has Attendance for every SessionSchedule. Attendance becomes immutable after completion. Session deletion/cancellation is refused after any Enrollment exists.

### 6.4 Payment, enrollment, invoice

**Payment**

- Learner and purchase target;
- target Training plus optional Session;
- status `PENDING`, `PAID`, `FAILED`, or `CANCELLED`;
- amount/currency/title/Session snapshots;
- Stripe Checkout Session ID and relevant Stripe transaction references;
- timestamps and technical failure information safe for logs/UI.

**Enrollment**

- Learner;
- Training;
- optional Session, required only for in-person;
- exactly one successful Payment;
- creation timestamp;
- no status or payment-state field.

**Invoice**

- exactly one successful Payment;
- unique number, issue date, amount totals and `EUR`;
- immutable Learner, centre, purchase-description, and amount snapshots;
- PDF storage reference when materialized.

**InvoiceItem**

- exactly one enrollment purchase line for the Invoice;
- description, quantity 1, unit amount, total, and currency snapshots.

Required uniqueness and cardinality indexes:

- unique Stripe Checkout Session ID on Payment;
- unique `Enrollment.paymentId`;
- partial unique `Enrollment(learnerId, trainingId)` for self-paced Enrollment;
- partial unique `Enrollment(learnerId, sessionId)` for in-person Enrollment;
- unique `Invoice.paymentId`;
- unique Invoice number.

No Enrollment is created at checkout time. Failed or cancelled Payment records are technical history only. There is no Enrollment cancellation, refund, credit note, free Training, or re-enrollment to an equivalent target.

### 6.5 Progress

**LessonProgress**

- self-paced Enrollment;
- Lesson;
- completed flag and completion timestamp.

Use a unique `(enrollmentId, lessonId)` index. The percentage is calculated, never directly written. A new Lesson affects non-certified Enrollments. Progress contributing to an issued Certificate is immutable.

### 6.6 Evaluations and feedback

**Evaluation**

- Training and owner Trainer;
- title/instructions;
- lifecycle `DRAFT`, `PUBLISHED`, `ARCHIVED`;
- pass percentage, maximum attempts defaulting to 3, optional duration minutes;
- AI-generation metadata sufficient for technical traceability without storing learner data.

**EvaluationQuestion**

- Evaluation, order, points, prompt, optional explanation;
- type `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, or `TRUE_FALSE`;
- answer options and correct answer set.

**EvaluationAttempt**

- Evaluation, Learner, and Enrollment;
- status `IN_PROGRESS`, `PASSED`, or `FAILED`;
- started/submitted/expiry timestamps;
- score totals and percentage;
- immutable evaluation settings snapshot needed to grade consistently.

**EvaluationAnswer**

- Attempt, Question, selected answer set, awarded points;
- snapshot of the question data needed for durable result history.

**Feedback**

- Enrollment and Training;
- Learner;
- integer rating 1 through 5;
- creation timestamp only; no comments or edit state.

Important indexes:

- Evaluation by Training/status;
- at most one published certifying Evaluation reference on Training;
- Attempt by Learner/Evaluation and Enrollment;
- unique `Feedback.enrollmentId`;
- Feedback Training/rating index for aggregation.

### 6.7 Certificates and finance

**Certificate**

- unique Enrollment;
- unique certificate number;
- issue timestamp;
- immutable Learner, Training, relevant dates/duration, and centre identity snapshots;
- protected PDF storage reference.

**TrainerCost**

- Trainer, year, month, amount in EUR minor units, optional note;
- unique `(trainerId, year, month)`.

**TrainingCost**

- Training, optional Session, date, amount in EUR minor units, category/label.

All monetary calculations use integer minor units. There are no tax fields or floating-point financial calculations.

### 6.8 Historical data rules

- delete only unused drafts with no business history;
- archive published Training/content/Evaluations when removal is requested;
- deactivate Users with history;
- never hard-delete Payments, Invoices, Certificates, submitted Attempts, Attendance, or completed Progress;
- reject prohibited deletion with HTTP 409;
- never cascade-delete business history;
- delete a local file only when its owning Resource is hard-deleted and no reference remains.

## 7. Backend architecture

Use Node.js, TypeScript in strict mode, Express, Mongoose, and OpenAPI. Keep one deployable backend with feature modules and explicit shared infrastructure.

```text
Web/backend/src/
├── app.ts
├── server.ts
├── config/
├── infrastructure/
│   ├── database/
│   ├── files/
│   ├── mail/
│   ├── stripe/
│   ├── ai/
│   └── pdf/
├── middleware/
├── shared/
│   ├── errors/
│   ├── auth/
│   ├── pagination/
│   ├── money/
│   └── time/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── trainings/
│   ├── content/
│   ├── sessions/
│   ├── payments/
│   ├── enrollments/
│   ├── progress/
│   ├── attendance/
│   ├── evaluations/
│   ├── feedback/
│   ├── certificates/
│   ├── invoices/
│   ├── costs/
│   └── dashboard/
└── scripts/
    └── seed-admin.ts
```

Each feature follows:

```text
route -> validation DTO -> controller -> service -> model/repository
```

Controllers translate HTTP input/output only. Services own transactions, authorization-relevant lookups, state transitions, and business rules. Infrastructure adapters own external SDK and filesystem details.

Cross-module domain services should be limited to rules genuinely shared by several modules:

- `EnrollmentAccessService` for paid access;
- `CompletionService` for modality-specific completion;
- `CertificateEligibilityService` reused by Certificate and Feedback;
- `DocumentService` for Invoice/Certificate PDFs;
- `FinancialAggregationService` for dashboard calculations.

Use a central error format with a stable code, human-readable message, optional validated field errors, and correlation/request ID. Map validation to 400/422, authentication to 401, authorization to 403, missing records to 404, duplicate/state conflicts to 409, and unexpected failures to 500 without leaking internals.

MongoDB must run as a replica set in development/test so transactions are available for Stripe fulfillment. Do not introduce a queue, event bus, microservices, or generic domain-event framework for the MVP.

## 8. REST API structure

Use `/api` as the common base, JSON for structured data, multipart only for uploads, and protected streaming for file/PDF downloads. Apply pagination to collection endpoints and document every operation and error in OpenAPI.

### 8.1 Authentication and users

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/change-password
GET    /api/auth/me

GET    /api/users                         # Admin
GET    /api/learners                      # Admin
GET    /api/learners/{id}                 # Admin
GET    /api/trainers                      # Admin; authorized lookup where needed
POST   /api/trainers                      # Admin
GET    /api/trainers/{id}
PUT    /api/trainers/{id}                 # Admin or own profile as allowed
POST   /api/trainers/{id}/disable         # Admin
```

### 8.2 Training catalogue and content

```text
GET    /api/categories
POST   /api/categories                    # Admin
PUT    /api/categories/{id}               # Admin

GET    /api/trainings
GET    /api/trainings/{id}
POST   /api/trainings                     # Admin or Trainer
PUT    /api/trainings/{id}                # Admin or owner
DELETE /api/trainings/{id}                # unused draft only
POST   /api/trainings/{id}/publish        # Admin or owner
POST   /api/trainings/{id}/archive        # Admin or owner
PUT    /api/trainings/{id}/owner          # Admin only

POST   /api/trainings/{id}/modules
PUT    /api/modules/{id}
DELETE /api/modules/{id}
POST   /api/modules/{id}/lessons
PUT    /api/lessons/{id}
DELETE /api/lessons/{id}
POST   /api/lessons/{id}/resources        # multipart or URL DTO
PUT    /api/resources/{id}
DELETE /api/resources/{id}
GET    /api/resources/{id}/download       # authorized stream
```

### 8.3 Sessions and attendance

```text
GET    /api/sessions
GET    /api/sessions/{id}
POST   /api/sessions
PUT    /api/sessions/{id}
DELETE /api/sessions/{id}                 # no Enrollment/Payment history
POST   /api/sessions/{id}/cancel
PUT    /api/sessions/{id}/trainers
POST   /api/sessions/{id}/start
POST   /api/sessions/{id}/complete

POST   /api/sessions/{id}/schedules
PUT    /api/schedules/{id}
DELETE /api/schedules/{id}

GET    /api/sessions/{id}/attendance
PUT    /api/schedules/{id}/attendance     # authorized bulk upsert
```

### 8.4 Checkout, payments, enrollments, and documents

```text
POST   /api/payments/checkout
GET    /api/payments
GET    /api/payments/{id}
POST   /api/payments/webhook/stripe       # raw body + Stripe signature

GET    /api/enrollments
GET    /api/enrollments/{id}

GET    /api/progress
PUT    /api/progress/lessons/{lessonId}

GET    /api/invoices
GET    /api/invoices/{id}
GET    /api/invoices/{id}/pdf
```

There is no public Enrollment creation endpoint. The Stripe webhook creates the Enrollment.

### 8.5 Evaluations, certificates, and feedback

```text
GET    /api/evaluations
GET    /api/evaluations/{id}
POST   /api/evaluations
PUT    /api/evaluations/{id}
DELETE /api/evaluations/{id}              # draft only
POST   /api/evaluations/{id}/generate-ai
POST   /api/evaluations/{id}/publish
POST   /api/evaluations/{id}/archive
POST   /api/evaluations/{id}/questions
PUT    /api/questions/{id}
DELETE /api/questions/{id}
POST   /api/evaluations/{id}/attempts
PUT    /api/attempts/{id}/answers
POST   /api/attempts/{id}/submit
GET    /api/evaluations/{id}/results

GET    /api/certificates
GET    /api/certificates/{id}
POST   /api/certificates/generate
GET    /api/certificates/{id}/pdf

POST   /api/feedback
GET    /api/feedback                      # Admin
```

### 8.6 Costs and dashboard

```text
GET    /api/costs/trainers
PUT    /api/costs/trainers/{trainerId}/{year}/{month}
GET    /api/costs/trainings
POST   /api/costs/trainings
PUT    /api/costs/trainings/{id}
DELETE /api/costs/trainings/{id}

GET    /api/dashboard/overview
GET    /api/dashboard/participation
GET    /api/dashboard/progress
GET    /api/dashboard/satisfaction
GET    /api/dashboard/financial
GET    /api/dashboard/profitability
```

List filters, sorting, pagination, and date-range semantics must be consistent across endpoints. Financial date boundaries are interpreted in `Africa/Tunis` and converted to UTC by the backend.

## 9. Authentication architecture

1. Hash passwords with a current adaptive password hash and never log credentials.
2. Issue a 15-minute signed access JWT containing the User ID and role.
3. Issue a random 7-day refresh token; store only its cryptographic hash in `RefreshSession`.
4. Rotate the refresh token on every refresh and revoke the previous session token.
5. Store the Web refresh token in an `HttpOnly` cookie with production `Secure` and an explicitly configured `SameSite` policy.
6. Return the mobile refresh token through the authenticated response for storage in the platform secure store.
7. Keep the Web access token in memory; do not use browser local storage for it.
8. Re-read the User on protected requests so deactivation blocks an otherwise valid access JWT.
9. Revoke all refresh sessions on password change, password reset, or account deactivation.
10. Force seeded Admins and newly created Trainers through password change before other protected operations.
11. Use hashed, single-use, 30-minute reset tokens delivered through configured SMTP.
12. Rate-limit login, refresh, forgot-password, reset-password, and Checkout creation.

The seed script uses `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`, creates an Admin only when none exists, and exits without changing an existing Admin.

## 10. Payment and enrollment architecture

### Checkout request

1. Authenticate the Learner.
2. Load the published Training and, for in-person, the selected planned Session.
3. Reject an equivalent existing Enrollment.
4. Validate positive server-owned EUR price.
5. For in-person, pre-check non-cancelled status and available capacity.
6. Create one `PENDING` Payment with immutable purchase snapshots.
7. Create a Stripe Checkout Session using the server amount and internal Payment ID metadata.
8. Persist the Stripe Checkout Session ID and return its hosted URL.

### Webhook fulfillment

1. Read the raw request body and verify the Stripe signature.
2. Locate the Payment by the trusted internal/Stripe reference.
3. Verify target, amount, currency, and successful Stripe payment status.
4. Start a MongoDB transaction.
5. Make the Payment transition idempotently to `PAID`.
6. Re-check the equivalent-Enrollment unique constraint.
7. For in-person, atomically increment `TrainingSession.enrolledCount` only when below capacity.
8. Create the Enrollment referencing the successful Payment.
9. Create the unique Invoice and its one InvoiceItem with immutable snapshots.
10. Commit and return success; repeated delivery returns the existing result.

Invoice PDF materialization can occur idempotently on first authorized download so webhook correctness does not depend on a long PDF operation. The Invoice business record itself is created automatically in the webhook transaction.

Checkout expiry/cancellation and supported Stripe failure events update only the technical Payment status. They create no Enrollment or Invoice. The client success page polls or reloads Payment/Enrollment state; it never grants access from a redirect parameter.

Capacity uses the simple pre-check plus atomic fulfillment gate required by the Source of Truth. No reservation model or capacity-expiration workflow is introduced.

## 11. Completion, evaluations, feedback, and certificates

### Completion service

- self-paced completion: completed active Lessons divided by applicable active Lessons equals 100%;
- in-person completion: Session is `COMPLETED` and Attendance percentage meets the Training threshold;
- resource views are informational only;
- already issued Certificates retain their eligibility snapshot when content changes.

### Evaluation authoring and lifecycle

- only the Training owner creates and edits Evaluation content;
- Admin can supervise and archive;
- only `DRAFT` is editable;
- publication validates at least one valid question, positive total points, pass threshold 1-100, positive attempt limit, and valid optional duration;
- published Evaluations are immutable and may later be archived;
- a certifying Evaluation must be published and cannot be archived while designated.

### Attempts and grading

- an enrolled Learner starts one server-timestamped Attempt;
- remaining time derives from server timestamps, not a trusted client timer;
- submission/expiry consumes an attempt;
- exact-set matching is used for multiple choice and no partial credit exists;
- the backend computes points, percentage, and `PASSED`/`FAILED`;
- submitted/expired attempts and answers become immutable;
- correct answers are returned only after a pass or the last permitted attempt.

### AI generation

- the owner requests generation for a specific draft Evaluation;
- the backend gathers only that Training's Module/Lesson text and extractable Resources;
- the provider receives no learner, attendance, or financial data;
- provider output must parse against the question DTO schema;
- valid output is stored as draft questions for owner review;
- the AI never publishes or designates an Evaluation as certifying.

### Certificate eligibility and generation

- require an Enrollment;
- require modality-specific completion;
- require at least one passed Attempt only when the Training has a certifying Evaluation;
- recalculate on every generation request;
- use a unique Enrollment index so repeated requests return the same Certificate;
- snapshot learner, Training, completion, and issuer identity values;
- generate or regenerate the protected PDF without changing its number or creating another Certificate.

### Feedback eligibility

Reuse the same completion and certifying-Evaluation checks as certificate eligibility. Accept one integer rating from 1 to 5 for the Enrollment, then make it immutable. Do not implement comments, edits, public ratings, moderation, or recommendations.

## 12. File and AI document management

Store files under the configured `UPLOAD_DIR` using generated storage names and relative paths. The directory must be a persistent mounted volume and the MVP runs one backend instance against it.

Upload processing must:

- enforce configurable size limits before full processing where possible;
- validate extension, declared MIME type, and file signature;
- reject path traversal and never use the original filename as the storage path;
- calculate a checksum;
- persist metadata only after successful storage, cleaning up failed partial files;
- stream downloads only after backend authorization;
- set safe content-disposition and content-type headers.

On-demand AI extraction supports only text PDFs, DOCX, PPTX, and TXT. Extraction failures skip that resource when other usable text exists; generation fails clearly when no usable text exists. Do not add OCR, URL crawling, embeddings, vector storage, RAG, or distributed object storage.

Invoice and Certificate PDFs use the same protected storage service but separate internal namespaces. A small PDF library is preferable to browser-based rendering because the required documents are structured and this avoids deploying a headless browser.

## 13. Statistics and profitability

All dashboard computations are backend MongoDB aggregations with explicit date ranges.

Operational metrics:

- counts of Trainings, Sessions, Learners, Trainers, and Enrollments;
- participation based on recorded `PRESENT` values over expected schedule attendance;
- self-paced completion/progression;
- Evaluation pass/result summaries;
- Feedback count, average, and 1-to-5 distribution globally and per Training.

Financial metrics:

```text
confirmed revenue = sum(Payment.amountMinor where status = PAID)
trainer costs     = monthly TrainerCost values for selected full calendar months
training costs    = explicit TrainingCost values dated in the selected period
result            = confirmed revenue - trainer costs - training costs
profitability %   = result / confirmed revenue * 100
```

Return profitability as `null` when revenue is zero. A Training-level view may show revenue minus explicit TrainingCost only and must label it as result before fixed Trainer costs, not complete Training profitability.

Do not compute taxes, allocate Trainer salary to Trainings/Sessions, infer missing costs, or use failed/cancelled Payments as revenue.

## 14. Web frontend architecture

Use React and TypeScript with React Router, React Hook Form, a schema validator aligned with API DTOs, and one HTTP/query layer. A lightweight server-state library is appropriate; do not duplicate backend business logic in a global client store.

```text
Web/frontend/src/
├── app/
│   ├── routes/
│   ├── layouts/
│   └── providers/
├── core/
│   ├── api/
│   ├── auth/
│   ├── guards/
│   ├── config/
│   └── types/
├── shared/
│   ├── components/
│   ├── forms/
│   ├── hooks/
│   ├── utils/
│   └── styles/
└── features/
    ├── auth/
    ├── dashboard/
    ├── users/
    ├── trainings/
    ├── content/
    ├── sessions/
    ├── enrollments/
    ├── progress/
    ├── attendance/
    ├── payments/
    ├── invoices/
    ├── evaluations/
    ├── feedback/
    ├── certificates/
    └── costs/
```

Frontend rules:

- one API client handles base URL, access JWT, one refresh retry, and normalized errors;
- role/ownership-aware routing controls UX but the API remains authoritative;
- route-level loading plus local mutation states prevent duplicate submissions;
- every list/detail handles loading, empty, error, retry, and pagination states;
- forms use API-compatible validation but display backend conflict errors;
- times are entered/displayed in `Africa/Tunis`; API values include an offset or `Z`;
- all money is formatted as EUR from integer minor units;
- protected downloads use authenticated requests rather than public file URLs;
- Checkout redirects to Stripe's hosted URL, then return screens query backend state;
- feedback UI appears only after backend-reported eligibility;
- no cancellation/refund controls, free-price UI, Trainer public registration, settings UI, or public rating display.

Build complete role-specific workspaces from the Source of Truth screen inventory. Keep operational Admin/Trainer screens compact and task-focused, and ensure mobile-width Web layouts remain usable.

## 15. Mobile architecture

Implement Mobile only after the shared API and critical Web workflows are stable. Use React Native with TypeScript, role-aware navigation, the same API contracts, and secure platform storage for the refresh token.

```text
Mobile/src/
├── app/navigation/
├── app/providers/
├── core/api/
├── core/auth/
├── core/storage/
├── core/config/
├── shared/components/
├── shared/hooks/
├── shared/theme/
└── features/
```

Mobile rules:

- access JWT remains in memory and refresh token uses secure storage;
- no MongoDB or AI-provider access from the application;
- use the common backend for all rules and calculations;
- open Stripe-hosted Checkout through the supported browser flow and return through configured deep links;
- confirm payment by querying the backend after the return, never from the deep link alone;
- use protected API downloads for Resources, Invoices, and Certificates;
- provide loading, empty, error, retry, and interrupted-connection states;
- prioritize Learner workflows and Trainer attendance; add Admin screens only as listed and practical for the mobile phase;
- preserve the same terminology and visual identity as Web without copying desktop layout.

## 16. Required environment variables

Validate required backend variables at startup and expose a typed configuration object. Test environments may supply deterministic non-production values.

### Backend application and database

```text
NODE_ENV
PORT
MONGODB_URI
WEB_APP_URL
CORS_ORIGINS
TZ=UTC
LOG_LEVEL
```

`PORT`, `TZ`, and `LOG_LEVEL` may have documented development defaults. `MONGODB_URI`, allowed origins, and public Web URL are required outside unit tests.

### Authentication and bootstrap

```text
JWT_ACCESS_SECRET
JWT_ACCESS_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=7
PASSWORD_RESET_TTL_MINUTES=30
INITIAL_ADMIN_EMAIL
INITIAL_ADMIN_PASSWORD
```

Initial Admin variables are required by the seed command, not by every normal application start. Production secrets must be strong and must not enter Git.

### SMTP

```text
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

### Stripe test mode

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_SUCCESS_URL
STRIPE_CANCEL_URL
```

Only test-mode keys are accepted in development configuration.

### File storage

```text
UPLOAD_DIR
MAX_UPLOAD_SIZE_MB=20
```

### AI provider

```text
AI_API_KEY
AI_MODEL
AI_BASE_URL                 # optional only when supported by the selected provider
AI_MAX_CONTEXT_CHARS        # bounded technical limit with a documented default
```

The provider-specific adapter maps these values; no key is exposed to clients.

### Centre identity

```text
CENTER_NAME
CENTER_ADDRESS
CENTER_EMAIL
CENTER_PHONE                # optional
CENTER_REGISTRATION_ID      # optional
CENTER_LOGO_PATH            # optional
```

### Web build

```text
VITE_API_BASE_URL
VITE_CENTER_NAME            # non-sensitive display value when needed
VITE_CENTER_LOGO_URL        # optional build asset/reference
```

### Mobile build

```text
MOBILE_API_BASE_URL
MOBILE_APP_SCHEME
MOBILE_CENTER_NAME          # non-sensitive display value when needed
```

Final variable prefixes may follow the chosen React Native toolchain, but the values and security boundaries must remain the same.

## 17. Testing strategy

### Backend unit tests

- modality and publication validators;
- ownership/assignment policies;
- money and timezone utilities;
- progress and attendance calculations;
- automatic Evaluation grading and answer-release rules;
- completion, Certificate, and Feedback eligibility;
- financial/profitability formulas;
- AI response schema validation;
- deletion/history rules.

### Backend integration tests

Run against MongoDB configured for transactions and exercise real HTTP middleware.

- Learner registration and privileged-role rejection;
- Admin seed idempotence and Trainer creation/first password change;
- login, refresh rotation/reuse rejection, logout, reset, and deactivation;
- Training ownership, immutable type, positive EUR price, and publication constraints;
- protected uploads/downloads and extraction fixtures;
- multi-date Session planning, overlap detection, assignment, and status transitions;
- duplicate Enrollment and capacity constraints;
- Stripe signature rejection, valid event fulfillment, repeated events, Payment/Enrollment/Invoice cardinalities;
- no access before webhook-confirmed Enrollment;
- progress isolation per Enrollment;
- Attendance uniqueness, completeness, and immutability;
- Evaluation lifecycle, attempts, expiry, grading, and authorization;
- AI call mocking, context isolation, extraction fallback, and draft-only output;
- Certificate idempotence and PDF authorization;
- Feedback eligibility, uniqueness, immutability, and aggregates;
- Invoice PDF snapshots and authorization;
- cost and dashboard aggregation across Tunisia calendar boundaries;
- 409 responses for prohibited historical deletion.

External Stripe, SMTP, and AI calls are mocked in automated tests. Use signed Stripe fixture payloads to test the real webhook verification path.

### Web tests

- component/form tests with React Testing Library;
- API behavior tests with request mocking at the network boundary;
- route guards and role-specific navigation;
- loading/error/empty and conflict states;
- core Learner, Trainer, and Admin workflows;
- browser E2E for registration/login, catalogue, Checkout return state, progress, attendance, Evaluation, Certificate, and Feedback.

### Mobile tests

- React Native component and navigation tests;
- secure-session refresh behavior;
- role-specific screens;
- catalogue/content/progress;
- Session schedule and Trainer attendance;
- Checkout browser/deep-link return with backend confirmation;
- Evaluation, Certificate, Feedback, and offline/error states;
- a small device E2E smoke suite for critical flows.

### Document and security verification

- parse generated PDFs to assert number, learner, Training, amount/date, and centre snapshot values;
- visually inspect representative Invoice and Certificate PDFs;
- test path traversal, invalid file signatures, MIME mismatch, oversized files, and unauthorized downloads;
- test CORS, cookie flags, rate limits, ownership bypass attempts, mass-assignment, and secret/log redaction;
- verify the generated OpenAPI document and fail CI on schema generation errors.

## 18. Development phases and dependencies

Every phase is a vertical slice: schema, service, API, authorization, Web UI where relevant, tests, and documentation are completed together. Mobile starts after backend/Web contracts stabilize.

### Phase 0: Repository and engineering foundation

Deliver:

- Web backend/frontend and Mobile package scaffolds;
- strict TypeScript, linting, formatting, test runners, environment examples;
- Docker Compose with MongoDB replica set and persistent upload volume;
- CI commands and root documentation;
- typed configuration validation, error middleware, health endpoint, logging, OpenAPI shell.

Dependencies: none.

### Phase 1: Authentication and users

Deliver:

- User/Profile and security token models;
- Admin seed;
- Learner registration;
- Admin Trainer creation;
- login/access/refresh/logout/reset/change-password flows;
- forced first password change and deactivation;
- Web auth screens, providers, guards, and role layouts.

Dependencies: Phase 0.

### Phase 2: Training catalogue and ownership

Deliver:

- categories and Training model;
- owner policy and Admin ownership transfer;
- immutable type and positive EUR price;
- draft/publication/archive and deletion rules;
- public catalogue/detail and Admin/owner management UI.

Dependencies: Phase 1.

### Phase 3: Content and protected files

Deliver:

- Modules, Lessons, Resources, ordering and archive/delete constraints;
- local upload/download storage adapter and validation;
- self-paced publication checks;
- content authoring and authorized learner reading UI.

Dependencies: Phase 2.

### Phase 4: In-person Sessions and schedules

Deliver:

- Session and SessionSchedule models;
- multiple date UI;
- Trainer assignment and operational permissions;
- UTC storage, `Africa/Tunis` display/input, overlap detection;
- planned/start/complete/cancel transitions and deletion constraints.

Dependencies: Phases 1 and 2.

### Phase 5: Stripe, Enrollment, and Invoice core

Deliver:

- Payment, Enrollment, Invoice, and InvoiceItem models/indexes;
- Stripe test Checkout and raw-body verified webhook;
- transactional idempotent fulfillment and atomic capacity gate;
- paid access middleware;
- Payment/Enrollment/Invoice lists and Checkout-return UI;
- Invoice PDF generation/download.

Dependencies: Phases 2 and 4; MongoDB transactions from Phase 0.

This phase is the access boundary. No self-paced content completion or paid Session participation should be considered complete before it passes webhook-based Enrollment integration tests.

### Phase 6: Self-paced progression

Deliver:

- LessonProgress model and unique index;
- mark/unmark behavior;
- calculated percentage and completion service;
- certificate-lock behavior;
- Learner progress UI.

Dependencies: Phases 3 and 5.

### Phase 7: Attendance and in-person completion

Deliver:

- Attendance model and authorized bulk entry;
- only `PRESENT`/`ABSENT`;
- coverage gate before Session completion;
- threshold calculation and immutability;
- Trainer/Admin attendance and Learner schedule views.

Dependencies: Phases 4 and 5.

### Phase 8: Evaluations

Deliver:

- Evaluation/Question lifecycle and owner authoring;
- certifying-Evaluation designation;
- Learner Attempt/Answer flow, timer, automatic grading, result visibility rules;
- owner/Admin result views;
- complete authorization and grading tests.

Dependencies: Phases 3, 5, 6, and 7 for access and modality context.

### Phase 9: AI-assisted Evaluation generation

Deliver:

- supported document extractors;
- Training-only context builder with size bounds;
- backend AI adapter and structured-output validation;
- draft question import and owner review UI;
- explicit unsupported/no-text failure states.

Dependencies: Phases 3 and 8.

### Phase 10: Certificates and Feedback

Deliver:

- shared completion/eligibility service;
- Certificate record, numbering, issuer snapshots, protected PDF, idempotence;
- Feedback eligibility, unique immutable rating, Learner rating UI;
- Admin satisfaction count/average/distribution.

Dependencies: Phases 6, 7, and 8. AI Phase 9 is not required for manual Evaluations.

### Phase 11: Costs, statistics, and profitability

Deliver:

- monthly TrainerCost and explicit TrainingCost management;
- operational, learning, participation, satisfaction, and financial aggregations;
- correct zero-revenue behavior and month/date boundaries;
- Admin dashboard and profitability views.

Dependencies: Phases 5, 6, 7, 8, and 10.

### Phase 12: Web completion and hardening

Deliver:

- all required role screens and consistent navigation;
- pagination, accessibility, responsive behavior, and loading/error/empty states;
- end-to-end critical workflow suite;
- security review, OpenAPI completion, deployment docs, backup/volume instructions;
- no out-of-scope controls or entities.

Dependencies: Phases 1-11.

### Phase 13: React Native application

Deliver in this order:

1. project/configuration, API client, secure auth, and role navigation;
2. catalogue and Training details;
3. self-paced content/progress;
4. Sessions and schedules;
5. Checkout and paid Enrollment state;
6. Evaluations, Certificates, Invoices, and Feedback;
7. Trainer Sessions and attendance;
8. relevant Admin views from the Source of Truth;
9. mobile integration/E2E stabilization.

Dependencies: stable OpenAPI and backend behavior from Phase 12. Mobile work may begin earlier for auth/catalogue only after those endpoint contracts are stable, but it must not fork the domain model.

## 19. Phase definition of done

A phase is complete only when:

- migrations/index initialization and seed implications are documented;
- models and DTOs compile under strict TypeScript;
- service rules and authorization are implemented server-side;
- API and OpenAPI are synchronized;
- relevant Web UI is integrated with real endpoints;
- loading, empty, validation, error, and conflict states are handled;
- unit/integration/E2E tests appropriate to risk pass;
- no secrets or sensitive data appear in code, responses, or logs;
- the Source of Truth rules for the feature are traceable in tests;
- changed setup/environment requirements are documented.

## 20. Known constraints and technical risks

These are implementation constraints, not unresolved product decisions:

| Risk | Required treatment |
|---|---|
| Stripe production support for a Tunisia-established account is not guaranteed | Keep development in Stripe test mode and perform a separate production-readiness check before launch |
| No seat reservation while capacity must never be exceeded | Use pre-check plus atomic `enrolledCount` gate; log and surface any fulfillment failure without creating excess Enrollment or inventing a reservation/refund domain |
| Local files limit horizontal scaling | Deploy one backend instance with a persistent, backed-up volume for the MVP |
| AI responses are non-deterministic | Bound context, require structured schema validation, persist draft only, and require owner review |
| Text extraction excludes scans and unsupported formats | Report unsupported/no-text cases explicitly; do not silently claim those files informed generation |
| Published content can change progress for non-certified Learners | Cover recalculation and Certificate-history immutability with integration tests |
| Trainer salary is not allocated per Training | Label Training-level financial results accurately and calculate complete profitability only globally |
| Web/Mobile prompts contain older illustrative payment lists | Follow the four statuses in the Source of Truth and this plan; do not implement `REFUNDED` |
| PDF files and document numbering must be idempotent | Protect uniqueness with database indexes and regenerate files against the existing business record |
| Timezone mistakes can corrupt schedule/conflict/financial boundaries | Centralize `Africa/Tunis` conversion and test DST/calendar boundaries even though timestamps are stored in UTC |

No remaining ambiguity blocks Phase 0 or the implementation order above. Provider/library choices that do not change behavior, such as the concrete AI SDK, PDF package, or React Native toolchain, are implementation selections to make at the phase boundary and record in technical documentation.

