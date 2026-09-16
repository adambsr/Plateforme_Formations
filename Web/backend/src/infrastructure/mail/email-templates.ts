export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface EmailBrand {
  centerName: string;
  supportAddress: string;
  logoCid?: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function paragraph(value: string): string {
  return `<p style="margin:0 0 18px;color:#334155;font-size:16px;line-height:1.65">${escapeHtml(value).replaceAll('\n', '<br>')}</p>`;
}

function button(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:#155eef"><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700">${escapeHtml(label)}</a></td></tr></table>`;
}

function layout(
  brand: EmailBrand,
  title: string,
  preheader: string,
  content: string,
): string {
  const logo =
    brand.logoCid === undefined
      ? `<span style="color:#155eef;font-size:22px;font-weight:800">${escapeHtml(brand.centerName)}</span>`
      : `<img src="cid:${escapeHtml(brand.logoCid)}" width="190" alt="${escapeHtml(brand.centerName)}" style="display:block;width:190px;max-width:100%;height:auto;border:0">`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:28px 32px;border-bottom:1px solid #e2e8f0">${logo}</td></tr>
<tr><td style="padding:32px"><h1 style="margin:0 0 20px;color:#0f172a;font-size:26px;line-height:1.25">${escapeHtml(title)}</h1>${content}</td></tr>
<tr><td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.6">Message transactionnel envoyé par ${escapeHtml(brand.centerName)}.<br>Besoin d’aide ? Écrivez à <a href="mailto:${escapeHtml(brand.supportAddress)}" style="color:#155eef">${escapeHtml(brand.supportAddress)}</a>.<br>Ne communiquez jamais votre mot de passe ni vos liens de sécurité.</td></tr>
</table></td></tr></table></body></html>`;
}

function render(
  brand: EmailBrand,
  subject: string,
  preheader: string,
  text: string,
  content: string,
): RenderedEmail {
  return { subject, text, html: layout(brand, subject, preheader, content) };
}

function greeting(firstName?: string): string {
  return firstName === undefined || firstName.trim() === ''
    ? 'Bonjour,'
    : `Bonjour ${firstName.trim()},`;
}

export function passwordResetEmail(
  brand: EmailBrand,
  input: { resetUrl: string; expiresInMinutes: number },
): RenderedEmail {
  const subject = 'Réinitialisation de votre mot de passe';
  const text = [
    'Bonjour,',
    '',
    'Une demande de réinitialisation a été reçue pour votre compte High Skills Academy.',
    `Réinitialisez votre mot de passe : ${input.resetUrl}`,
    `Ce lien expire dans ${input.expiresInMinutes} minutes et ne peut être utilisé qu’une fois.`,
    'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
  ].join('\n');
  return render(
    brand,
    subject,
    'Votre lien sécurisé de réinitialisation.',
    text,
    paragraph('Bonjour,') +
      paragraph(
        'Une demande de réinitialisation a été reçue pour votre compte High Skills Academy.',
      ) +
      button('Réinitialiser mon mot de passe', input.resetUrl) +
      paragraph(
        `Ce lien expire dans ${input.expiresInMinutes} minutes et ne peut être utilisé qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.`,
      ),
  );
}

export function welcomeEmail(
  brand: EmailBrand,
  input: { firstName?: string; appUrl: string; temporaryPassword?: boolean },
): RenderedEmail {
  const subject = 'Bienvenue chez High Skills Academy';
  const extra = input.temporaryPassword
    ? 'Utilisez le mot de passe temporaire transmis séparément. Vous devrez le modifier à votre première connexion.'
    : 'Votre compte apprenant est prêt.';
  const text = [
    greeting(input.firstName),
    '',
    extra,
    `Accéder à la plateforme : ${input.appUrl}`,
  ].join('\n');
  return render(
    brand,
    subject,
    'Votre compte High Skills Academy est prêt.',
    text,
    paragraph(greeting(input.firstName)) +
      paragraph(extra) +
      button('Accéder à la plateforme', input.appUrl),
  );
}

export function passwordChangedEmail(
  brand: EmailBrand,
  input: { firstName?: string; supportAddress: string },
): RenderedEmail {
  const subject = 'Votre mot de passe a été modifié';
  const warning = `Si vous n’êtes pas à l’origine de cette modification, contactez immédiatement ${input.supportAddress}.`;
  const text = [
    greeting(input.firstName),
    '',
    'Le mot de passe de votre compte High Skills Academy vient d’être modifié.',
    warning,
  ].join('\n');
  return render(
    brand,
    subject,
    'Confirmation de sécurité de votre compte.',
    text,
    paragraph(greeting(input.firstName)) +
      paragraph(
        'Le mot de passe de votre compte High Skills Academy vient d’être modifié.',
      ) +
      paragraph(warning),
  );
}

export function enrollmentConfirmationEmail(
  brand: EmailBrand,
  input: {
    firstName?: string;
    trainingTitle: string;
    sessionTitle?: string;
    amountMinor: number;
    currency: string;
    appUrl: string;
  },
): RenderedEmail {
  const subject = 'Paiement et inscription confirmés';
  const amount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: input.currency,
  }).format(input.amountMinor / 100);
  const enrollment = `${input.trainingTitle}${input.sessionTitle === undefined ? '' : ` : ${input.sessionTitle}`}`;
  const text = [
    greeting(input.firstName),
    '',
    `Votre paiement de ${amount} est confirmé.`,
    `Inscription : ${enrollment}`,
    `Consulter mes achats : ${input.appUrl}/app/payments`,
  ].join('\n');
  return render(
    brand,
    subject,
    `Votre inscription à ${input.trainingTitle} est confirmée.`,
    text,
    paragraph(greeting(input.firstName)) +
      paragraph(`Votre paiement de ${amount} est confirmé.`) +
      paragraph(`Inscription : ${enrollment}`) +
      button('Consulter mes achats', `${input.appUrl}/app/payments`),
  );
}

export function certificateAwardedEmail(
  brand: EmailBrand,
  input: {
    firstName?: string;
    trainingTitle: string;
    certificateNumber: string;
    certificatesUrl: string;
  },
): RenderedEmail {
  const subject = 'Félicitations, votre certificat est disponible';
  const text = [
    greeting(input.firstName),
    '',
    `Vous avez obtenu votre certificat pour « ${input.trainingTitle} ».`,
    `Numéro : ${input.certificateNumber}`,
    `Télécharger mon certificat : ${input.certificatesUrl}`,
  ].join('\n');
  return render(
    brand,
    subject,
    `Votre certificat pour ${input.trainingTitle} est prêt.`,
    text,
    paragraph(greeting(input.firstName)) +
      paragraph(
        `Vous avez obtenu votre certificat pour « ${input.trainingTitle} ».`,
      ) +
      paragraph(`Numéro : ${input.certificateNumber}`) +
      button('Voir mes certificats', input.certificatesUrl),
  );
}

export type SessionEmailKind =
  'scheduled' | 'changed' | 'cancelled' | 'reminder' | 'completed';

export function sessionEmail(
  brand: EmailBrand,
  input: {
    kind: SessionEmailKind;
    trainingTitle: string;
    sessionTitle: string;
    startsAt?: string;
    location?: string;
    sessionUrl: string;
  },
): RenderedEmail {
  const labels: Record<SessionEmailKind, string> = {
    scheduled: 'Nouvelle session planifiée',
    changed: 'Modification de votre session',
    cancelled: 'Session annulée',
    reminder: 'Rappel : votre session approche',
    completed: 'Formation terminée',
  };
  const subject = labels[input.kind];
  const details = [
    `Formation : ${input.trainingTitle}`,
    `Session : ${input.sessionTitle}`,
    ...(input.startsAt === undefined ? [] : [`Début : ${input.startsAt}`]),
    ...(input.location === undefined ? [] : [`Lieu : ${input.location}`]),
  ];
  const text = [...details, `Consulter la session : ${input.sessionUrl}`].join(
    '\n',
  );
  return render(
    brand,
    subject,
    `${subject} : ${input.trainingTitle}`,
    text,
    details.map(paragraph).join('') +
      button('Consulter la session', input.sessionUrl),
  );
}

export function trainingCompletedEmail(
  brand: EmailBrand,
  input: { firstName?: string; trainingTitle: string; appUrl: string },
): RenderedEmail {
  const subject = 'Formation terminée';
  const text = [
    greeting(input.firstName),
    '',
    `Vous avez terminé la formation « ${input.trainingTitle} ».`,
    `Consulter ma progression : ${input.appUrl}/app/progress`,
  ].join('\n');
  return render(
    brand,
    subject,
    `Bravo pour avoir terminé ${input.trainingTitle}.`,
    text,
    paragraph(greeting(input.firstName)) +
      paragraph(`Vous avez terminé la formation « ${input.trainingTitle} ».`) +
      button('Consulter ma progression', `${input.appUrl}/app/progress`),
  );
}

export function contactMessageEmail(
  brand: EmailBrand,
  input: { name: string; email: string; subject: string; message: string },
): RenderedEmail {
  const subject = `[Contact High Skills Academy] ${input.subject}`;
  const text = [
    `Nom : ${input.name}`,
    `Adresse e-mail : ${input.email}`,
    `Objet : ${input.subject}`,
    '',
    input.message,
  ].join('\n');
  return render(
    brand,
    subject,
    `Nouveau message de ${input.name}.`,
    text,
    paragraph(`Nom : ${input.name}`) +
      paragraph(`Adresse e-mail : ${input.email}`) +
      paragraph(`Objet : ${input.subject}`) +
      paragraph(input.message),
  );
}
