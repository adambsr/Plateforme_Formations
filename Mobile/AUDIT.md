# Mobile parity audit

Audit date: 2026-08-23

## Authority and active roadmap phase

The implementation follows `Docs/SOURCE_OF_TRUTH.md`, then `PLAN.md`, then
`Docs/MOBILE_DEVELOPMENT_PROMPT.md`. Web phases 0 through 12 are reported complete, so the active
roadmap phase is Phase 13. Mobile must consume the shared REST API and must not reproduce backend
business rules.

Phase 13 is ordered as follows:

1. configuration, API client, secure authentication, and role navigation;
2. catalogue and Training details;
3. self-paced content and progress;
4. Sessions and schedules;
5. Checkout and paid Enrollment state;
6. Evaluations, Certificates, Invoices, and Feedback;
7. Trainer Sessions and Attendance;
8. relevant Admin views;
9. integration and device E2E stabilization.

## Repository snapshot before Phase 13 work

Mobile contained an Expo/React Native application with one static shell screen, the default Expo
image assets, environment examples, strict TypeScript, and one application-configuration test. It
had no navigation, API client, authentication state, secure storage, domain types, feature
screens, reusable theme, loading/error states, or API integration.

The Web application is the implemented product reference. It contains:

- public landing, catalogue, Training detail, about, FAQ, and contact pages;
- Learner-only registration, login, forgot/reset/change password, profile, and guarded routes;
- role dashboards and role-specific navigation;
- Training/category/content management for Admin and Training owners;
- in-person Session planning and public Session availability;
- Learner progress and schedules plus Trainer/Admin Attendance;
- Stripe Checkout return, Payments, Enrollments, and Invoice downloads;
- Evaluation authoring/AI review, Learner attempts, and result views;
- Certificates, immutable satisfaction Feedback, explicit costs, and Admin statistics.

## Shared concepts and native adaptations

The API paths, DTO shapes, roles, statuses, error codes, validation constraints, EUR money rules,
and `Africa/Tunis` time semantics are shared conceptually. They remain backend-authoritative.

The following must be implemented natively rather than copied from Web:

- native stack/tab navigation instead of React Router and desktop sidebars;
- secure platform storage for the refresh token instead of an HttpOnly cookie;
- in-memory access tokens with a Mobile refresh request body;
- touch targets, safe areas, keyboard avoidance, scroll behavior, and native accessibility;
- hosted Checkout through the system browser and deep-link return handling;
- protected downloads saved/shared through Expo-supported file APIs rather than browser blobs;
- compact cards and lists instead of desktop tables or multi-column management layouts.

## Current parity gaps by functional area

| Area                           | Web      | Mobile before Phase 13 | Priority |
| ------------------------------ | -------- | ---------------------- | -------- |
| Configuration/theme            | Complete | Expo defaults only     | 13.1     |
| API/auth/session               | Complete | Missing                | 13.1     |
| Role navigation/profile        | Complete | Missing                | 13.1     |
| Catalogue/detail               | Complete | Missing                | 13.2     |
| Content/progress               | Complete | Missing                | 13.3     |
| Sessions/schedules             | Complete | Missing                | 13.4     |
| Checkout/Enrollment/Payments   | Complete | Missing                | 13.5     |
| Evaluations/documents/Feedback | Complete | Missing                | 13.6     |
| Trainer Attendance             | Complete | Missing                | 13.7     |
| Admin operations/dashboard     | Complete | Missing                | 13.8     |
| Mobile integration/device E2E  | Missing  | Missing                | 13.9     |

## Backend contract findings

No new endpoint is required for Phase 13.1. Login, registration, refresh, logout, password change,
profile read/update, and forgot-password already use the shared backend. The auth API explicitly
supports `client: "MOBILE"`, returns the raw refresh token only to Mobile, and rotates it on every
refresh.

Two later integration gaps need resolution without creating Mobile-only business logic:

- password-reset emails currently build only a `WEB_APP_URL` reset link, so a Mobile reset deep
  link is not yet selected by the forgot-password contract;
- Stripe success/cancel URLs are deployment-wide Web URLs, so Mobile Checkout return/deep-link
  selection is not yet represented in the Checkout request contract.

Both should be addressed in the shared backend contract at their relevant Phase 13 slice rather
than worked around by trusting Mobile state.

## Phase 13.1 implementation decision

The first slice introduces the Web-derived High Skills Academy design tokens, typed public
configuration, a normalized API client, secure refresh-token storage, rotating refresh and one
401 retry, Learner-only registration, login/forgot/change-password flows, profile editing, forced
password-change navigation, and role-aware authenticated workspaces. Later feature routes are not
scaffolded until their vertical slice is implemented.
