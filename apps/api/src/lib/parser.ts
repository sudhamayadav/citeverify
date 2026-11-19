import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import mammoth from 'mammoth';
import * as pdfParsePkg from 'pdf-parse';

const PDFParseClass: any = (pdfParsePkg as any).PDFParse || pdfParsePkg;

export interface ParseLimits {
  maxSizeBytes: number; // default 20MB
  maxPages: number;     // default 200 pages
  maxChars: number;     // default 2,000,000 chars
  timeoutMs: number;    // default 30,000ms
}

export const DEFAULT_LIMITS: ParseLimits = {
  maxSizeBytes: 20 * 1024 * 1024,
  maxPages: 200,
  maxChars: 2_000_000,
  timeoutMs: 30_000,
};

export type ExtractionState =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'PARTIAL_OCR'
  | 'FAILED'
  | 'UNSUPPORTED_FORMAT'
  | 'PASSWORD_PROTECTED'
  | 'LIMIT_EXCEEDED'
  | 'OCR_UNAVAILABLE';

export interface PageExtractionResult {
  pageNumber: number;
  text: string;
  charCount: number;
  ocrAttempted: boolean;
  ocrConfidence: number | null;
  ocrLanguage: string | null;
  ocrResult: 'OCR_SUCCESS' | 'OCR_FAILED' | 'OCR_UNAVAILABLE' | null;
  warnings: string[];
}

export interface BlockExtractionResult {
  blockIndex: number;
  pageNumber: number | null;
  blockType: 'PARAGRAPH' | 'HEADING' | 'TABLE' | 'BIBLIOGRAPHY' | 'ABSTRACT' | 'METADATA';
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface DocumentParseResult {
  state: ExtractionState;
  fileHash: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  extractedText: string;
  pageCount: number;
  pages: PageExtractionResult[];
  blocks: BlockExtractionResult[];
  warnings: string[];
  error?: string;
}

/**
 * Validates file signature (magic bytes) against extension and reported MIME
 */
export function validateFileSignature(
  buffer: Buffer,
  filename: string,
  reportedMime: string
): { isValid: boolean; detectedFormat: 'pdf' | 'docx' | 'txt' | 'unknown'; error?: string } {
  // Check extension first
  const ext = path.extname(filename).toLowerCase();
  
  if (buffer.length < 4) {
    return { isValid: false, detectedFormat: 'unknown', error: 'File is empty or too small' };
  }

  // PDF signature: %PDF (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    if (ext !== '.pdf') {
      return { isValid: false, detectedFormat: 'pdf', error: 'File signature is PDF but extension mismatch' };
    }
    return { isValid: true, detectedFormat: 'pdf' };
  }

  // DOCX / ZIP signature: PK.. (0x50 0x4B 0x03 0x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    if (ext !== '.docx') {
      return { isValid: false, detectedFormat: 'docx', error: 'File signature is DOCX/ZIP but extension mismatch' };
    }
    return { isValid: true, detectedFormat: 'docx' };
  }

  // TXT: validate valid UTF-8 text (or pure ASCII)
  if (ext === '.txt') {
    // Check if valid text without control/null bytes
    let hasNull = false;
    for (let i = 0; i < Math.min(buffer.length, 1024); i++) {
      if (buffer[i] === 0) {
        hasNull = true;
        break;
      }
    }
    if (hasNull) {
      return { isValid: false, detectedFormat: 'unknown', error: 'Text file contains binary/null bytes' };
    }
    return { isValid: true, detectedFormat: 'txt' };
  }

  return { isValid: false, detectedFormat: 'unknown', error: `Unsupported or mismatched file format for extension '${ext}'` };
}

/**
 * Computes SHA-256 hash
 */
export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Extracts paragraphs and blocks with character offsets into extractedText
 */
export function extractBlocksFromText(
  extractedText: string,
  pages: PageExtractionResult[]
): BlockExtractionResult[] {
  const blocks: BlockExtractionResult[] = [];
  const lines = extractedText.split(/\r?\n\r?\n/);
  let currentOffset = 0;
  let blockIndex = 0;

  for (const rawBlock of lines) {
    const text = rawBlock.trim();
    const startOffset = extractedText.indexOf(rawBlock, currentOffset);
    const endOffset = startOffset + rawBlock.length;
    currentOffset = endOffset;

    if (!text) continue;

    // Detect block type
    let blockType: BlockExtractionResult['blockType'] = 'PARAGRAPH';
    const lower = text.toLowerCase();

    if (/^(abstract|summary)/i.test(text) && text.length < 200) {
      blockType = 'ABSTRACT';
    } else if (/^(references|bibliography|works cited)/i.test(text) && text.length < 100) {
      blockType = 'BIBLIOGRAPHY';
    } else if (text.length < 120 && (/^[0-9](\.[0-9]+)*\s+[A-Z]/i.test(text) || /^[A-Z\s]{4,80}$/.test(text))) {
      blockType = 'HEADING';
    } else if (/^table\s+[0-9]+/i.test(text)) {
      blockType = 'TABLE';
    }

    // Determine page number if available based on offset
    let pageNum: number | null = null;
    let accumulatedChars = 0;
    for (const page of pages) {
      if (startOffset >= accumulatedChars && startOffset < accumulatedChars + page.text.length + 2) {
        pageNum = page.pageNumber;
        break;
      }
      accumulatedChars += page.text.length + 1;
    }

    blocks.push({
      blockIndex: blockIndex++,
      pageNumber: pageNum,
      blockType,
      text,
      startOffset,
      endOffset,
    });
  }

  return blocks;
}

