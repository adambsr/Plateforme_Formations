# AI modernization — public website concierge

## Purpose and separation

The public concierge is a small floating chatbot for anonymous visitors. It is
separate from the Phase 2 Learner tutor:

| Boundary | Public concierge | Learner course tutor |
| --- | --- | --- |
| Endpoint | `POST /api/public/concierge/messages` | `POST /api/trainings/:id/tutor/messages` |
| Authentication | None | Learner access token required |
| Knowledge | Curated public facts and published catalogue fields | Authorized lessons from one paid Training |
| Private data | Never queried | Enrollment checked before lesson retrieval |
| UI | Public floating widget | Embedded in enrolled course content |
| Conversation storage | None; bounded history is supplied by the browser | None; bounded history is supplied by the browser |

The widget is rendered only when `user === null` in `PublicLayout`. Signing in
removes it; it is not available inside role dashboards.

## Grounding and links

`PublicConciergeContextService` retrieves only:

- curated public page facts for `/`, `/catalogue`, `/register`, `/faq`,
  `/about`, and `/contact`;
- Trainings whose database status is exactly `PUBLISHED`;
- public Training fields such as title, description, category, level, duration,
  modality, objectives, prerequisites, and price.

It never loads users, enrollments, checkout records, progress, evaluations,
certificates, course Lessons, or authenticated dashboard data.

Gemini returns source identifiers, not URLs. `PublicConciergeService` rejects an
answer if any citation or action identifier is outside the retrieved source set,
then resolves approved relative URLs on the server. An unsupported question gets
a deterministic Contact fallback rather than an invented answer.

## Anonymous-abuse and cost controls

- 10 requests per source IP per 15-minute window;
- maximum visitor message: 1,000 characters;
- maximum recent history: 4 messages of 1,000 characters each;
- maximum retrieval context: 12,000 characters and 8 sources;
- maximum Gemini output: 1,200 tokens;
- 15-second timeout per Gemini attempt, with one short backoff retry for a
  transient 503/504/timeout; the public concierge uses
  `gemini-3.1-flash-lite` first for lower latency and keeps the configured model
  as an availability fallback;
- low temperature and structured JSON response validation;
- hidden honeypot field avoids an AI call for basic form-filling bots;
- no server-side chat persistence and no account identifier is required.

The current rate limiter is process-local, matching the rest of this application.
For multiple backend replicas, replace it with a shared Redis-backed limiter. When
deploying behind a reverse proxy, configure Express trusted-proxy rules for only
the known proxy so IP limits use the real client address without trusting spoofed
headers.

## Prompt-injection and privacy controls

The system instruction treats visitor messages, recent conversation, and even
admin-authored Training descriptions as untrusted data. It forbids following
instructions embedded in any of them and forbids private-data claims or access.
The response schema and server allowlists provide the enforcement boundary; the
prompt alone is not trusted as a security control.

The widget tells visitors that Gemini processes their question and asks them not
to submit passwords or payment-card data. Do not add analytics logging of raw
questions. If product analytics are added later, record only coarse events such
as widget opened, question sent, fallback shown, and public link clicked.

## Visitor experience

On a public page while signed out:

1. Select **Besoin d’aide ?** in the bottom-right corner.
2. Choose a suggested question or type a question.
3. Grounded answers show public source chips and server-authorized action links.
4. Unsupported questions show a clear limitation and a Contact action.
5. On mobile, the panel uses the available viewport height and retains a compact
   circular launcher.

## Verification

Run:

```powershell
npm.cmd test --workspace @plateforme-formations/backend -- public-concierge.test.ts
npm.cmd test --workspace @plateforme-formations/frontend -- PublicConcierge.test.tsx
npm.cmd run typecheck --workspace @plateforme-formations/backend
npm.cmd run typecheck --workspace @plateforme-formations/frontend
```

After rebuilding/restarting the backend, confirm the endpoint in
`http://localhost:3000/api/docs`, then open the landing page in a signed-out
browser. Ask about registration, payment, a published Training, and an unrelated
private-account question. The first three should cite public pages or Training
details; the last should fall back without disclosing or claiming account access.
