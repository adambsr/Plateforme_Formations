import { isUtf8 } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { fileTypeFromBuffer } from 'file-type';

import { AppError } from '../../shared/errors/app-error.js';

interface AllowedFileType {
  declaredMimeTypes: readonly string[];
  detectedExtensions?: readonly string[];
  text?: boolean;
}

const ALLOWED_FILE_TYPES: Readonly<Record<string, AllowedFileType>> = {
  '.pdf': {
    declaredMimeTypes: ['application/pdf'],
    detectedExtensions: ['pdf'],
  },
  '.png': {
    declaredMimeTypes: ['image/png'],
    detectedExtensions: ['png'],
  },
  '.jpg': {
    declaredMimeTypes: ['image/jpeg'],
    detectedExtensions: ['jpg'],
  },
  '.jpeg': {
    declaredMimeTypes: ['image/jpeg'],
    detectedExtensions: ['jpg'],
  },
  '.gif': {
    declaredMimeTypes: ['image/gif'],
    detectedExtensions: ['gif'],
  },
  '.webp': {
    declaredMimeTypes: ['image/webp'],
    detectedExtensions: ['webp'],
  },
  '.docx': {
    declaredMimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    detectedExtensions: ['docx', 'zip'],
  },
  '.pptx': {
    declaredMimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    detectedExtensions: ['pptx', 'zip'],
  },
  '.xlsx': {
    declaredMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    detectedExtensions: ['xlsx', 'zip'],
  },
  '.zip': {
    declaredMimeTypes: ['application/zip', 'application/x-zip-compressed'],
    detectedExtensions: ['zip'],
  },
  '.txt': { declaredMimeTypes: ['text/plain'], text: true },
  '.csv': { declaredMimeTypes: ['text/csv', 'text/plain'], text: true },
};

export interface StoredFileResult {
  originalName: string;
  storageName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedAt: Date;
}

export class LocalFileStorage {
  readonly #root: string;
  readonly #maximumBytes: number;

  constructor(directory: string, maximumSizeMb: number) {
    this.#root = path.resolve(directory);
    this.#maximumBytes = maximumSizeMb * 1_024 * 1_024;
  }

  get maximumBytes(): number {
    return this.#maximumBytes;
  }

  async store(
    file: Express.Multer.File,
    directory = 'training-resources',
  ): Promise<StoredFileResult> {
    if (file.size < 1 || file.buffer.length < 1) {
      throw new AppError(422, 'EMPTY_FILE', 'The uploaded file is empty.');
    }
    if (file.size > this.#maximumBytes) {
      throw new AppError(
        413,
        'FILE_TOO_LARGE',
        'The uploaded file exceeds the configured size limit.',
      );
    }
    const extension = path.extname(file.originalname).toLowerCase();
    const allowed = ALLOWED_FILE_TYPES[extension];
    if (allowed === undefined) {
      throw new AppError(
        422,
        'UNSUPPORTED_FILE_TYPE',
        'The uploaded file extension is not supported.',
      );
    }
    if (!allowed.declaredMimeTypes.includes(file.mimetype.toLowerCase())) {
      throw new AppError(
        422,
        'FILE_MIME_MISMATCH',
        'The declared file type does not match its extension.',
      );
    }
    if (allowed.text === true) {
      if (!isUtf8(file.buffer) || file.buffer.includes(0)) {
        throw new AppError(
          422,
          'FILE_SIGNATURE_MISMATCH',
          'The text file contains invalid binary data.',
        );
      }
    } else {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (
        detected === undefined ||
        !allowed.detectedExtensions?.includes(detected.ext)
      ) {
        throw new AppError(
          422,
          'FILE_SIGNATURE_MISMATCH',
          'The file signature does not match its extension.',
        );
      }
    }

    const id = randomUUID();
    const storageName = `${id}${extension}`;
    const relativePath = path.posix.join(
      directory,
      id.slice(0, 2),
      storageName,
    );
    const absolutePath = this.resolve(relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });
    return {
      originalName: path.basename(file.originalname).slice(0, 255),
      storageName,
      relativePath,
      mimeType: file.mimetype.toLowerCase(),
      sizeBytes: file.size,
      checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
      uploadedAt: new Date(),
    };
  }

  resolve(relativePath: string): string {
    const normalized = relativePath.replaceAll('/', path.sep);
    const absolutePath = path.resolve(this.#root, normalized);
    if (
      absolutePath !== this.#root &&
      !absolutePath.startsWith(`${this.#root}${path.sep}`)
    ) {
      throw new AppError(
        400,
        'INVALID_STORAGE_PATH',
        'The stored file path is invalid.',
      );
    }
    return absolutePath;
  }

  async remove(relativePath: string): Promise<void> {
    await rm(this.resolve(relativePath), { force: true });
  }
}
