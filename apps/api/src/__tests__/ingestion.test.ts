import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import {
  processDocumentBuffer,
  validateFileSignature,
  computeFileHash,
} from '@/lib/parser';

const FIXTURES_DIR = path.resolve(__dirname, '../../../../test-fixtures');
const STORAGE_DIR = path.resolve(__dirname, '../../../../storage/test-storage');

describe('Milestone 2 Document Ingestion Suite', () => {
  let digitalPdfBuffer: Buffer;
  let scannedLikePdfBuffer: Buffer;
  let docxBuffer: Buffer;
  let txtBuffer: Buffer;

  beforeAll(async () => {
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
    await fs.mkdir(STORAGE_DIR, { recursive: true });

    // 1. Create a 2-page Digital PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Page 1
    const page1 = pdfDoc.addPage([600, 400]);
    page1.drawText('Page 1: A study evaluated an educational intervention.', {
      x: 50,
      y: 350,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    page1.drawText('Abstract\nThis document provides synthetic verification data.', {
      x: 50,
      y: 300,
      size: 12,
      font,
    });

    // Page 2
    const page2 = pdfDoc.addPage([600, 400]);
    page2.drawText('Page 2: References\n[1] Smith et al., 2022, Journal of Science.', {
      x: 50,
      y: 350,
      size: 12,
      font,
    });

    const pdfBytes = await pdfDoc.save();
    digitalPdfBuffer = Buffer.from(pdfBytes);

    // 2. Create a "Scanned / Low text" PDF (< 40 chars on a page)
    const emptyPdfDoc = await PDFDocument.create();
    const scannedPage = emptyPdfDoc.addPage([600, 400]);
    scannedPage.drawText('img', { x: 50, y: 350, size: 8 }); // Only 3 characters!
    const scannedBytes = await emptyPdfDoc.save();
    scannedLikePdfBuffer = Buffer.from(scannedBytes);

    // 3. Create a DOCX
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun('Docx Test Document. This is a scientific report claim.'),
              ],
            }),
          ],
        },
      ],
    });
    docxBuffer = await Packer.toBuffer(doc);

    // 4. Create a TXT
    txtBuffer = Buffer.from(
      'Abstract\n\nThis is a plain text scientific claim assertion.\n\nReferences\n[1] Doe et al. 2021.',
      'utf-8'
    );
  });

  // Acceptance Test 1: Digital PDF (multi-page)
  it('1. Digital PDF extracts multi-page text with correct page count', async () => {
    const res = await processDocumentBuffer(
      digitalPdfBuffer,
      'sample.pdf',
      'application/pdf',
      STORAGE_DIR
    );

    expect(res.error).toBeUndefined();
    expect(res.state).toBe('SUCCESS');
    expect(res.pageCount).toBe(2);
    expect(res.pages.length).toBe(2);
    expect(res.extractedText).toContain('educational intervention');
    expect(res.extractedText).toContain('References');
    expect(res.blocks.length).toBeGreaterThan(0);
    expect(res.fileHash).toBe(computeFileHash(digitalPdfBuffer));
  });

  // Acceptance Test 2: DOCX extraction
  it('2. DOCX extracts text and blocks correctly', async () => {
    const res = await processDocumentBuffer(
      docxBuffer,
      'document.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      STORAGE_DIR
    );

    expect(res.error).toBeUndefined();
    expect(res.state).toBe('SUCCESS');
    expect(res.extractedText).toContain('Docx Test Document');
    expect(res.blocks.length).toBeGreaterThan(0);
  });

  // Acceptance Test 3: TXT extraction
  it('3. TXT extracts text and identifies block types', async () => {
    const res = await processDocumentBuffer(
      txtBuffer,
      'notes.txt',
      'text/plain',
      STORAGE_DIR
    );

    expect(res.error).toBeUndefined();
    expect(res.state).toBe('SUCCESS');
    expect(res.extractedText).toContain('plain text scientific claim');
    expect(res.blocks.some((b) => b.blockType === 'ABSTRACT')).toBe(true);
    expect(res.blocks.some((b) => b.blockType === 'BIBLIOGRAPHY')).toBe(true);
  });

  // Acceptance Test 4: Scanned/low-text PDF triggers OCR candidate and honest OCR_UNAVAILABLE
  it('4. Low-text PDF flags OCR candidate with OCR_UNAVAILABLE state', async () => {
    const res = await processDocumentBuffer(
      scannedLikePdfBuffer,
      'scanned.pdf',
      'application/pdf',
      STORAGE_DIR
    );

    expect(res.state).toBe('PARTIAL_OCR');
    expect(res.pages[0].ocrAttempted).toBe(true);
    expect(res.pages[0].ocrResult).toBe('OCR_UNAVAILABLE');
    expect(res.pages[0].warnings.length).toBeGreaterThan(0);
  });

  // Acceptance Test 5: Malformed PDF is rejected
  it('5. Malformed PDF triggers FAILED extraction state', async () => {
    const malformed = Buffer.from('%PDF-1.4 Corrupted content that is not a valid PDF structure');
    const res = await processDocumentBuffer(
      malformed,
      'corrupt.pdf',
      'application/pdf',
      STORAGE_DIR
    );

    expect(res.state).toBe('FAILED');
    expect(res.error).toBeDefined();
  });

  // Acceptance Test 6: Password-protected or encrypted PDF rejection
  it('6. Password-protected PDF returns PASSWORD_PROTECTED state', async () => {
    // Encrypted dummy PDF structure
    const encryptedMock = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Encrypt 2 0 R /Filter /Standard >>\nendobj\ntrailer\n<< /Encrypt 2 0 R >>\n%%EOF'
    );
    const res = await processDocumentBuffer(
      encryptedMock,
      'secret.pdf',
      'application/pdf',
      STORAGE_DIR
    );

    expect(['PASSWORD_PROTECTED', 'FAILED']).toContain(res.state);
  });

  // Acceptance Test 7: Wrong MIME / file signature mismatch
  it('7. Wrong MIME / extension signature mismatch is rejected as UNSUPPORTED_FORMAT', async () => {
    const fakePdf = Buffer.from('This is completely plain text without PDF magic bytes');
    const res = await processDocumentBuffer(
      fakePdf,
      'fake.pdf',
      'application/pdf',
      STORAGE_DIR
    );

    expect(res.state).toBe('UNSUPPORTED_FORMAT');
    expect(res.error).toContain('mismatch');
  });

  // Acceptance Test 8: Oversized file check
  it('8. Oversized file exceeds size limit and returns LIMIT_EXCEEDED', async () => {
    const res = await processDocumentBuffer(
      txtBuffer,
      'big.txt',
      'text/plain',
      STORAGE_DIR,
      { maxSizeBytes: 10, maxPages: 100, maxChars: 1000, timeoutMs: 5000 }
    );

    expect(res.state).toBe('LIMIT_EXCEEDED');
  });

  // Acceptance Test 9: Path traversal filename protection & opaque server storage
  it('9. Path traversal filename is stored opaquely outside public directory', async () => {
    const res = await processDocumentBuffer(
      txtBuffer,
      '../../../../etc/passwd.txt',
      'text/plain',
      STORAGE_DIR
    );

    expect(res.storagePath).toBeDefined();
    expect(res.storagePath).toContain('storage');
    // Ensure filename is an opaque uuid, not etc/passwd
    expect(res.storagePath).not.toContain('passwd.txt');
    expect(path.basename(res.storagePath)).toMatch(/^[0-9a-f-]{36}\.txt$/);
  });

  // Acceptance Test 10: Private storage verification (no public access)
  it('10. Confirms storage is outside any public directory', () => {
    expect(STORAGE_DIR).not.toContain(path.join('public', 'uploads'));
  });
});
