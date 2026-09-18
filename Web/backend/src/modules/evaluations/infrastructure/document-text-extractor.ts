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

function spreadsheetText(files: Record<string, Uint8Array>): string {
  const decode = (value: Uint8Array) => new TextDecoder().decode(value);
  const tagText = (xml: string) =>
    [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((match) => match[1] ?? '')
      .join(' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
  const sharedXml = decode(files['xl/sharedStrings.xml'] ?? new Uint8Array());
  const shared = [...sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)]
    .map((match) => tagText(match[1] ?? ''))
    .filter(Boolean);
  const sheets = Object.entries(files)
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(([left], [right]) =>
      left.localeCompare(right, undefined, { numeric: true }),
    );
  return clean(
    sheets
      .flatMap(([, value]) => {
        const xml = decode(value);
        return [...xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map(
          (cell) => {
            const cellType = cell[1] ?? '';
            const raw = (cell[2] ?? '').match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '';
            if (/\bt=["']s["']/.test(cellType))
              return shared[Number(raw)] ?? raw;
            return raw || tagText(cell[2] ?? '');
          },
        );
      })
      .join(' '),
  );
}

export const EXTRACTABLE_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.pptx',
  '.xlsx',
  '.txt',
  '.csv',
] as const;

export class DocumentTextExtractor {
  async extract(absolutePath: string, originalName: string): Promise<string> {
    const extension = path.extname(originalName).toLowerCase();
    const buffer = await readFile(absolutePath);
    if (extension === '.txt' || extension === '.csv')
      return clean(buffer.toString('utf8'));
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
          /^ppt\/slides\/slide\d+\.xml$/.test(name) ||
          name === 'xl/sharedStrings.xml' ||
          /^xl\/worksheets\/sheet\d+\.xml$/.test(name);
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
    if (extension === '.xlsx') return spreadsheetText(files);
    return clean(
      Object.entries(files)
        .filter(([name]) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
        .map(([, value]) => xmlText(value))
        .join(' '),
    );
  }
}
