# Development demonstration data

The development seed resets and repopulates the dedicated **local**
`plateforme_formations` database. It is intended for demos, manual workflow
checks, pagination, charts, and end-to-end development only.

The current seed is the EUR seed. Every monetary record uses `EUR`, with
integer cent amounts (`150.00 EUR` is stored as `15000`). It also assigns each
formation a distinct HTTPS training-thumbnail URL, gives in-person sessions
distinct descriptive names, and keeps generated costs below seeded paid
revenue so profitability dashboards show a positive result.

## Safety

The command is destructive. It deletes application records before recreating
them. It runs only when all of these checks pass:

- `NODE_ENV=development`;
- `MONGODB_URI` targets `localhost`, `127.0.0.1`, or the Compose host
  `mongodb`;
- the database name is exactly `plateforme_formations`;
- `CONFIRM_DEVELOPMENT_SEED=replace-local-development-data`.

Atlas and production targets are rejected. No development credentials are
stored in production configuration.

## Run with Docker Compose

Build the current backend image, then run the seed inside the backend container:

```powershell
docker compose up --build --detach --wait
docker compose exec -e CONFIRM_DEVELOPMENT_SEED=replace-local-development-data backend node dist/scripts/seed-development.js
```

Running the command again resets the same local dataset deterministically.

## Demo accounts

All accounts use the development-only password:

```text
Demo2026!Formation
```

| Role | Email |
|---|---|
| Admin | `admin.demo@formation.test` |
| Formateur | `sami.trabelsi@formation.test` |
| Formateur | `ines.benamor@formation.test` |
| Formateur | `karim.mansour@formation.test` |
| Formateur | `leila.gharbi@formation.test` |
| Apprenant principal | `apprenant01@formation.test` |
| Apprenants supplémentaires | `apprenant02@formation.test` through `apprenant22@formation.test` |

Never reuse this password or these accounts outside a local development
environment.

## Dataset coverage

The seed creates 27 users, 5 categories, 16 published EUR formations, 32 modules,
64 lessons/resources, 12 in-person sessions, 24 schedule entries, 56 payments
across all supported statuses, 44 paid enrollments and invoices, progress and
attendance histories, published evaluations with attempts, eligible
certificates and feedback, plus six months of trainer and training costs.

Session titles are generated from the formation title and promotion/period, so
different session occurrences do not share a generic duplicate name. Seeded
thumbnail URLs are checked as HTTPS image URLs before release.

Paid enrollments are backed by seeded paid Payment records and invoices.
Certificates are created only for demonstrations that satisfy completion or
attendance and pass the certifying evaluation.
