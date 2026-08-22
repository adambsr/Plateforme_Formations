import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { PDFParse } from 'pdf-parse';

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function xmlText(value: Uint8Array): string {
  const xml = new TextDecoder().decode(value);
  return clean(
    [...xml.matchAll(/<(?:w:t|a:t)(?:\s[^>]*)?>([\s\S]*?)<\/(?:w:t|a:t)>/g)]
      .map((match) => match[1] ?? '')
      .join(' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>'),
  );
}

export const EXTRACTABLE_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.pptx',
  '.txt',
] as const;

export class DocumentTextExtractor {
  async extract(absolutePath: string, originalName: string): Promise<string> {
    const extension = path.extname(originalName).toLowerCase();
    const buffer = await readFile(absolutePath);
    if (extension === '.txt') return clean(buffer.toString('utf8'));
    if (extension === '.pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        return clean((await parser.getText()).text);
      } finally {
        await parser.destroy();
      }
    }
    let expandedBytes = 0;
    const files = unzipSync(new Uint8Array(buffer), {
      filter: ({ name, originalSize }) => {
        const selected =
          name === 'word/document.xml' ||
          /^ppt\/slides\/slide\d+\.xml$/.test(name);
        if (selected) {
          expandedBytes += originalSize;
          if (expandedBytes > 20_000_000)
            throw new Error('Office document text is too large to extract.');
        }
        return selected;
      },
    });
    if (extension === '.docx')
      return xmlText(files['word/document.xml'] ?? new Uint8Array());
    return clean(
      Object.entries(files)
        .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([, value]) => xmlText(value))
        .join(' '),
    );
  }
}
