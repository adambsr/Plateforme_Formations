import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { zipSync } from 'fflate';
import PDFDocument from 'pdfkit';
import { afterEach, describe, expect, it } from 'vitest';
import { DocumentTextExtractor } from '../src/modules/evaluations/infrastructure/document-text-extractor.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
async function workspace() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'phase9-extract-'));
  directories.push(directory);
  return directory;
}
function pdf(text: string): Promise<Buffer> {
  return new Promise((resolve) => {
    const document = new PDFDocument();
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.text(text);
    document.end();
  });
}

describe('Phase 9 supported document extraction', () => {
  it('extracts text PDF, DOCX, PPTX, and TXT without OCR', async () => {
    const directory = await workspace();
    const fixtures: Array<[string, Uint8Array, string]> = [
      ['lesson.txt', Buffer.from('Plain lesson text'), 'Plain lesson text'],
      [
        'lesson.docx',
        zipSync({
          'word/document.xml': Buffer.from(
            '<w:document><w:t>Word lesson text</w:t></w:document>',
          ),
        }),
        'Word lesson text',
      ],
      [
        'lesson.pptx',
        zipSync({
          'ppt/slides/slide2.xml': Buffer.from(
            '<p:sld><a:t>Second slide</a:t></p:sld>',
          ),
          'ppt/slides/slide1.xml': Buffer.from(
            '<p:sld><a:t>First slide</a:t></p:sld>',
          ),
        }),
        'First slide Second slide',
      ],
      ['lesson.pdf', await pdf('PDF lesson text'), 'PDF lesson text'],
    ];
    const extractor = new DocumentTextExtractor();
    for (const [name, contents, expected] of fixtures) {
      const target = path.join(directory, name);
      await writeFile(target, contents);
      expect(await extractor.extract(target, name)).toContain(expected);
    }
  });
});
