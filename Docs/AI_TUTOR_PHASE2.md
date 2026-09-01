# AI modernization — Phase 2 course tutor

## Outcome

Phase 2 adds a chatbot to the protected Training content page for paid Learners.
It can answer course questions, simplify explanations, produce grounded examples,
create practice questions, summarize relevant material, and prepare a revision aid.
The revision action can point out concepts that appear unclear in the current chat;
it does not create a permanent psychological or educational profile.

Endpoint: `POST /api/trainings/:id/tutor/messages`

Authorization: authenticated `LEARNER` with a paid Enrollment for the target
Training. Admins, Trainers, unenrolled Learners, archived Lessons, and Lessons from
another Training cannot be used through this endpoint.

## Retrieval and grounding

The backend performs bounded lexical retrieval over the active Module and Lesson
titles, descriptions, textual content, and instructions in the authorized Training.
It selects at most five relevant Lessons and never trusts the browser to provide
course text. A selected current Lesson receives retrieval priority.

Only the retrieved Lesson excerpts, the Learner's question, the selected tutor mode,
and up to eight recent chat messages are sent to Gemini. The prompt does not include
the Learner's name, email, user ID, progress, payments, Evaluation answers, results,
or certificates.

For responsiveness, the tutor caps retrieved source text at 24,000 characters even
when the broader `AI_MAX_CONTEXT_CHARS` setting is larger. It asks
`gemini-3.1-flash-lite` first, retains the configured `AI_MODEL` as an availability
fallback, limits each provider attempt to 15 seconds, and limits output to 1,600
tokens. The browser aborts a request after 35 seconds so the composer can never
remain indefinitely in the thinking state.

Gemini must return structured JSON containing an answer, a grounded/refusal flag,
Lesson IDs, and optional follow-up questions. The backend rejects the response when:

- its JSON does not match the strict schema;
- a supported answer has no citation;
- a citation was not part of the retrieved authorized Lesson set;
- a refusal claims Lesson citations.

The Web UI resolves accepted IDs into links such as
`/app/content/:trainingId#lesson-:lessonId`. Learners can therefore jump to the
source Lesson and verify the answer. If the retrieved material does not support the
question, the tutor must say so instead of relying on outside knowledge.

## Chat behavior

The chatbot provides these modes:

| Mode | Purpose |
| --- | --- |
| Question | Answer a free-form course question. |
| Simplify | Reformulate relevant material in simpler language. |
| Example | Produce a concrete example supported by the course. |
| Practice | Generate practice questions without revealing answers immediately. |
| Summary | Summarize the retrieved Lesson or course material. |
| Revision | Build a revision aid from the course and the current conversation. |

Chat history lives only in the current React page state and is not persisted to the
database. Reloading or leaving the page starts a new conversation. This initial
version uses lexical retrieval and requires no vector database, embedding provider,
or new persistence entity. Embeddings can be evaluated later if real course content
shows that lexical retrieval quality is insufficient.

The API applies the shared in-memory rate limiter at 30 tutor messages per source IP
per 15-minute window to bound accidental or abusive provider cost. A multi-instance
production deployment should replace that process-local counter with the platform's
shared rate-limit store.

## Configuration and privacy

The tutor reuses the backend-only `AI_API_KEY`, `AI_MODEL`, optional `AI_BASE_URL`,
and `AI_MAX_CONTEXT_CHARS` configuration. No provider secret is exposed to Web or
Mobile clients.

Production privacy information must disclose that relevant course excerpts and
Learner-entered chat text are processed by Google Gemini. Do not place personal,
payment, health, or confidential information in tutor questions. The UI reminds the
Learner that AI output can be wrong and provides citations for verification.

## Verification

- backend and frontend strict TypeScript checks;
- request-schema and OpenAPI contract coverage;
- paid-Enrollment authorization at the backend;
- rejection of fabricated or missing citations;
- frontend chatbot rendering and Lesson-link coverage;
- provider failures returned as safe API errors without leaking prompts or keys.
