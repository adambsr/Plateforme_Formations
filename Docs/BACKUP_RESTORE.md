# Backup and restore

Two stores form one recoverable state:

| Store | Compose volume | Contents |
|---|---|---|
| MongoDB | plateforme-formations_mongodb_data | Business records and indexes |
| Protected uploads | plateforme-formations_backend_uploads | Resources, invoices, certificates, and stored branding |

Back up both in the same maintenance window. Encrypt backups, restrict access, record the
application version and timestamp, and test restoration outside production.

## Compose backup

Create a backup directory outside the repository. Stop backend writes, dump the
plateforme_formations database with mongodump --archive, archive the complete backend_uploads
volume, then restart the backend:

1. docker compose stop backend
2. docker compose exec -T mongodb mongodump with the local replica-set URI and --archive redirected
   to mongodb.archive.
3. Run a temporary trusted utility container with backend_uploads mounted read-only and the backup
   directory mounted writable; create backend_uploads.tar.gz from the volume root.
4. docker compose start backend

Confirm both output files are non-empty. The logical MongoDB dump is the portable database backup;
the raw mongodb_data volume normally does not need a second archive.

PowerShell example from the backup directory:

    docker compose stop backend
    docker compose exec -T mongodb mongodump --uri="mongodb://localhost:27017/plateforme_formations?replicaSet=rs0&directConnection=true" --archive | Set-Content -AsByteStream mongodb.archive
    docker run --rm --volume plateforme-formations_backend_uploads:/source:ro --volume "${PWD}:/backup" alpine:3.22 tar -czf /backup/backend_uploads.tar.gz -C /source .
    docker compose start backend

## Compose restore

Test in a disposable environment first. A restore is destructive. Stop the backend and confirm the
target project and database. Restore mongodb.archive with mongorestore --archive --drop, replace
the upload volume contents from backend_uploads.tar.gz, then restart the backend.

PowerShell example:

    docker compose stop backend
    Get-Content -AsByteStream mongodb.archive | docker compose exec -T mongodb mongorestore --uri="mongodb://localhost:27017/plateforme_formations?replicaSet=rs0&directConnection=true" --archive --drop
    docker run --rm --volume plateforme-formations_backend_uploads:/target --volume "${PWD}:/backup:ro" alpine:3.22 sh -c "rm -rf /target/* && tar -xzf /backup/backend_uploads.tar.gz -C /target"
    docker compose start backend

Verify /api/health, sign-in, catalogue access, one protected resource, one invoice, and one
certificate. mongodb-init is a one-shot replica-set initializer and should show Exited (0) after
success; it is not a long-running service.

## Managed MongoDB and direct deployments

Use provider snapshots when available. A manual logical backup uses mongodump with the secret URI;
restore with mongorestore and --drop only after confirming the target. Retrieve URIs from a secret
manager or environment variable rather than placing them in source or shell history.

Managed database snapshots exclude UPLOAD_DIR. Back up that mounted filesystem with provider
volume snapshots or an archive captured while backend writes are stopped. For a direct process,
archive the exact UPLOAD_DIR and any CENTER_LOGO_PATH file outside it, preserving ownership and
permissions.

Keep daily and pre-release backups per the centre retention policy, monitor failures and capacity,
and perform an isolated restore test at least quarterly. Never use docker compose down --volumes
during normal operation; it deletes both named volumes.
