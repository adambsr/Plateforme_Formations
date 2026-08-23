import PDFDocument from 'pdfkit';

import type { Certificate } from '../../modules/certificates/models/certificate.model.js';
import { drawDocumentBrand, loadDocumentLogo } from './document-brand.js';

function date(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}

export async function renderCertificatePdf(
  certificate: Certificate,
): Promise<Buffer> {
  const logo = await loadDocumentLogo(certificate.issuer.logoPath);
  return await new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 54,
      info: {
        Title: `Certificat ${certificate.number}`,
        Author: certificate.issuer.name,
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));

    document
      .rect(28, 28, document.page.width - 56, document.page.height - 56)
      .lineWidth(3)
      .strokeColor('#1f6f78')
      .stroke();
    document
      .rect(39, 39, document.page.width - 78, document.page.height - 78)
      .lineWidth(1)
      .strokeColor('#c9a85c')
      .stroke();
    drawDocumentBrand(document, certificate.issuer.name, logo, 64, 58);
    document
      .fillColor('#17212b')
      .fontSize(30)
      .text('CERTIFICAT DE RÉUSSITE', 70, 138, {
        align: 'center',
        width: document.page.width - 140,
      });
    document
      .fontSize(13)
      .fillColor('#596579')
      .text('Ce certificat atteste que', 70, 202, {
        align: 'center',
        width: document.page.width - 140,
      });
    document
      .fontSize(25)
      .fillColor('#17212b')
      .text(
        `${certificate.learner.firstName} ${certificate.learner.lastName}`,
        70,
        235,
        { align: 'center', width: document.page.width - 140 },
      );
    document
      .fontSize(13)
      .fillColor('#596579')
      .text('a satisfait aux conditions de la formation', 70, 282, {
        align: 'center',
        width: document.page.width - 140,
      });
    document
      .fontSize(21)
      .fillColor('#1f6f78')
      .text(certificate.training.title, 70, 315, {
        align: 'center',
        width: document.page.width - 140,
      });
    const period =
      certificate.training.startsAt === undefined ||
      certificate.training.endsAt === undefined
        ? `Inscription : ${date(certificate.training.enrolledAt)}`
        : `Période : ${date(certificate.training.startsAt)} au ${date(
            certificate.training.endsAt,
          )}`;
    document
      .fontSize(11)
      .fillColor('#596579')
      .text(
        `${period}  ·  Durée : ${duration(certificate.training.durationMinutes)}`,
        70,
        370,
        { align: 'center', width: document.page.width - 140 },
      );
    document
      .fontSize(10)
      .fillColor('#17212b')
      .text(`Numéro : ${certificate.number}`, 70, 445, { width: 300 })
      .text(`Date d'émission : ${date(certificate.issuedAt)}`, 70, 463, {
        width: 300,
      });
    document
      .fontSize(9)
      .fillColor('#596579')
      .text(certificate.issuer.address, 470, 438, {
        width: 280,
        align: 'right',
      })
      .text(certificate.issuer.email, 470, 454, {
        width: 280,
        align: 'right',
      });
    if (certificate.issuer.registrationId !== undefined) {
      document.text(
        `Identifiant : ${certificate.issuer.registrationId}`,
        470,
        470,
        { width: 280, align: 'right' },
      );
    }
    document.end();
  });
}