/**
 * Parses TXT file buffer
 */
export async function parseTxt(
  buffer: Buffer,
  limits: ParseLimits = DEFAULT_LIMITS
): Promise<Omit<DocumentParseResult, 'fileHash' | 'originalFilename' | 'storagePath' | 'fileSize'>> {
  const text = buffer.toString('utf-8');
  if (text.length > limits.maxChars) {
    return {
      state: 'LIMIT_EXCEEDED',
      mimeType: 'text/plain',
      extractedText: '',
      pageCount: 0,
      pages: [],
      blocks: [],
      warnings: [`File exceeds maximum text character limit of ${limits.maxChars}`],
      error: 'Character limit exceeded',
    };
  }

  const page: PageExtractionResult = {
    pageNumber: 1,
    text,
    charCount: text.length,
    ocrAttempted: false,
    ocrConfidence: null,
    ocrLanguage: null,
    ocrResult: null,
    warnings: [],
  };

  const blocks = extractBlocksFromText(text, [page]);

  return {
    state: 'SUCCESS',
    mimeType: 'text/plain',
    extractedText: text,
    pageCount: 1,
    pages: [page],
    blocks,
    warnings: [],
  };
}

/**
 * Parses DOCX file buffer
 */
export async function parseDocx(
  buffer: Buffer,
  limits: ParseLimits = DEFAULT_LIMITS
): Promise<Omit<DocumentParseResult, 'fileHash' | 'originalFilename' | 'storagePath' | 'fileSize'>> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value || '';
    const warnings = result.messages.map((m) => m.message);

    if (text.length > limits.maxChars) {
      return {
        state: 'LIMIT_EXCEEDED',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extractedText: '',
        pageCount: 0,
        pages: [],
        blocks: [],
        warnings: [...warnings, `Exceeds max character limit of ${limits.maxChars}`],
        error: 'Character limit exceeded',
      };
    }

    // DOCX does not have fixed physical pages natively; represent as logical document
    const page: PageExtractionResult = {
      pageNumber: 1,
      text,
      charCount: text.length,
      ocrAttempted: false,
      ocrConfidence: null,
      ocrLanguage: null,
      ocrResult: null,
      warnings: [],
    };

    const blocks = extractBlocksFromText(text, [page]);

    return {
      state: 'SUCCESS',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extractedText: text,
      pageCount: 1,
      pages: [page],
      blocks,
      warnings,
    };
  } catch (err: any) {
    return {
      state: 'FAILED',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extractedText: '',
      pageCount: 0,
      pages: [],
      blocks: [],
      warnings: [],
      error: err.message || 'DOCX parsing failed',
    };
  }
}

/**
 * Parses PDF buffer using pdf-parse with per-page text tracking & OCR fallback checks
 */
