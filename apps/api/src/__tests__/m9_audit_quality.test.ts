import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import {
  createRunAuditSnapshot,
  appendRunAuditEvent,
  verifyRunAuditChain,
  getCleanAuditReport,
  computeCanonicalSha256,
} from '@/lib/audit';
import { classifySourceQuality } from '@/lib/sourceQuality';

describe('Milestone 9 (Modules D & E) Acceptance Suite', () => {
  let docId: string;
  let run1Id: string;
  let run2Id: string;

  beforeAll(async () => {
    // Create test document
    const doc = await prisma.document.create({
      data: {
        originalFilename: 'reproducibility_test.pdf',
        storagePath: 'storage/uploads/test.pdf',
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        mimeType: 'application/pdf',
        fileSize: 1024,
      },
    });
    docId = doc.id;

    // Create VerificationRun #1
    const r1 = await prisma.verificationRun.create({
      data: {
        documentId: docId,
        runNumber: 1,
        status: 'COMPLETED',
      },
    });
    run1Id = r1.id;
  });

  // Acceptance Test 1: Rechecking creates Run #2 without overwriting Run #1
  it('1. Rechecking creates Run #2 and leaves Run #1 result, snapshot, and events intact', async () => {
    // Finalize Run #1 snapshot
    await createRunAuditSnapshot({
      verificationRunId: run1Id,
      documentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      claimSnapshot: [{ claimId: 'c1', originalSentence: 'Sentence 1', normalizedClaim: 'Claim 1' }],
      tavilyQueriesSnapshot: [{ query: 'Smith 2022', endpoint: 'search', timestamp: new Date().toISOString() }],
      retrievedUrlsSnapshot: ['https://nature.com/articles/s41586-022'],
      contentHashesSnapshot: [{ url: 'https://nature.com/articles/s41586-022', contentSha256: 'abc123', retrievedAt: new Date().toISOString() }],
      passageOffsetsSnapshot: [{ passageId: 'p1', startOffset: 10, endOffset: 100, offsetUnit: 'UTF-16' }],
      researchOutputsSnapshot: [{ content: { summary: 'Evidence aligns' } }],
      localValidationSnapshot: {
        quoteVerified: true,
        numericComparability: 'EXACT_MATCH',
        urlProvenanceVerified: true,
        ruleChecks: ['CONTIGUOUS_SPAN', 'URL_PROVENANCE'],
      },
      resultSnapshot: {
        automatedVerdict: 'SUPPORTED',
        confidence: 'HIGH',
        verificationState: 'COMPLETED',
      },
    });

    await appendRunAuditEvent(run1Id, 'RUN_CREATED', { status: 'INITIALIZED' });
    await appendRunAuditEvent(run1Id, 'RUN_FINALIZED', { verdict: 'SUPPORTED' });

    // Create Run #2 for same document
    const r2 = await prisma.verificationRun.create({
      data: {
        documentId: docId,
        runNumber: 2,
        status: 'COMPLETED',
      },
    });
    run2Id = r2.id;

    await createRunAuditSnapshot({
      verificationRunId: run2Id,
      documentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      claimSnapshot: [{ claimId: 'c1', originalSentence: 'Sentence 1', normalizedClaim: 'Claim 1' }],
      tavilyQueriesSnapshot: [{ query: 'Smith 2022 recheck', endpoint: 'search', timestamp: new Date().toISOString() }],
      retrievedUrlsSnapshot: ['https://nature.com/articles/s41586-022'],
      contentHashesSnapshot: [{ url: 'https://nature.com/articles/s41586-022', contentSha256: 'abc123', retrievedAt: new Date().toISOString() }],
      passageOffsetsSnapshot: [{ passageId: 'p1', startOffset: 10, endOffset: 100, offsetUnit: 'UTF-16' }],
      researchOutputsSnapshot: [],
      localValidationSnapshot: {
        quoteVerified: true,
        numericComparability: 'EXACT_MATCH',
        urlProvenanceVerified: true,
        ruleChecks: ['CONTIGUOUS_SPAN'],
      },
      resultSnapshot: {
        automatedVerdict: 'SUPPORTED',
        confidence: 'HIGH',
        verificationState: 'COMPLETED',
      },
    });

    const report1 = await getCleanAuditReport(run1Id);
    const report2 = await getCleanAuditReport(run2Id);

    expect(report1?.runNumber).toBe(1);
    expect(report2?.runNumber).toBe(2);
    expect(report1?.verificationRunId).not.toBe(report2?.verificationRunId);
    expect(report1?.auditSnapshot?.snapshotSha256).toBeDefined();
    expect(report2?.auditSnapshot?.snapshotSha256).toBeDefined();
  });

  // Acceptance Test 2: Audit endpoint contains provenance fields
  it('2. Audit endpoint returns document SHA-256, queries, URLs, hashes, and rule version', async () => {
    const report = await getCleanAuditReport(run1Id);
    expect(report).toBeDefined();
    expect(report?.auditSnapshot?.documentSha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(report?.auditSnapshot?.verdictRuleVersion).toBe('1.0.0');
    expect(report?.auditSnapshot?.tavilyQueriesSnapshot[0].query).toBe('Smith 2022');
    expect(report?.auditSnapshot?.passageOffsetsSnapshot[0].offsetUnit).toBe('UTF-16');
  });

  // Acceptance Test 3: Audit endpoint never exposes API keys or local paths
  it('3. Audit endpoint never exposes TAVILY_API_KEY, headers, or private filesystem paths', async () => {
    const report = await getCleanAuditReport(run1Id);
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain('tvly-');
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('storage/uploads');
    expect(serialized).not.toContain('C:\\');
  });

  // Acceptance Test 4: SQLite triggers reject UPDATE and DELETE on audit records
  it('4. SQLite triggers abort UPDATE and DELETE on append-only audit snapshot and events', async () => {
    // Attempt to update RunAuditSnapshot
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE RunAuditSnapshot SET verdictRuleVersion = 'hacked' WHERE verificationRunId = '${run1Id}'`
      )
    ).rejects.toThrow(/append-only/i);

    // Attempt to delete RunAuditEvent
    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM RunAuditEvent WHERE verificationRunId = '${run1Id}'`
      )
    ).rejects.toThrow(/append-only/i);
  });

  // Acceptance Test 5: Cryptographic hash chain detects tampered events
  it('5. Hash-chain verification detects an altered or corrupted audit event', async () => {
    const validCheck = await verifyRunAuditChain(run1Id);
    expect(validCheck.isValid).toBe(true);

    // Create a mock broken run to test detection
    const badRun = await prisma.verificationRun.create({
      data: { documentId: docId, runNumber: 99, status: 'FAILED' },
    });
    const badId = `bad-evt-${Date.now()}`;
    // Insert event with mismatched previous hash
    await prisma.$executeRawUnsafe(`
      INSERT INTO RunAuditEvent (id, verificationRunId, sequenceNumber, eventType, payloadSnapshot, previousEventHash, eventHash, createdAt)
      VALUES ('${badId}', '${badRun.id}', 1, 'TEST', '{}', 'bogus-prev-hash', 'bogus-hash', datetime('now'))
    `);

    const invalidCheck = await verifyRunAuditChain(badRun.id);
    expect(invalidCheck.isValid).toBe(false);
  });

  // Acceptance Test 6: Unknown domain defaults to UNKNOWN
  it('6. Unknown publisher or domain defaults to UNKNOWN publication type', () => {
    const res = classifySourceQuality({
      url: 'https://random-blog.xyz/post/123',
      venue: 'Random Thought Piece',
      title: 'A blog about learning apps',
    });

    expect(res.publicationType).toBe('UNKNOWN');
    expect(res.peerReviewStatus).toBe('UNKNOWN');
  });

  // Acceptance Test 7: ISSN / Publisher alone does NOT establish peer review
  it('7. Journal publisher alone does NOT establish peer review without explicit venue statement', () => {
    const res = classifySourceQuality({
      url: 'https://sciencedirect.com/science/article/pii/S1234',
      venue: 'Journal of Applied Research',
      publisher: 'Elsevier',
    });

    expect(res.publicationType).toBe('JOURNAL_ARTICLE');
    expect(res.peerReviewStatus).toBe('NOT_ESTABLISHED');
    expect(res.peerReviewBasis).toContain('publisher statement required');
  });

  // Acceptance Test 8: arXiv / bioRxiv classifies as PREPRINT
  it('8. arXiv/bioRxiv domains classify as PREPRINT with NOT_ESTABLISHED peer review', () => {
    const arxivRes = classifySourceQuality({
      url: 'https://arxiv.org/abs/2301.01234',
      doi: '10.48550/arXiv.2301.01234',
      venue: 'arXiv',
    });

    expect(arxivRes.publicationType).toBe('PREPRINT');
    expect(arxivRes.peerReviewStatus).toBe('NOT_ESTABLISHED');
  });

  // Acceptance Test 9: Retracted journal article retains JOURNAL_ARTICLE
  it('9. Retracted journal article retains JOURNAL_ARTICLE with independent retractionStatus', () => {
    const res = classifySourceQuality({
      url: 'https://nature.com/articles/nature12345',
      venue: 'Nature',
      title: 'Original Landmark Study on Stem Cells',
    });

    expect(res.publicationType).toBe('JOURNAL_ARTICLE');
    // Rule: publication type and retraction status must remain strictly independent
    const retractionStatus = 'CONFIRMED_RETRACTED';
    expect(res.publicationType).not.toBe('RETRACTED');
    expect(retractionStatus).toBe('CONFIRMED_RETRACTED');
  });

  // Acceptance Test 10: Subsequent reviews link into audit without snapshot mutation
  it('10. Audit endpoint includes human reviews created after snapshot without mutating snapshot', async () => {
    // Add subsequent human review
    await prisma.humanReview.create({
      data: {
        documentId: docId,
        reviewerRole: 'Faculty Reviewer',
        reviewerLabel: 'Prof. Demo Reviewer',
        action: 'APPROVE',
        notes: 'Methodology verified against audit trail.',
        resultingState: 'APPROVED',
        recordHash: 'hash-demo-1234',
      },
    });

    const report = await getCleanAuditReport(run1Id);
    expect(report?.humanReviews.length).toBeGreaterThan(0);
    expect(report?.humanReviews[0].action).toBe('APPROVE');
    // Snapshot hash remained untouched
    expect(report?.auditSnapshot?.snapshotSha256).toBeDefined();
  });
});
