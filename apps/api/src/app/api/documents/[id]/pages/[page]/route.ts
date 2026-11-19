import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; page: string }> }
) {
  try {
    const { id, page } = await params;
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum)) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 });
    }

    const docPage = await prisma.documentPage.findUnique({
      where: {
        documentId_pageNumber: {
          documentId: id,
          pageNumber: pageNum,
        },
      },
    });

    if (!docPage) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const blocks = await prisma.documentBlock.findMany({
      where: {
        documentId: id,
        pageNumber: pageNum,
      },
      orderBy: { blockIndex: 'asc' },
    });

    return NextResponse.json({
      pageNumber: docPage.pageNumber,
      text: docPage.text,
      charCount: docPage.charCount,
      ocrAttempted: docPage.ocrAttempted,
      ocrResult: docPage.ocrResult,
      warnings: docPage.warnings ? JSON.parse(docPage.warnings) : [],
      blocks,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve page text' }, { status: 500 });
  }
}
