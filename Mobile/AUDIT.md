# Mobile parity audit

Audit date: 2026-08-25

## Authority and scope

Implementation was audited against, in order, `Docs/SOURCE_OF_TRUTH.md`, `PLAN.md`, and
`Docs/MOBILE_DEVELOPMENT_PROMPT.md`, then against every Web feature and shared backend route.
Phase 13 is complete through 13.9. Mobile uses `Web/backend`; it has no database, Firebase data
access, Mobile-only API, or duplicated backend business rule.

## Phase 13 completion map

| Slice | Mobile result                                                                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13.1  | Validated public configuration, shared design tokens, normalized API errors, SecureStore refresh token, in-memory access token, rotation/single-flight retry, Learner registration, login/reset/change password, profile, logout, role guards and native navigation.                                                            |
| 13.2  | Public/authenticated catalogue, category/type filters, pagination, Training detail, thumbnails, native loading/error/empty/retry states.                                                                                                                                                                                        |
| 13.3  | Authorized modules/lessons/resources, backend-calculated lesson progress, certificate lock, external links, authenticated file download/share, and owner/Admin content authoring with file picker.                                                                                                                              |
| 13.4  | Public available Sessions, enrolled/managed role views, Session detail, Africa/Tunis schedules, staff Session CRUD, trainer assignment, lifecycle actions, and schedule CRUD.                                                                                                                                                   |
| 13.5  | Stripe system-browser Checkout, client-aware deep-link returns, backend Payment polling, paid Enrollment state, Payment/Enrollment/Invoice lists, and protected Invoice sharing.                                                                                                                                                |
| 13.6  | Learner Attempts with backend timer/scoring/reveal rules; Trainer draft creation, AI generation, manual question review/edit/delete, publication, certification designation and results; Admin supervision/archive; Certificate eligibility/idempotent generation/download; immutable 1–5 Feedback and satisfaction aggregates. |
| 13.7  | Role-filtered Session sheets, learner schedule/attendance percentage, touch attendance roster, complete bulk submission, and backend `canRecord`/immutability enforcement.                                                                                                                                                      |
| 13.8  | Admin dashboard KPIs/participation/progress/satisfaction/profitability, explicit Trainer/Training costs, trainer creation/edit/disable, learner lists, categories, Training ownership/lifecycle/content, and shared operational supervision views.                                                                              |
| 13.9  | Auth and feature-flow component tests, deep-link and role navigation tests, Checkout-return integration, strict checks, Expo Doctor, live backend integration tests, and production Android/iOS bundle export.                                                                                                                  |

## Native adaptations

- Native stack routes replace React Router; single-column cards and compact forms replace desktop
  tables and grids.
- Safe areas, keyboard-aware scrolling, pull-to-refresh, 44–48 point actions, native alerts,
  media/document pickers, system browser linking, and Expo file sharing are used.
- The access token remains memory-only and the rotating refresh token remains in SecureStore.
- Resources, Invoices, and Certificates are downloaded with bearer authentication before native
  sharing. Stripe and password-reset flows return through the configured application scheme.
- Money remains backend-owned EUR minor units and displayed in EUR. Calendar displays use
  `Africa/Tunis`; schedule writes require explicit ISO offsets.

## Shared contract changes

- `POST /auth/forgot-password` accepts optional `client: WEB | MOBILE` (default `WEB`).
- `POST /payments/checkout` accepts optional `client: WEB | MOBILE` (default `WEB`).
- `MOBILE_APP_SCHEME` selects Mobile reset and Checkout return URLs.
- OpenAPI documents both client selectors. Existing Web defaults and URLs are preserved.
- Mobile never treats a Checkout redirect as payment confirmation; it queries `/payments/:id`
  until the webhook-owned status becomes terminal.

No migrations, collection/index changes, backfill, or seed changes are required.

## Firebase state

Firebase remains optional Web Analytics only. Mobile has no Firebase dependency, Android/iOS
Firebase registration file, service-account credential, Analytics, Auth, database, storage, or
FCM integration. Future Mobile Analytics/FCM work must register native apps in the existing
Firebase project and keep privileged credentials backend-only.

## Verification record

- Mobile strict TypeScript and Oxlint: passed.
- Mobile Jest: 11 suites / 32 tests, including auth, content/progress, Sessions/planning,
  attendance, purchases, evaluations, Certificates, loading/empty/error states, deep links, role
  navigation, and the Checkout-return backend-status integration.
- Expo Doctor: 21/21 checks passed.
- Production Expo export: Android and iOS Hermes bundles generated successfully in ignored
  `Mobile/dist`.
- Backend strict TypeScript and Oxlint: passed.
- Backend Vitest default suite: 23 files / 90 tests passed; the 8 database files are intentionally
  skipped when `TEST_MONGODB_URI` is absent.
- Backend database integration suite against the local `rs0` replica set: 8 files / 17 tests
  passed.
- Focused Mobile deep-link backend contracts: 10/10 tests passed.
- `npm audit --omit=dev` reports 11 moderate findings from Expo's transitive `xcode` -> `uuid`
  toolchain. npm only offers a forced breaking `expo-sharing` downgrade; it was not applied because
  the current Expo 57 dependency set passes all 21 Expo Doctor checks.

No Android SDK/emulator, ADB, macOS/Xcode, or attached native device is available in this Windows
workspace. Native execution was therefore verified with React Native component integration tests,
Expo Doctor, and production Android/iOS bundling; hardware-only gestures and OS browser return
delivery remain a release-device smoke check rather than an unreported claim.
