# Plateforme de Formations — Codex Instructions

## Authoritative documents

Before making implementation decisions, use these documents in this precedence order:

1. `Docs/SOURCE_OF_TRUTH.md`
2. `PLAN.md`
3. The development prompt relevant to the current client:
   - `Docs/WEB_DEVELOPMENT_PROMPT.md` for Web/backend work
   - `Docs/MOBILE_DEVELOPMENT_PROMPT.md` for Mobile work

If documents conflict, the higher-precedence document wins.

Do not modify product behavior to match a lower-precedence prompt.

## Development roadmap

`PLAN.md` is the implementation roadmap.

Work phase-by-phase according to `PLAN.md`.
Do not implement later phases unless they are necessary dependencies of the current phase.

Each phase should be implemented as small, reviewable tasks rather than generating the whole application at once.

## Current implementation rules

- The backend in `Web/backend` is shared by Web and Mobile.
- Do not create a mobile-specific backend.
- Business rules belong in the backend.
- Do not duplicate backend business logic in Web or Mobile clients.
- Use strict TypeScript.
- Follow the architecture and module boundaries in `PLAN.md`.
- Follow the Source of Truth for all domain rules.
- Do not introduce out-of-scope entities, workflows, states, or infrastructure.
- Do not silently resolve a genuine contradiction in the Source of Truth.
- For implementation details already resolved by `PLAN.md`, follow the plan instead of reopening the architecture.

## Quality

For each implementation task:

1. inspect existing code first;
2. make the smallest coherent change;
3. implement backend authorization and validation where relevant;
4. add or update appropriate tests;
5. run relevant typecheck/lint/tests;
6. report what changed and any remaining failures.

Do not consider a feature complete merely because its UI works.