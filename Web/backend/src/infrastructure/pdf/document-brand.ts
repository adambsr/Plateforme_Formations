import { readFile } from 'node:fs/promises';

export async function loadDocumentLogo(
  logoPath: string | undefined,
): Promise<Buffer | undefined> {
  if (logoPath === undefined) return undefined;
  try {
    return await readFile(logoPath);
  } catch {
    return undefined;
  }
}

export function drawDocumentBrand(
  document: PDFKit.PDFDocument,
  _issuerName: string,
  logo: Buffer | undefined,
  x: number,
  y: number,
): void {
  const brandName = 'High Skills Academy';
  if (logo !== undefined) {
    try {
      document.image(logo, x, y, { fit: [86, 48] });
      document
        .fontSize(12)
        .fillColor('#17365f')
        .text(brandName, x + 100, y + 15, { width: 250 });
      return;
    } catch {
      // A damaged optional logo falls back to the replaceable placeholder.
    }
  }
  document.roundedRect(x, y, 48, 48, 10).fill('#1859a6');
  document
    .fontSize(13)
    .fillColor('#ffffff')
    .text('HS', x, y + 16, { width: 48, align: 'center' });
  document
    .fontSize(12)
    .fillColor('#17365f')
    .text(brandName, x + 60, y + 15, { width: 270 });
}
