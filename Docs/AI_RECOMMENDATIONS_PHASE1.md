# AI modernization — Phase 1 dashboard intelligence

## Scope

This increment adds two explainable, backend-owned dashboard capabilities:

1. up to three next-Training recommendations on the Learner dashboard;
2. monthly self-paced completion trends and inactive-Learner signals on the Admin dashboard.

This is the data and product foundation for later AI personalization. Phase 1 does not call Gemini: ranking and inactivity detection are deterministic, testable, low-latency, and do not add model cost.

## Learner recommendations

Endpoint: `GET /api/dashboard/recommendations`

Authorization: authenticated `LEARNER` only.

Eligible candidates are published Trainings in which the current Learner is not already enrolled. Candidates are ranked by:

1. category continuity with the Learner's enrollment history;
2. total platform enrollments as a popularity fallback;
3. Training publication recency as the final tie-breaker.

The response includes a human-readable reason. Individual Feedback ratings are not used or exposed. Enrollment eligibility, access, payment, prerequisites, and capacity remain validated by their existing backend workflows when the Learner opens or purchases a Training.

Cold start behavior: a Learner without history receives popular published Trainings, with recent Trainings used to break ties. If no eligible Training exists, the dashboard displays an empty state and a catalogue prompt.

## Admin learning insights

Endpoint: `GET /api/dashboard/learning-insights?from=YYYY-MM-DD&to=YYYY-MM-DD`

Authorization: authenticated `ADMIN` only.

Completion trend:

- includes self-paced enrollments only;
- counts an enrollment when all current, non-archived lessons are completed;
- uses the latest required lesson completion timestamp;
- groups results by calendar month in `Africa/Tunis`;
- applies the inclusive dashboard date range.

Inactive Learner signal:

- includes active Learner accounts with at least one unfinished self-paced enrollment containing lessons;
- last pedagogical activity is the latest enrollment creation or LessonProgress update;
- a Learner is inactive after 30 complete days without that activity;
- completed self-paced enrollments and in-person Sessions are excluded;
- the card displays the five longest-inactive Learners requiring attention.

This is not a global last-login metric. Adding login-session analytics later would require a separate, explicitly documented event source.

## Future extension

Once recommendation impressions, clicks, enrollments, and completions are tracked, ranking can be evaluated before introducing collaborative filtering or embeddings. Gemini may later generate richer explanations or study-path summaries, but it must not own authorization, payment, capacity, progression, or certification decisions.

## Recommendation measurement

Firebase Analytics remains disabled by default. Enable it only after Firebase configuration and privacy review, and only for visitors who accept the in-app analytics choice.

The following optional events contain only a Training technical identifier, Training category, and recommendation rank:

- `recommendation_impression` when the Learner dashboard displays a unique recommendation;
- `recommendation_click` when the Learner opens that recommendation;
- `recommendation_enrollment` only when the payment-return page receives a backend-owned `PAID` Payment with an `enrollmentId` for the attributed Training.

Click attribution is held only in browser session storage for seven days. It is cleared after a conversion. The redirect to Stripe and the creation of a Checkout Session never count as an enrollment. No email, name, user identifier, payment amount, assessment data, or individual Feedback value is sent to Firebase.

### Reporting setup and interpretation

The Web application updates the document title for every route. Firebase therefore
records distinguishable page views such as `Catalogue des formations | High Skills
Academy` and `Espace apprenant | High Skills Academy`, instead of grouping all
single-page application routes under one generic title.

Create the following Google Analytics **event-scoped custom dimensions** in
**Admin > Data display > Custom definitions**:

| Dimension name | Event parameter | Scope | Purpose |
| --- | --- | --- | --- |
| Training category | `training_category` | Event | Compare recommendation performance by subject area. |
| Recommendation rank | `recommendation_rank` | Event | Compare the first, second, and third recommendation positions. |

Do not register `training_id` as a custom dimension: its large number of unique
values would make ordinary reports less useful. The technical ID is still collected
with the event for validation and troubleshooting.

Use Firebase **Realtime Analytics** to confirm that traffic and events are arriving
now. Realtime event totals are activity counts, not unique Learners. For meaningful
analysis, wait for the custom dimensions to become available in Google Analytics
(normally 24-48 hours), then use **Explore > Free form** with `Event name`,
`Training category`, and `Recommendation rank` as dimensions and `Event count` as
the metric. Filter the exploration to events beginning with `recommendation_`.

This makes the recommendation funnel measurable:

- impressions show which recommendations were displayed;
- clicks show which displayed recommendations attracted interest;
- confirmed enrollments show which recommendation journeys converted;
- click-through rate is clicks divided by impressions;
- enrollment conversion is confirmed enrollments divided by clicks.

Treat these measures as evidence for improving deterministic ranking before adding
model-driven personalization. They reveal whether category continuity, popularity,
and recommendation position help Learners discover suitable Training without
collecting personal analytics identifiers.

When the Vite development server is used, a concise browser-console signal confirms initialization and each queued event. Set `VITE_FIREBASE_ANALYTICS_DEBUG=true` only while validating events in Firebase Analytics DebugView; debug-mode events are excluded from general Analytics reporting. Restart Vite after changing any `VITE_FIREBASE_*` value because Vite embeds environment values at startup.

## Verification

- strict backend and frontend TypeScript checks;
- backend and frontend lint;
- focused frontend tests for both dashboard surfaces;
- MongoDB integration tests for ranking, authorization, completion aggregation, and inactivity detection when `TEST_MONGODB_URI` is configured.