export async function parsePdf(
  buffer: Buffer,
  limits: ParseLimits = DEFAULT_LIMITS
): Promise<Omit<DocumentParseResult, 'fileHash' | 'originalFilename' | 'storagePath' | 'fileSize'>> {
  let parser: any = null;
  try {
    parser = new PDFParseClass({ data: buffer });
    await parser.load();
    const result = await parser.getText();
    const numPages = result.total || (result.pages ? result.pages.length : 1);

    if (numPages > limits.maxPages) {
      return {
        state: 'LIMIT_EXCEEDED',
        mimeType: 'application/pdf',
        extractedText: '',
        pageCount: numPages,
        pages: [],
        blocks: [],
        warnings: [`Document has ${numPages} pages, exceeding limit of ${limits.maxPages}`],
        error: 'Page limit exceeded',
      };
    }

    const pages: PageExtractionResult[] = [];
    const warnings: string[] = [];
    let hasOcrCandidate = false;

    const rawPages = result.pages || [{ text: result.text || '', num: 1 }];

    for (let i = 0; i < rawPages.length; i++) {
      const pItem = rawPages[i];
      const pText = (pItem && pItem.text ? pItem.text : '').trim();
      const charCount = pText.length;

      const pWarnings: string[] = [];
      let ocrAttempted = false;
      let ocrResult: PageExtractionResult['ocrResult'] = null;

      // Spec rule: Fewer than 40 chars is an OCR candidate, not proof that it is scanned
      if (charCount < 40) {
        hasOcrCandidate = true;
        ocrAttempted = true;
        // In local demo without traineddata installed, report OCR_UNAVAILABLE honestly
        ocrResult = 'OCR_UNAVAILABLE';
        pWarnings.push(`Low text content (${charCount} chars). Flagged as OCR candidate: OCR data unavailable locally.`);
      }

      pages.push({
        pageNumber: pItem.num || i + 1,
        text: pText,
        charCount,
        ocrAttempted,
        ocrConfidence: null,
        ocrLanguage: null,
        ocrResult,
        warnings: pWarnings,
      });
    }

    const fullText = pages.map((p) => p.text).join('\n\n');
    const blocks = extractBlocksFromText(fullText, pages);

    const state: ExtractionState = hasOcrCandidate
      ? 'PARTIAL_OCR'
      : fullText.trim().length > 0
      ? 'SUCCESS'
      : 'PARTIAL';

    return {
      state,
      mimeType: 'application/pdf',
      extractedText: fullText,
      pageCount: numPages,
      pages,
      blocks,
      warnings,
    };
  } catch (err: any) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('password') || msg.includes('encrypted')) {
      return {
        state: 'PASSWORD_PROTECTED',
        mimeType: 'application/pdf',
        extractedText: '',
        pageCount: 0,
        pages: [],
        blocks: [],
        warnings: ['Document is password-protected or encrypted.'],
        error: 'Password protected',
      };
    }

    return {
      state: 'FAILED',
      mimeType: 'application/pdf',
      extractedText: '',
      pageCount: 0,
      pages: [],
      blocks: [],
      warnings: [],
      error: `PDF parsing error: ${err.message}`,
    };
  } finally {
    if (parser && typeof parser.destroy === 'function') {
      try {
        await parser.destroy();
      } catch {}
    }
  }
}

/**
 * Main Document Ingestion Orchestrator
 */
export async function processDocumentBuffer(
  buffer: Buffer,
  originalFilename: string,
  reportedMime: string,
  storageDir: string,
  limits: ParseLimits = DEFAULT_LIMITS
): Promise<DocumentParseResult> {
  // 1. File size limit check
  if (buffer.length > limits.maxSizeBytes) {
    return {
      state: 'LIMIT_EXCEEDED',
      fileHash: computeFileHash(buffer),
      originalFilename,
      storagePath: '',
      mimeType: reportedMime,
      fileSize: buffer.length,
      extractedText: '',
      pageCount: 0,
      pages: [],
      blocks: [],
      warnings: [`File size (${buffer.length} bytes) exceeds limit of ${limits.maxSizeBytes}`],
      error: 'File size limit exceeded',
    };
  }

  // 2. Validate file signature and extension
  const sigCheck = validateFileSignature(buffer, originalFilename, reportedMime);
  if (!sigCheck.isValid) {
    return {
      state: 'UNSUPPORTED_FORMAT',
      fileHash: computeFileHash(buffer),
      originalFilename,
      storagePath: '',
      mimeType: reportedMime,
      fileSize: buffer.length,
      extractedText: '',
      pageCount: 0,
      pages: [],
      blocks: [],
      warnings: [sigCheck.error || 'Invalid file signature or extension mismatch'],
      error: sigCheck.error,
    };
  }

  // 3. Compute SHA-256 hash
  const fileHash = computeFileHash(buffer);

  // 4. Secure storage: generate opaque server filename, never use user filename
  // Sanitize path to prevent any traversal
  const opaqueId = crypto.randomUUID();
  const safeExt = path.extname(originalFilename).toLowerCase();
  const storageFilename = `${opaqueId}${safeExt}`;
  const absoluteStoragePath = path.resolve(storageDir, storageFilename);

  // Ensure storage dir exists
  await fs.mkdir(storageDir, { recursive: true });
  // Save bytes
  await fs.writeFile(absoluteStoragePath, buffer);

  // 5. Parse based on detected format
  let parsed: Omit<DocumentParseResult, 'fileHash' | 'originalFilename' | 'storagePath' | 'fileSize'>;

  if (sigCheck.detectedFormat === 'pdf') {
    parsed = await parsePdf(buffer, limits);
  } else if (sigCheck.detectedFormat === 'docx') {
    parsed = await parseDocx(buffer, limits);
  } else {
    parsed = await parseTxt(buffer, limits);
  }

  return {
    ...parsed,
    fileHash,
    originalFilename,
    storagePath: absoluteStoragePath,
    fileSize: buffer.length,
  };
}
