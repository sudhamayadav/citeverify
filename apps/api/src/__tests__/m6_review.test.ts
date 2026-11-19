import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { appendHumanReview, verifyHumanReviewChain, applyHumanReviewSecurityTriggers } from '@/lib/humanReview';

describe('Milestone 6: Human Review, Role Gating, Append-Only Hash Chain', () => {
  let docId: string;
  let claimId: string;

  beforeAll(async () => {
    await applyHumanReviewSecurityTriggers();

    // Create a dummy document and claim
    const doc = await prisma.document.create({
      data: {
        originalFilename: 'm6_test.pdf',
        storagePath: 'test/storage/m6.pdf',
        fileHash: 'm6_test_hash_' + Date.now(),
        mimeType: 'application/pdf',
        fileSize: 1024,
      },
    });
    docId = doc.id;

    const claim = await prisma.claim.create({
      data: {
        documentId: doc.id,
        originalSentence: 'Test claim for human review.',
        normalizedClaim: 'Test claim for human review.',
        claimType: 'FACTUAL',
      },
    });
    claimId = claim.id;
  });

  it('1. Appends human review event with valid previousHash and recordHash', async () => {
    const rev1 = await appendHumanReview({
      documentId: docId,
      claimId,
      reviewerRole: 'Faculty Reviewer',
      reviewerLabel: 'Faculty Reviewer (Demo)',
      action: 'APPROVE',
      notes: 'Verified against primary literature',
      resultingState: 'SUPPORTED',
    });

    expect(rev1.id).toBeDefined();
    expect(rev1.recordHash).toBeDefined();
    expect(rev1.action).toBe('APPROVE');
    expect(rev1.resultingState).toBe('SUPPORTED');

    const rev2 = await appendHumanReview({
      documentId: docId,
      claimId,
      reviewerRole: 'Faculty Reviewer',
      reviewerLabel: 'Faculty Reviewer (Demo)',
      action: 'OVERRIDE',
      notes: 'Downgrading due to small sample size',
      resultingState: 'PARTLY_SUPPORTED',
    });

    expect(rev2.previousHash).toBe(rev1.recordHash);
    expect(rev2.action).toBe('OVERRIDE');
    expect(rev2.resultingState).toBe('PARTLY_SUPPORTED');
  });

  it('2. Verifies cryptographic integrity of the hash chain', async () => {
    const chainCheck = await verifyHumanReviewChain(docId);
    expect(chainCheck.valid).toBe(true);
    expect(chainCheck.total).toBeGreaterThanOrEqual(2);
  });

  it('3. SQLite triggers reject UPDATE and DELETE on HumanReview records', async () => {
    const rev = await prisma.humanReview.findFirst({
      where: { documentId: docId },
    });
    expect(rev).toBeDefined();

    // Attempt UPDATE via raw SQL
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE HumanReview SET notes = 'tampered' WHERE id = '${rev!.id}'`
      )
    ).rejects.toThrow(/append-only/i);

    // Attempt DELETE via raw SQL
    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM HumanReview WHERE id = '${rev!.id}'`
      )
    ).rejects.toThrow(/append-only/i);
  });
});
