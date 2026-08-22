import PDFDocument from 'pdfkit';

import type { Invoice } from '../../modules/invoices/models/invoice.model.js';
import type { InvoiceItem } from '../../modules/invoices/models/invoice-item.model.js';

function money(value: number): string {
  return `${(value / 100).toFixed(2)} TND`;
}

export async function renderInvoicePdf(
  invoice: Invoice,
  item: InvoiceItem,
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({
      size: 'A4',
      margin: 54,
      info: {
        Title: `Facture ${invoice.number}`,
        Author: invoice.issuer.name,
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));

    document.fontSize(22).text('FACTURE', { align: 'right' });
    document.moveDown(0.4);
    document
      .fontSize(11)
      .text(`Numéro : ${invoice.number}`, { align: 'right' });
    document.text(`Date : ${invoice.issuedAt.toISOString().slice(0, 10)}`, {
      align: 'right',
    });

    document.moveDown(2);
    document.fontSize(13).text(invoice.issuer.name);
    document.fontSize(10).text(invoice.issuer.address);
    document.text(invoice.issuer.email);
    if (invoice.issuer.phone !== undefined) document.text(invoice.issuer.phone);
    if (invoice.issuer.registrationId !== undefined) {
      document.text(`Identifiant : ${invoice.issuer.registrationId}`);
    }

    document.moveDown(1.5);
    document.fontSize(11).text('Facturé à', { underline: true });
    document
      .fontSize(10)
      .text(`${invoice.learner.firstName} ${invoice.learner.lastName}`);
    document.text(invoice.learner.email);

    document.moveDown(2);
    const top = document.y;
    document.fontSize(10).text('Description', 54, top);
    document.text('Qté', 350, top, { width: 45, align: 'right' });
    document.text('Montant', 420, top, { width: 120, align: 'right' });
    document
      .moveTo(54, top + 18)
      .lineTo(540, top + 18)
      .strokeColor('#9aa4b2')
      .stroke();
    document.text(item.description, 54, top + 30, { width: 280 });
    document.text('1', 350, top + 30, { width: 45, align: 'right' });
    document.text(money(item.totalMinor), 420, top + 30, {
      width: 120,
      align: 'right',
    });

    document.moveDown(5);
    document.fontSize(11).text(`Sous-total : ${money(invoice.subtotalMinor)}`, {
      align: 'right',
    });
    document.fontSize(13).text(`Total : ${money(invoice.totalMinor)}`, {
      align: 'right',
    });
    document.moveDown(2);
    document
      .fontSize(9)
      .fillColor('#596579')
      .text(
        `Référence paiement : ${String(invoice.paymentId)} · Aucune taxe calculée.`,
      );
    document.end();
  });
}
