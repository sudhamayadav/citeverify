import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { prisma } from '@/lib/db';
import { processDocumentBuffer } from '@/lib/parser';

// Private storage directory outside public/
const STORAGE_DIR = path.resolve(process.cwd(), '../../storage/uploads');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const rawFilename = file.name || 'document';
    // Protect against path traversal in filenames
    const sanitizedFilename = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const mimeType = file.type || 'application/octet-stream';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ingestion & parsing
    const parseResult = await processDocumentBuffer(
      buffer,
      sanitizedFilename,
      mimeType,
      STORAGE_DIR
    );

    if (parseResult.state === 'UNSUPPORTED_FORMAT') {
      return NextResponse.json(
        {
          error: parseResult.error,
          state: parseResult.state,
          warnings: parseResult.warnings,
        },
        { status: 415 }
      );
    }

    if (parseResult.state === 'LIMIT_EXCEEDED') {
      return NextResponse.json(
        {
          error: parseResult.error,
          state: parseResult.state,
          warnings: parseResult.warnings,
        },
        { status: 413 }
      );
    }

    // Persist document record in SQLite via Prisma
    const doc = await prisma.document.create({
      data: {
        originalFilename: parseResult.originalFilename,
        storagePath: parseResult.storagePath,
        fileHash: parseResult.fileHash,
        mimeType: parseResult.mimeType,
        fileSize: parseResult.fileSize,
        extractedText: parseResult.extractedText,
        extractionState: parseResult.state,
        extractionWarnings: JSON.stringify(parseResult.warnings),
        pageCount: parseResult.pageCount,
        pages: {
          create: parseResult.pages.map((p) => ({
            pageNumber: p.pageNumber,
            text: p.text,
            charCount: p.charCount,
            ocrAttempted: p.ocrAttempted,
            ocrConfidence: p.ocrConfidence,
            ocrLanguage: p.ocrLanguage,
            ocrResult: p.ocrResult,
            warnings: JSON.stringify(p.warnings),
          })),
        },
        blocks: {
          create: parseResult.blocks.map((b) => ({
            pageNumber: b.pageNumber,
            blockIndex: b.blockIndex,
            blockType: b.blockType,
            text: b.text,
            startOffset: b.startOffset,
            endOffset: b.endOffset,
          })),
        },
      },
      include: {
        pages: true,
        blocks: true,
      },
    });

    return NextResponse.json({
      id: doc.id,
      originalFilename: doc.originalFilename,
      fileHash: doc.fileHash,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      extractionState: doc.extractionState,
      pageCount: doc.pageCount,
      warnings: parseResult.warnings,
      createdAt: doc.createdAt.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Document upload processing failed', detail: err.message },
      { status: 500 }
    );
  }
}
