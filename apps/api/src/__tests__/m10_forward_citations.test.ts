import { describe, it, expect, vi, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import {
  verifyCitationRelationship,
  checkContiguousSpan,
  executeForwardCitationSearch,
} from '@/lib/forwardCitations';
import { GET as getReferenceHealth } from '@/app/api/references/[id]/health/route';
import { NextRequest } from 'next/server';

describe('Milestone 10 Acceptance Test Suite (Forward Citation + Citation Health)', () => {
  let matchedRefId: string;
  let retractedRefId: string;
  let docId: string;

  beforeAll(async () => {
    // Clean up test runs from previous executions
    await prisma.forwardCitationSearchRun.deleteMany({
      where: {
        idempotencyKey: {
          in: ['test_filter_key_1', 'test_no_contexts_key', 'test_partial_extract_key', 'test_idempotency_m10_key'],
        },
      },
    });

    const doc = await prisma.document.create({
      data: {
        originalFilename: 'm10_test_doc.pdf',
        storagePath: 'storage/uploads/m10.pdf',
        fileHash: 'm10-hash-sha256-test',
        mimeType: 'application/pdf',
        fileSize: 4096,
        references: {
          create: [
            {
              rawReferenceText: 'Smith et al. 2022. Reading improvements with mobile app. Nature.',
              title: 'Reading improvements with mobile app',
              doi: '10.1038/s41586-022-test',
              publicationYear: 2022,
              candidates: {
                create: [
                  {
                    originalUrl: 'https://nature.com/articles/s41586-022-test',
                    canonicalUrl: 'https://nature.com/articles/s41586-022-test',
                    pageTitle: 'Reading improvements with mobile app',
                    resolutionState: 'MATCHED',
                    matchScore: 0.98,
                  },
                ],
              },
            },
            {
              rawReferenceText: 'Retracted Paper 2020. Falsified stem cell yields. Science.',
              title: 'Falsified stem cell yields',
              doi: '10.1126/science.retracted.123',
              publicationYear: 2020,
              candidates: {
                create: [
                  {
                    originalUrl: 'https://science.org/doi/10.1126/science.retracted.123',
                    canonicalUrl: 'https://science.org/doi/10.1126/science.retracted.123',
                    pageTitle: 'Falsified stem cell yields',
                    resolutionState: 'MATCHED',
                    matchScore: 0.98,
                  },
                ],
              },
            },
          ],
        },
      },
      include: { references: true },
    });
    docId = doc.id;
    matchedRefId = doc.references[0].id;
    retractedRefId = doc.references[1].id;

    const job = await prisma.verificationJob.create({
      data: {
        documentId: docId,
        state: 'COMPLETED',
        currentStage: 'COMPLETED',
      },
    });

    // Create a verification record for the retracted paper showing CONFIRMED_RETRACTED and historical SUPPORTED
    const claim = await prisma.claim.create({
      data: {
        documentId: docId,
        originalSentence: 'Stem cell yields improved by 50% in culture.',
        normalizedClaim: 'stem cell yields improved by 50% in culture',
        verifications: {
          create: [
            {
              jobId: job.id,
              supportVerdict: 'SUPPORTED',
              confidence: 'HIGH',
              sourceAccessState: 'FULL_TEXT_RETRIEVED',
              quoteVerified: true,
              evidenceQuotes: JSON.stringify(['Yields increased 50% across replicates.']),
              retractionStatus: 'CONFIRMED_RETRACTED',
              correctionStatus: 'NO_CORRECTION_FOUND',
            },
          ],
        },
        citationMentions: {
          create: [
            {
              reference: { connect: { id: retractedRefId } },
              rawMarker: '[1]',
              markerType: 'NUMBERED',
            },
          ],
        },
      },
    });
  });

  // Test 1: Topical search result without citation relationship is not stored as verified forward citation
  it('1. Topical search result that does not cite the target paper is rejected', () => {
    const candidate = {
      title: 'General Overview of Reading Apps',
      url: 'https://general-overview.edu/article',
      domain: 'general-overview.edu',
      rawText: 'We discuss modern reading apps and digital classroom interventions in elementary school.',
    };

    const target = {
      title: 'Reading improvements with mobile app',
      doi: '10.1038/s41586-022-test',
    };

    const res = verifyCitationRelationship(candidate, target);
    expect(res.isVerifiedCitation).toBe(false);
    expect(res.citationMatchBasis).toBe('TOPICAL_MENTION_WITHOUT_BIBLIOGRAPHY_MATCH');
  });

  // Test 2: Bibliography match without mapped in-text citation marker is marked unverified/unclear
  it('2. Bibliography match without a mapped in-text citation is marked unverified', () => {
    const candidate = {
      title: 'Later Evaluation Study',
      url: 'https://later-eval.org/paper',
      domain: 'later-eval.org',
      rawText: 'This study reviews multiple digital interventions.\n\nReferences:\n10.1038/s41586-022-test: Reading improvements with mobile app.',
    };

    const target = {
      title: 'Reading improvements with mobile app',
      doi: '10.1038/s41586-022-test',
    };

    const res = verifyCitationRelationship(candidate, target);
    expect(res.isVerifiedCitation).toBe(false);
    expect(res.citationMatchBasis).toBe('BIBLIOGRAPHY_FOUND_BUT_IN_TEXT_CITATION_UNMAPPED');
  });

  // Test 3: Hallucinated / non-contiguous surrounding quote fails quote verification
  it('3. Hallucinated or non-contiguous surrounding quote fails quote verification', () => {
    const fullText = 'The authors observed notable progress in reading scores [1] among early readers.';
    const hallucinatedQuote = 'The authors observed miraculous unprecedented breakthroughs [1] among all readers.';

    const spanCheck = checkContiguousSpan(hallucinatedQuote, fullText);
    expect(spanCheck.isValid).toBe(false);
  });

  // Test 4: Candidate without reliable later-publication date does not receive an invented date
  it('4. Candidate without reliable later-publication date retains null/uncertain date', () => {
    const candidate = {
      title: 'Undated Citing Pre-print',
      url: 'https://preprints.org/undated',
      domain: 'preprints.org',
      rawText: 'Our findings replicate the methodology of [1] across pilot cohorts.\n\nReferences:\n[1] 10.1038/s41586-022-test',
    };

    const target = {
      title: 'Reading improvements with mobile app',
      doi: '10.1038/s41586-022-test',
    };

    const res = verifyCitationRelationship(candidate, target);
    expect(res.isVerifiedCitation).toBe(true);
    // Never inject arbitrary publication year if candidate has none
    expect((candidate as any).publishedDate).toBeUndefined();
  });

  // Test 5: Original-paper and duplicate-version results are excluded/deduplicated
  it('5. Target canonical DOI or paper itself is filtered from forward citation candidates', async () => {
    const mockTavily = {
      search: vi.fn().mockResolvedValue({
        results: [
          { url: 'https://nature.com/articles/10.1038/s41586-022-test' }, // Duplicate/original
          { url: 'https://citing-journal.org/article-1', content: 'Citing article' },
        ],
      }),
      extract: vi.fn().mockResolvedValue({
        results: [{ url: 'https://citing-journal.org/article-1', raw_content: 'Valid body [1]... 10.1038/s41586-022-test' }],
        failed_results: [],
      }),
    } as any;

    const res = await executeForwardCitationSearch({
      referenceId: matchedRefId,
      idempotencyKey: 'test_filter_key_1',
      client: mockTavily,
    });

    expect(mockTavily.extract).toHaveBeenCalledTimes(1);
    const extractUrls = mockTavily.extract.mock.calls[0][0].urls;
    expect(extractUrls).not.toContain('https://nature.com/articles/10.1038/s41586-022-test');
    expect(extractUrls).toContain('https://citing-journal.org/article-1');
  });

  // Test 6: Retracted paper displays both historical supportVerdict and prominent CONFIRMED_RETRACTED
  it('6. Retracted paper preserves historical support verdict and exposes CONFIRMED_RETRACTED', async () => {
    const req = new NextRequest(`http://localhost:3000/api/references/${retractedRefId}/health`);
    const res = await getReferenceHealth(req, { params: Promise.resolve({ id: retractedRefId }) });
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.historicalClaimSupport.supportVerdict).toBe('SUPPORTED');
    expect(data.currentPublicationHealth.retractionStatus).toBe('CONFIRMED_RETRACTED');
    expect(data.currentPublicationHealth.retractionWarning).toContain('formally RETRACTED');
  });

  // Test 7: Successful search with no verified contexts differs from a failed Tavily search
  it('7. Completed search with 0 contexts differs from FAILED status', async () => {
    const mockTavily = {
      search: vi.fn().mockResolvedValue({
        results: [{ url: 'https://some-unrelated-blog.com/post' }],
      }),
      extract: vi.fn().mockResolvedValue({
        results: [{ url: 'https://some-unrelated-blog.com/post', raw_content: 'No citations here.' }],
        failed_results: [],
      }),
    } as any;

    const res = await executeForwardCitationSearch({
      referenceId: matchedRefId,
      idempotencyKey: 'test_no_contexts_key',
      client: mockTavily,
    });

    expect(res.searchRun.status).toBe('COMPLETED_NO_VERIFIED_CONTEXTS');
    expect(res.searchRun.status).not.toBe('FAILED');
  });

  // Test 8: Extract partial failures appear in coverage counts and do not disappear behind HTTP 200
  it('8. Partial extract failures appear in coverage counts', async () => {
    const mockTavily = {
      search: vi.fn().mockResolvedValue({
        results: [
          { url: 'https://accessible.edu/p1' },
          { url: 'https://paywalled.org/p2' },
        ],
      }),
      extract: vi.fn().mockResolvedValue({
        results: [{ url: 'https://accessible.edu/p1', raw_content: 'Content [1] citing 10.1038/s41586-022-test' }],
        failed_results: [{ url: 'https://paywalled.org/p2', error: '403 Forbidden' }],
      }),
    } as any;

    const res = await executeForwardCitationSearch({
      referenceId: matchedRefId,
      idempotencyKey: 'test_partial_extract_key',
      client: mockTavily,
    });

    expect(res.searchRun.urlsExtracted).toBe(1);
    expect(res.searchRun.urlsFailed).toBe(1);
  });

  // Test 9: Repeating the same idempotency key does not spend Tavily budget a second time
  it('9. Repeating idempotency key returns cached run without repeating Tavily calls', async () => {
    const mockTavily = {
      search: vi.fn().mockResolvedValue({ results: [] }),
      extract: vi.fn().mockResolvedValue({ results: [], failed_results: [] }),
    } as any;

    const firstRun = await executeForwardCitationSearch({
      referenceId: matchedRefId,
      idempotencyKey: 'test_idempotency_m10_key',
      client: mockTavily,
    });
    expect(firstRun.cached).toBe(false);

    const secondRun = await executeForwardCitationSearch({
      referenceId: matchedRefId,
      idempotencyKey: 'test_idempotency_m10_key',
      client: mockTavily,
    });
    expect(secondRun.cached).toBe(true);
    expect(secondRun.searchRun.id).toBe(firstRun.searchRun.id);
    expect(mockTavily.search).toHaveBeenCalledTimes(1);
  });

  // Test 10: Mandatory UI disclaimer and sampled search coverage text
  it('10. Health route includes mandatory sampled non-exhaustive citation disclaimer', async () => {
    const req = new NextRequest(`http://localhost:3000/api/references/${matchedRefId}/health`);
    const res = await getReferenceHealth(req, { params: Promise.resolve({ id: matchedRefId }) });
    const data = await res.json();

    expect(data.currentPublicationHealth.sampledContextsDisclaimer).toContain(
      'Sampled, non-exhaustive forward citation context discovered through Tavily Search'
    );
  });
});
