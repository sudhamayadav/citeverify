import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { appendHumanReview } from '@/lib/humanReview';
import { DEMO_ROLE_COOKIE } from '@/lib/constants';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: claimId } = await params;

    // Check server-side demo role cookie
    const roleCookie = req.cookies.get(DEMO_ROLE_COOKIE)?.value;
    if (roleCookie !== 'Faculty Reviewer') {
      return NextResponse.json(
        {
          error: 'Forbidden: Human review requires Faculty Reviewer demo role.',
          currentRole: roleCookie || 'Researcher',
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, notes, resultingState, previousDecision } = body;

    if (!action || !resultingState) {
      return NextResponse.json(
        { error: 'action (APPROVE | OVERRIDE | REJECT | COMMENT) and resultingState are required.' },
        { status: 400 }
      );
    }

    const claim = await prisma.claim.findUnique({
      where: { id: claimId },
      include: {
        verifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    const priorVerdict = previousDecision || claim.verifications[0] || null;

    // Append append-only HumanReview record
    const review = await appendHumanReview({
      documentId: claim.documentId,
      claimId: claim.id,
      reviewerRole: 'Faculty Reviewer',
      reviewerLabel: 'Faculty Reviewer (Demo Identity)',
      action,
      notes,
      previousDecision: priorVerdict,
      resultingState,
    });

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        claimId: review.claimId,
        documentId: review.documentId,
        action: review.action,
        resultingState: review.resultingState,
        notes: review.notes,
        previousHash: review.previousHash,
        recordHash: review.recordHash,
        createdAt: review.createdAt,
      },
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
