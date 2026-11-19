import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyHumanReviewChain } from '@/lib/humanReview';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    const reviews = await prisma.humanReview.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
    });

    const chainVerification = await verifyHumanReviewChain(documentId);

    return NextResponse.json({
      documentId,
      reviews,
      chainVerification,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
