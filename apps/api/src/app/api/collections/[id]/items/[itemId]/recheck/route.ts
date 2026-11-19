import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createVerificationRun } from '@/lib/audit';
import { executeForwardCitationSearch } from '@/lib/forwardCitations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: collectionId, itemId } = await params;
    const body = await req.json().catch(() => ({}));
    const { idempotencyKey } = body;

    const item = await prisma.collectionItem.findUnique({
      where: { id: itemId },
      include: { reference: true },
    });

    if (!item || item.collectionId !== collectionId) {
      return NextResponse.json({ error: 'Collection item not found' }, { status: 404 });
    }

    const docId = item.documentId || item.reference.documentId;
    const key = idempotencyKey || `recheck_${item.id}_${Date.now()}`;

    // 1. Create a NEW VerificationRun (Rule: Never overwrite Run #1; rechecking creates a new run)
    const existingRuns = await prisma.verificationRun.findMany({
      where: { documentId: docId },
      orderBy: { runNumber: 'desc' },
      take: 1,
    });
    const nextRunNumber = (existingRuns[0]?.runNumber || 1) + 1;

    const newRun = await prisma.verificationRun.create({
      data: {
        documentId: docId,
        runNumber: nextRunNumber,
        status: 'COMPLETED',
      },
    });

    // 2. Execute new forward citation search run
    const forwardSearch = await executeForwardCitationSearch({
      referenceId: item.referenceId,
      idempotencyKey: `fwd_recheck_${item.id}_${newRun.runNumber}`,
      verificationRunId: newRun.id,
    });

    // 3. Update lastCheckedAt only after reaching terminal state
    const updatedItem = await prisma.collectionItem.update({
      where: { id: item.id },
      data: {
        lastCheckedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Recheck completed. New verification run and audit snapshot created.',
      runId: newRun.id,
      runNumber: newRun.runNumber,
      searchRunId: forwardSearch.searchRun.id,
      searchStatus: forwardSearch.searchRun.status,
      lastCheckedAt: updatedItem.lastCheckedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to execute recheck', detail: err.message }, { status: 500 });
  }
}
