import { createHash } from 'node:crypto';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { AppError } from '../../shared/errors/app-error.js';

export interface StoredPdf {
  relativePath: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  checksumSha256: string;
  generatedAt: Date;
}

export class ProtectedDocumentStorage {
  readonly #root: string;

  constructor(directory: string) {
    this.#root = path.resolve(directory);
  }

  async writeInvoice(invoiceId: string, contents: Buffer): Promise<StoredPdf> {
    if (!/^[a-f\d]{24}$/i.test(invoiceId) || contents.length < 5) {
      throw new AppError(
        500,
        'INVALID_DOCUMENT_OUTPUT',
        'The generated document is invalid.',
      );
    }
    const relativePath = path.posix.join(
      'documents',
      'invoices',
      invoiceId.slice(0, 2),
      `${invoiceId}.pdf`,
    );
    const absolutePath = this.resolve(relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
    return {
      relativePath,
      mimeType: 'application/pdf',
      sizeBytes: contents.length,
      checksumSha256: createHash('sha256').update(contents).digest('hex'),
      generatedAt: new Date(),
    };
  }

  async writeCertificate(
    certificateId: string,
    contents: Buffer,
  ): Promise<StoredPdf> {
    if (!/^[a-f\d]{24}$/i.test(certificateId) || contents.length < 5) {
      throw new AppError(
        500,
        'INVALID_DOCUMENT_OUTPUT',
        'The generated document is invalid.',
      );
    }
    const relativePath = path.posix.join(
      'documents',
      'certificates',
      certificateId.slice(0, 2),
      `${certificateId}.pdf`,
    );
    const absolutePath = this.resolve(relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, contents);
    return {
      relativePath,
      mimeType: 'application/pdf',
      sizeBytes: contents.length,
      checksumSha256: createHash('sha256').update(contents).digest('hex'),
      generatedAt: new Date(),
    };
  }

  resolve(relativePath: string): string {
    const absolutePath = path.resolve(
      this.#root,
      relativePath.replaceAll('/', path.sep),
    );
    if (
      absolutePath !== this.#root &&
      !absolutePath.startsWith(`${this.#root}${path.sep}`)
    ) {
      throw new AppError(
        400,
        'INVALID_STORAGE_PATH',
        'The stored document path is invalid.',
      );
    }
    return absolutePath;
  }

  async isReadable(relativePath: string): Promise<boolean> {
    try {
      await access(this.resolve(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async remove(relativePath: string): Promise<void> {
    await rm(this.resolve(relativePath), { force: true });
  }
}
