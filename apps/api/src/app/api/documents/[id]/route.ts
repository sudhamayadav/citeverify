import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await prisma.document.findUnique({
      where: { id },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          select: {
            id: true,
            pageNumber: true,
            charCount: true,
            ocrAttempted: true,
            ocrResult: true,
            warnings: true,
          },
        },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: doc.id,
      originalFilename: doc.originalFilename,
      fileHash: doc.fileHash,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      extractionState: doc.extractionState,
      pageCount: doc.pageCount,
      warnings: doc.extractionWarnings ? JSON.parse(doc.extractionWarnings) : [],
      pages: doc.pages,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve document' }, { status: 500 });
  }
}
