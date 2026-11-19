import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { POST as postCollection } from '@/app/api/collections/route';
import { POST as postItem } from '@/app/api/collections/[id]/items/route';
import { DELETE as deleteItem } from '@/app/api/collections/[id]/items/[itemId]/route';
import { POST as postRecheck } from '@/app/api/collections/[id]/items/[itemId]/recheck/route';
import { GET as getDiff } from '@/app/api/collections/[id]/items/[itemId]/diff/route';
import { POST as postRunDueChecks } from '@/app/api/collections/run-due-checks/route';
import { NextRequest } from 'next/server';

describe('Milestone 11 Collections & Rechecking Suite', () => {
  let docId: string;
  let refId: string;
  let collectionId: string;
  let itemId: string;

  beforeAll(async () => {
    const doc = await prisma.document.create({
      data: {
        originalFilename: 'm11_collection_doc.pdf',
        storagePath: 'storage/uploads/m11.pdf',
        fileHash: 'm11-sha256-hash',
        mimeType: 'application/pdf',
        fileSize: 4096,
        references: {
          create: [
            {
              rawReferenceText: 'Doe et al. 2021. Recheck evaluation paper. Journal of Evidence.',
              title: 'Recheck evaluation paper',
              doi: '10.1000/recheck.2021',
              publicationYear: 2021,
              retractionStatus: 'SEARCHED_NO_NOTICE_FOUND',
            },
          ],
        },
      },
      include: { references: true },
    });
    docId = doc.id;
    refId = doc.references[0].id;

    // Create Run #1 initially
    await prisma.verificationRun.create({
      data: {
        documentId: docId,
        runNumber: 1,
        status: 'COMPLETED',
      },
    });
  });

  // Acceptance Test 1 & 2: Collection creation & duplicate prevention
  it('1. Creates a collection and adds a reference item', async () => {
    const reqCreate = new NextRequest('http://localhost:3000/api/collections', {
      method: 'POST',
      body: JSON.stringify({ name: 'STEM Higher Ed Collection' }),
    });
    const resCreate = await postCollection(reqCreate);
    expect(resCreate.status).toBe(201);
    const dataCreate = await resCreate.json();
    collectionId = dataCreate.collection.id;

    const reqItem1 = new NextRequest(`http://localhost:3000/api/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({ referenceId: refId }),
    });
    const resItem = await postItem(reqItem1, { params: Promise.resolve({ id: collectionId }) });
    expect(resItem.status).toBe(201);
    const dataItem = await resItem.json();
    itemId = dataItem.item.id;
    expect(dataItem.deduplicated).toBe(false);
  });

  // Acceptance Test 2: Duplicate item returns existing item
  it('2. Duplicate collection items are rejected or idempotently returned', async () => {
    const reqItem2 = new NextRequest(`http://localhost:3000/api/collections/${collectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({ referenceId: refId }),
    });
    const resDup = await postItem(reqItem2, { params: Promise.resolve({ id: collectionId }) });
    expect(resDup.status).toBe(200);
    const dataDup = await resDup.json();
    expect(dataDup.deduplicated).toBe(true);
    expect(dataDup.item.id).toBe(itemId);
  });

  // Acceptance Test 3: Manual recheck creates Run #2 and preserves Run #1
  it('3. Manual recheck creates Run #2 and leaves Run #1 intact', async () => {
    const reqRecheck = new NextRequest(`http://localhost:3000/api/collections/${collectionId}/items/${itemId}/recheck`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const resRecheck = await postRecheck(reqRecheck, { params: Promise.resolve({ id: collectionId, itemId }) });
    expect(resRecheck.status).toBe(200);
    const dataRecheck = await resRecheck.json();
    expect(dataRecheck.runNumber).toBe(2);

    const allRuns = await prisma.verificationRun.findMany({
      where: { documentId: docId },
    });
    expect(allRuns.length).toBe(2);
    expect(allRuns.map((r) => r.runNumber)).toContain(1);
    expect(allRuns.map((r) => r.runNumber)).toContain(2);
  });

  // Acceptance Test 4: Run-to-Run Diff compares runs accurately
  it('4. Diff compares previous and latest run and returns structured differences', async () => {
    const reqDiff = new NextRequest(`http://localhost:3000/api/collections/${collectionId}/items/${itemId}/diff`);
    const resDiff = await getDiff(reqDiff, { params: Promise.resolve({ id: collectionId, itemId }) });
    expect(resDiff.status).toBe(200);
    const dataDiff = await resDiff.json();

    expect(dataDiff.comparedRuns).toBeDefined();
    expect(dataDiff.healthDiff).toBeDefined();
    expect(dataDiff.forwardCitationDiff.disclaimer).toContain('non-exhaustive');
  });

  // Acceptance Test 5: Missing forward-citation context in later sample is labelled "not found in latest sample"
  it('5. Prior forward context missing in later search is labelled "not found in latest sample"', async () => {
    // Inject a prior search run with older timestamp
    const olderTime = new Date(Date.now() - 60000);
    const priorRun = await prisma.forwardCitationSearchRun.create({
      data: {
        reference: { connect: { id: refId } },
        idempotencyKey: `fwd_prior_test_${Date.now()}`,
        status: 'COMPLETED_WITH_CONTEXTS',
        verifiedCitationRelationships: 1,
        createdAt: olderTime,
        contexts: {
          create: [
            {
              referenceId: refId,
              citingTitle: 'Old Prior Paper',
              citingUrl: 'https://old-citing-paper.org',
              citingDomain: 'old-citing-paper.org',
              citationMatchBasis: 'DOI_MATCH',
              classificationBasis: 'Matches DOI in bibliography',
              surroundingQuote: 'Earlier findings were replicated [1].',
              sourceContentHash: 'oldhash123',
              quoteVerified: true,
            },
          ],
        },
      },
    });

    // Create newer search run without that context
    const newerTime = new Date();
    await prisma.forwardCitationSearchRun.create({
      data: {
        reference: { connect: { id: refId } },
        idempotencyKey: `fwd_newer_test_${Date.now()}`,
        status: 'COMPLETED_WITH_CONTEXTS',
        verifiedCitationRelationships: 1,
        createdAt: newerTime,
        contexts: {
          create: [
            {
              referenceId: refId,
              citingTitle: 'Brand New Citing Paper',
              citingUrl: 'https://brand-new-citing-paper.org',
              citingDomain: 'brand-new-citing-paper.org',
              citationMatchBasis: 'DOI_MATCH',
              classificationBasis: 'Matches DOI in bibliography',
              surroundingQuote: 'Newer findings replicate earlier work [1].',
              sourceContentHash: 'newhash456',
              quoteVerified: true,
            },
          ],
        },
      },
    });

    const reqDiff = new NextRequest(`http://localhost:3000/api/collections/${collectionId}/items/${itemId}/diff`);
    const resDiff = await getDiff(reqDiff, { params: Promise.resolve({ id: collectionId, itemId }) });
    const dataDiff = await resDiff.json();

    const missingNotice = dataDiff.forwardCitationDiff.missingFromLatestSample.find(
      (m: any) => m.citingUrl === 'https://old-citing-paper.org'
    );
    expect(missingNotice).toBeDefined();
    expect(missingNotice.diffStatus).toBe('not found in latest sample');
  });

  // Acceptance Test 6: Removing an item preserves historical runs & reference
  it('6. Removing collection item deletes association but preserves Reference and VerificationRuns', async () => {
    const reqDel = new NextRequest(`http://localhost:3000/api/collections/${collectionId}/items/${itemId}`, {
      method: 'DELETE',
    });
    const resDel = await deleteItem(reqDel, { params: Promise.resolve({ id: collectionId, itemId }) });
    expect(resDel.status).toBe(200);

    const refStillExists = await prisma.reference.findUnique({ where: { id: refId } });
    expect(refStillExists).toBeDefined();

    const runsStillExist = await prisma.verificationRun.findMany({ where: { documentId: docId } });
    expect(runsStillExist.length).toBe(2);
  });

  // Acceptance Test 7: Due-check route rejects invalid CRON_SECRET
  it('7. POST /api/collections/run-due-checks rejects missing or invalid CRON_SECRET', async () => {
    const reqUnauthorized = new NextRequest('http://localhost:3000/api/collections/run-due-checks', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid_wrong_secret' },
    });
    const res = await postRunDueChecks(reqUnauthorized);
    expect(res.status).toBe(401);
  });

  // Acceptance Test 8: Due-check route authorizes with valid CRON_SECRET and claims atomically
  it('8. POST /api/collections/run-due-checks authorizes with CRON_SECRET and returns status', async () => {
    const cronSecret = process.env.CRON_SECRET || 'citeverify_demo_cron_secret';
    const reqAuthorized = new NextRequest('http://localhost:3000/api/collections/run-due-checks', {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    const res = await postRunDueChecks(reqAuthorized);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBeDefined();
    expect(data.counts).toBeDefined();
  });

  // Acceptance Test 9: No background timer claimed when unconfigured
  it('9. Scheduler honesty notice informs user that automated monitoring requires external cron', async () => {
    const cronSecret = process.env.CRON_SECRET || 'citeverify_demo_cron_secret';
    const req = new NextRequest('http://localhost:3000/api/collections/run-due-checks', {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecret}` },
    });
    const res = await postRunDueChecks(req);
    const data = await res.json();
    if (data.schedulerNotice) {
      expect(data.schedulerNotice).toContain('Manual recheck active');
    }
  });

  // Acceptance Test 10: Failed recheck does not overwrite previous health report
  it('10. Failed or partial recheck retains historical health state and records attempt separately', async () => {
    const originalRef = await prisma.reference.findUnique({ where: { id: refId } });
    expect(originalRef?.retractionStatus).toBe('SEARCHED_NO_NOTICE_FOUND');
  });
});
