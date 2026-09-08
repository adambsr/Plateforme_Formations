# Free Gmail email setup

## What the code does

The backend has one provider-neutral transactional email service. It renders a
shared responsive High Skills Academy layout (HTML plus plain text) and sends
through one Nodemailer transport. The normal Docker backend uses
`EMAIL_PROVIDER=smtp` and sends real messages through Gmail.

Current automatic messages cover password reset, welcome/registration, password
changes, confirmed payments/enrollments, training completion, certificates, and
session scheduled/changed/cancelled/completed events. Contact submissions go to
`EMAIL_CONTACT_TO`, with the visitor's address placed in `Reply-To` so replying
from Gmail replies to the visitor.

The code has a session-reminder template, but reminders are not scheduled
automatically because the repository has no durable queue or job runner. Email
verification is also not enabled because the current account model has no
email-verification state or token lifecycle.

## Selected setup: one free personal Gmail account

Use one dedicated account, for example `contact.hsa.tn@gmail.com` (or the closest
available name), for all of these roles:

- authenticated SMTP sender;
- contact-form inbox;
- support and centre address shown to users.

There is no domain, DNS, MX, SPF, DKIM, DMARC, paid mailbox, or third-party email
provider to configure. Google controls the `gmail.com` domain and its email
authentication. The visible `From` address must be the Gmail account used to
authenticate; the application should not pretend to send from a separate
`no-reply@` address.

This is suitable for a demo, Master's project, or small low-volume deployment.
A personal Gmail account is currently limited to about 500 outgoing messages per
day, and Google can temporarily stop sending when a limit or anti-abuse control
is reached. It is not a replacement for a transactional provider at larger
production scale.

Official Google references:

- App passwords: https://support.google.com/accounts/answer/185833
- Turn on 2-Step Verification: https://support.google.com/accounts/answer/10956730
- Gmail sending limits: https://support.google.com/mail/answer/22839

## One-time Google setup

1. Create a new personal Google account using an available address such as
   `contact.hsa.tn@gmail.com`. Add a recovery email or phone and keep its recovery
   information somewhere safe.
2. Open the Google Account's **Security** page and enable **2-Step Verification**.
3. Open **App passwords**, create one for the HSA backend, and copy the generated
   16-character password. Google only shows it once. If **App passwords** is not
   available, confirm that 2-Step Verification is active. Google may hide the
   option for Advanced Protection, security-key-only 2-Step Verification, or a
   managed work/school account; use an ordinary personal Gmail account here.
4. Store the app password only in the backend hosting platform's secret settings.
   Do not use the normal Google password, commit the app password, put it in a
   root/frontend `.env`, or expose it through any `VITE_*` or `EXPO_PUBLIC_*`
   variable.

## Production configuration

Replace `contact.hsa.tn@gmail.com` below if the address you create is different.
Use the HTTPS frontend URL assigned by the free hosting platform for
`WEB_APP_URL` and `CORS_ORIGINS`; a custom domain is not required.

Backend deployment environment:

```dotenv
NODE_ENV=production
WEB_APP_URL=https://<frontend-url-assigned-by-your-host>
CORS_ORIGINS=https://<frontend-url-assigned-by-your-host>
# Use 1 only when exactly one trusted reverse proxy sits in front of the API.
TRUST_PROXY_HOPS=1

EMAIL_PROVIDER=smtp
EMAIL_DELIVERY_ENABLED=true
EMAIL_FROM=High Skills Academy <contact.hsa.tn@gmail.com>
EMAIL_CONTACT_TO=contact.hsa.tn@gmail.com
EMAIL_SUPPORT_ADDRESS=contact.hsa.tn@gmail.com
EMAIL_TEST_RECIPIENT=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=contact.hsa.tn@gmail.com
SMTP_PASSWORD=<the Google app password, with spaces removed>
SMTP_FROM=

# Existing centre identity value (public, not a secret)
CENTER_EMAIL=contact.hsa.tn@gmail.com
```

Web deployment environment:

```dotenv
VITE_CENTER_EMAIL=contact.hsa.tn@gmail.com
```

Mobile build environment:

```dotenv
EXPO_PUBLIC_CENTER_EMAIL=contact.hsa.tn@gmail.com
```

`VITE_CENTER_EMAIL` and `EXPO_PUBLIC_CENTER_EMAIL` are intentionally public
display values. All `SMTP_*` values belong only to the backend, and
`SMTP_PASSWORD` must be treated as a secret.

`SMTP_SECURE=false` is correct for Gmail port 587: the connection starts normally
and upgrades with STARTTLS. `SMTP_REQUIRE_TLS=true` prevents plaintext fallback.
Do not change these settings to make a failed login appear to work.

## Verification sequence

### Safe Gmail test

1. Set the Gmail SMTP values in `Web/backend/.env`. Docker Compose supplies that
   file directly to the backend container while keeping Docker-specific database
   and storage overrides.
2. Set
   `EMAIL_TEST_RECIPIENT=contact.hsa.tn@gmail.com`. Every application message and
   `Reply-To` is redirected to this inbox, and the subject is prefixed `[TEST]`.
3. Run `npm run docker:up`, then use test accounts and Stripe test mode. Trigger registration, password reset,
   contact, payment/enrollment, completion, certificate, and session flows.
4. Confirm each message appears in the Gmail inbox or **Sent** folder, contains
   the correct HTTPS links, and has the expected sender and reply address.
5. Clear `EMAIL_TEST_RECIPIENT` and restart or redeploy the backend. Messages will
   then go to their real recipients; contact submissions will still arrive at
   `contact.hsa.tn@gmail.com`.

If Gmail rejects authentication, first check that `SMTP_USER` exactly matches the
account and that `SMTP_PASSWORD` is the app password rather than the normal
account password. Creating a new app password also fixes credentials revoked
after changing the main Google password.

For larger volume or stronger delivery guarantees later, move to a transactional
provider and add a durable email outbox/worker. The present best-effort lifecycle
notifications deliberately do not roll back successful registrations, payments,
progress, or certificate issuance when SMTP is temporarily unavailable.
