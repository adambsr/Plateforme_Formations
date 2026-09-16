# High Skills Academy redesign audit

Review date: 16 September 2026. Working site: `Web/frontend` in `D:\Plateforme_Formations`. Mode: overhaul. Taste Skill v2 experimental is the only design-rule source. This is the final local verification record and does not represent a production deployment.

## Direction and design dials

Design read: a trustworthy professional learning platform with calm HSA blue, editorial public pages and efficient role workspaces.

- **DESIGN_VARIANCE: 5.** Distinct public compositions with predictable product navigation.
- **MOTION_INTENSITY: 3.** Restrained feedback, reduced-motion support and no decorative continuous animation.
- **VISUAL_DENSITY: 5.** Readable public content with practical density in learning and management areas.

## Section 11 baseline audit

### Brand tokens originally in use

| Element | Baseline | Final treatment |
| --- | --- | --- |
| Identity | High Skills Academy blue and white logo artwork | Original artwork retained; blue logo in light mode and white logo in dark mode |
| Accent | `#1859a6`, `#123f78` | Retained as the primary light-theme brand colors |
| Text | `#172033`, muted `#667085` | Consolidated into higher-contrast cool neutrals |
| Typography | Aptos, Avenir, Segoe and system fallbacks | Self-hosted Manrope variable with Segoe and system fallback |
| Structure | About 4,220 lines of accumulated global CSS | Tokens, controls, public, portal and learning styles separated |
| Media | Large PNG hero and logos | Original artwork optimized to AVIF/WebP; supporting learning photo added |
| Shape | Inconsistent radii | 8px controls, 16px containers and full circles for avatar/status use |

Current light tokens use surface `#fefefe`, canvas `#f5f7fa`, ink `#152a43`, muted `#405267` and primary `#1859a6`. Dark tokens use surface `#152438`, canvas `#101c2c`, ink `#e6edf7`, muted `#b3c1d4` and primary `#99c4ff`. The first visit is light. Explicit theme choices persist in local storage through reloads and payment returns.

### Information architecture and page tree

All original route nesting, parameters and role guards remain. `HSA_DESIGN_CHECKS.json` contains the mechanical comparison.

