import crypto from 'crypto';
import { prisma } from '@/lib/db';

export function computeRecordHash(data: {
  documentId?: string | null;
  claimId?: string | null;
  reviewerRole: string;
  reviewerLabel: string;
  action: string;
  notes?: string | null;
  previousDecision?: string | null;
  resultingState: string;
  previousHash?: string | null;
  createdAt: string | Date;
}): string {
  const canonical = JSON.stringify({
    documentId: data.documentId || null,
    claimId: data.claimId || null,
    reviewerRole: data.reviewerRole,
    reviewerLabel: data.reviewerLabel,
    action: data.action,
    notes: data.notes || null,
    previousDecision: data.previousDecision || null,
    resultingState: data.resultingState,
    previousHash: data.previousHash || null,
    createdAt: new Date(data.createdAt).toISOString(),
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export async function appendHumanReview(params: {
  documentId?: string | null;
  claimId?: string | null;
  reviewerRole: string;
  reviewerLabel: string;
  action: 'APPROVE' | 'OVERRIDE' | 'REJECT' | 'COMMENT';
  notes?: string | null;
  previousDecision?: any;
  resultingState: string;
}) {
  // Get last review record in the document or claim chain
  const lastReview = await prisma.humanReview.findFirst({
    where: params.documentId ? { documentId: params.documentId } : undefined,
    orderBy: { createdAt: 'desc' },
  });

  const previousHash = lastReview ? lastReview.recordHash : 'GENESIS_HASH_0000000000000000000000000000000000000000000000000000000000000000';
  const now = new Date();

  const recordHash = computeRecordHash({
    documentId: params.documentId,
    claimId: params.claimId,
    reviewerRole: params.reviewerRole,
    reviewerLabel: params.reviewerLabel,
    action: params.action,
    notes: params.notes,
    previousDecision: params.previousDecision ? JSON.stringify(params.previousDecision) : null,
    resultingState: params.resultingState,
    previousHash,
    createdAt: now,
  });

  const review = await prisma.humanReview.create({
    data: {
      documentId: params.documentId || null,
      claimId: params.claimId || null,
      reviewerRole: params.reviewerRole,
      reviewerLabel: params.reviewerLabel,
      action: params.action,
      notes: params.notes || null,
      previousDecision: params.previousDecision ? JSON.stringify(params.previousDecision) : null,
      resultingState: params.resultingState,
      previousHash,
      recordHash,
      createdAt: now,
    },
  });

  return review;
}

export async function verifyHumanReviewChain(documentId?: string): Promise<{ valid: boolean; total: number; error?: string }> {
  const reviews = await prisma.humanReview.findMany({
    where: documentId ? { documentId } : undefined,
    orderBy: { createdAt: 'asc' },
  });

  let expectedPreviousHash = 'GENESIS_HASH_0000000000000000000000000000000000000000000000000000000000000000';

  for (let i = 0; i < reviews.length; i++) {
    const r = reviews[i];
    if (i === 0) {
      if (r.previousHash !== expectedPreviousHash && r.previousHash !== null) {
        // First record may reference genesis
      }
    } else {
      if (r.previousHash !== reviews[i - 1].recordHash) {
        return { valid: false, total: reviews.length, error: `Broken chain at index ${i}: expected ${reviews[i - 1].recordHash}, found ${r.previousHash}` };
      }
    }

    const recomputed = computeRecordHash({
      documentId: r.documentId,
      claimId: r.claimId,
      reviewerRole: r.reviewerRole,
      reviewerLabel: r.reviewerLabel,
      action: r.action,
      notes: r.notes,
      previousDecision: r.previousDecision,
      resultingState: r.resultingState,
      previousHash: r.previousHash,
      createdAt: r.createdAt,
    });

    if (recomputed !== r.recordHash) {
      return { valid: false, total: reviews.length, error: `Invalid recordHash at index ${i}: stored ${r.recordHash}, computed ${recomputed}` };
    }
  }

  return { valid: true, total: reviews.length };
}

export async function applyHumanReviewSecurityTriggers(): Promise<void> {
  // Prevent UPDATE on HumanReview
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS abort_human_review_update
    BEFORE UPDATE ON HumanReview
    BEGIN
      SELECT RAISE(ABORT, 'HumanReview is append-only and cannot be updated');
    END;
  `);

  // Prevent DELETE on HumanReview
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS abort_human_review_delete
    BEFORE DELETE ON HumanReview
    BEGIN
      SELECT RAISE(ABORT, 'HumanReview is append-only and cannot be deleted');
    END;
  `);
}