| Area | Routes |
| --- | --- |
| Public | `/`, `/catalogue`, `/trainings/:id`, `/about`, `/faq`, `/contact` |
| Legal | `/privacy`, `/terms`, `/cookies`, `/refund-policy`, `/data-deletion` |
| Authentication | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/change-password` |
| Payment return | `/payments/success`, `/payments/cancel` |
| Shared authenticated | `/app`, `/app/profile`, `/app/notifications`, `/app/catalogue`, `/app/content/:trainingId`, `/app/attendance`, `/app/evaluations`, `/app/evaluations/:evaluationId`, `/app/certificates` |
| Learner | `/app/learner`, `/app/progress`, `/app/payments` |
| Trainer | `/app/trainer`, `/app/evaluations/new` |
| Trainer and admin management | `/app/trainings`, `/app/trainings/new`, `/app/trainings/:trainingId/edit`, `/app/trainings/:trainingId/content`, `/app/sessions`, `/app/sessions/new` |
| Admin | `/app/dashboard`, `/app/categories`, `/app/users`, `/app/users/trainers/new`, `/app/users/trainers/:trainerId/edit`, `/app/payments` |
| System | Existing status routes, the rate-limit status, and catchall 404 |

### Navigation and conversion paths

- Public discovery: home, catalogue/category entry points, details, registration/login and existing purchase/session actions.
- Learner: dashboard, enrolled content, progress, planning, evaluations, certificates and purchases.
- Trainer: dashboard, assigned content, sessions, attendance and evaluations.
- Administrator: real-data dashboard, categories, users, training/content, sessions, attendance, evaluations, certificates and payments.
- Recovery and support: login recovery, system states, FAQ, contact and legal pages.

Primary labels, destinations, role separation and conversion actions remain. The public and portal headers now share height, padding, logo sizing and control alignment. Authenticated headers include role-aware search and a notification center. Mobile public navigation remains a disclosure and the authenticated sidebar remains a drawer.

### Patterns preserved

HSA artwork and blue identity; role navigation; training cards; real progress and eligibility states; forms and field names; management tables; filters and pagination; calendar/session controls; payment confirmation from the backend; error/loading/empty states; authentication and authorization; analytics consent; legal and SEO copy.

### Patterns retired or corrected

Accumulated style overrides, inconsistent card/control spacing, competing radii, weak muted contrast, uneven dashboard accents, repeated refresh races, logout guard redirects, missing header actions, fixed-open tutor UI, plain category rows, placeholder testimonial labeling and an unconnected process list.

### SEO baseline

The original site uses a shared French HTML description, HSA title and client-side title mapping. No valid robots file, sitemap, canonical tags, social metadata, structured data or authenticated-route noindex policy was found. Those remain baseline findings because crawl-policy changes were outside the approved scope.

Routes, primary navigation labels, important headings, anchors, form contracts, metadata values and legal copy are preserved. The favicon URL is unchanged.

## Final implementation

- Theme initializes before React, defaults to light and persists an explicit choice. Logo artwork switches by theme.
- Auth refresh is single-flight, guarded by session generation and disabled on logout. Successful logout invalidates the server cookie, holds the protected guard in a logging-out state, and navigates directly to `/`.
- Role-aware server search covers authorized formations, lessons, sessions, users, evaluations, payments, and certificates with debouncing and limited grouped results.
- Persistent in-app notifications use recipient ownership, read state, pagination, idempotent event keys, an authenticated SSE stream, and a 30-second polling fallback. Existing Firebase device APIs remain available for push delivery.
- Real notification events cover account creation, enrollment and payment outcomes, session changes and reminders, evaluation publication and results, training completion, and certificate issuance.
- Admin cost entry uses accessible modals and consistent tables. Admin analytics are all-time. Tutor dashboards show real learner counts and activity. Learner progress includes the achievement treatment and role-specific navigation.
- The tutor collapses and expands without unmounting messages, lesson selection or draft state.
- Landing categories use horizontal snap panels with live category copy and visual backgrounds. Testimonials use ratings, identity blocks and trust details. The four-step process uses icons and connected progression.
- Admin charts continue to use the existing dashboard endpoints. All 11 dashboard and option endpoints returned live data successfully during verification.

## Required Taste Skill audits

| Audit | Result | Evidence |
| --- | --- | --- |
| Em-dash and en-dash | Pass | `Web/frontend` and `Web/backend` source contain zero U+2013/U+2014 |
| Pre-Flight | Pass | Contrast, themes, responsive behavior, interaction state, console and performance checks pass |
| Section / Layout / Repetition | Pass | Public sections remain distinct; learner, tutor, and admin dashboards share components while retaining role-specific content and hierarchy |
| Hero discipline | Pass | Each dashboard uses one compact shared hero with restrained supporting copy; the public hero remains concise |
| Preservation | Pass | All original route paths remain, zero unapproved checked contracts were removed, form field names remain, and the legal comparison passes |
| Brand fidelity | Pass | Original logo/hero artwork, HSA blue identity and shared light/dark tokens |

## Verification

- Full frontend suite: **65 tests passed in 27 files**.
- Backend suite: **110 tests passed** with 22 environment-dependent tests skipped in the default run.
- Search and notification database integration: **3 tests passed**, including deduplication, ownership, reminders, and role-scoped search.
- Backend and frontend TypeScript production builds pass.
- Backend and frontend lint pass with zero warnings.
- Static design audit passes: zero forbidden dash characters in Web source, no removed checked contracts, unchanged route tree, all contrast pairs pass and legal comparison passes.
- Live Docker API verification passes for all supplied roles. Search and persistent feeds return role-scoped real data; the tutor workspace reports 12 learners and real activity.
- Headless Edge verifies Learner, Tutor, and Admin dashboards, notification panels, direct logout to `/`, responsive role navigation, and zero browser console errors.
- Mobile Lighthouse: performance **95**, accessibility **100**, best practices **100**, SEO **92**, FCP **1.705s**, LCP **2.758s**, CLS **0**, TBT **60ms**, zero console errors.
- Desktop Lighthouse: performance **100**, accessibility **100**, best practices **100**, SEO **92**, FCP **384ms**, LCP **683ms**, CLS **0**, TBT **0ms**, zero console errors.

The remaining SEO score reflects the preserved robots/crawl-policy baseline. Lighthouse wrote complete reports without runtime errors; Edge emitted a Windows temporary-profile cleanup error after each report was saved.

Artifacts:

- `Docs/HSA_DESIGN_CHECKS.json`
- `Docs/audits/HSA_LIGHTHOUSE_FINAL.json`
- `Docs/audits/HSA_LIGHTHOUSE_DESKTOP_FINAL.json`
- `Docs/audits/HSA_LANDING_FINAL.png`
- `Docs/audits/HSA_LANDING_MOBILE_FINAL.png`

## Reproduce checks

```powershell
npm.cmd run build --workspace @plateforme-formations/frontend
npm.cmd run test --workspace @plateforme-formations/frontend
npm.cmd run lint --workspace @plateforme-formations/frontend
node Web/frontend/scripts/audit-design.mjs
```
