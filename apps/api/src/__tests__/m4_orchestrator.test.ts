import { describe, it, expect, vi, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { TavilyClient, TavilyApiError } from '@/lib/tavilyClient';
import { createVerificationJob, advanceVerificationJob } from '@/lib/jobOrchestrator';

describe('Milestone 4 Tavily Adapter & Job State Machine Suite', () => {
  let docId: string;

  beforeAll(async () => {
    const doc = await prisma.document.create({
      data: {
        originalFilename: 'm4_orchestrator_doc.pdf',
        storagePath: 'storage/uploads/m4.pdf',
        fileHash: 'm4-hash-test-sha256',
        mimeType: 'application/pdf',
        fileSize: 2048,
        claims: {
          create: [
            {
              originalSentence: 'An educational app produced 30% learning gains.',
              normalizedClaim: 'educational app produced 30% learning gains',
              claimType: 'STATISTICAL',
            },
          ],
        },
      },
    });
    docId = doc.id;
  });

  // Acceptance Test 1: Mocked Tavily Search with Bearer Auth & Zod validation
  it('1. Tavily Search sends Bearer auth and validates returned results with Zod', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: 'Smith et al. 2022',
        results: [
          {
            title: 'Educational App Learning Gains',
            url: 'https://nature.com/articles/s41586-022-sample',
            content: 'The study observed significant gains in pilot evaluation.',
            score: 0.94,
            published_date: '2022-04-15',
          },
        ],
        response_time: 0.45,
      }),
    });
    global.fetch = mockFetch;

    const client = new TavilyClient({ apiKey: 'mock-tvly-key-1234' });
    const res = await client.search({ query: 'Smith et al. 2022', max_results: 3 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('https://api.tavily.com/search');
    expect(calledOptions.headers['Authorization']).toBe('Bearer mock-tvly-key-1234');
    expect(res.results.length).toBe(1);
    expect(res.results[0].title).toBe('Educational App Learning Gains');
  });

  // Acceptance Test 2: Tavily Extract inspecting results AND failed_results
  it('2. Tavily Extract parses results and inspects failed_results', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { url: 'https://nature.com/articles/valid', raw_content: 'Full article text here.' },
        ],
        failed_results: [
          { url: 'https://paywalled-journal.org/restricted', error: '403 Forbidden' },
        ],
        response_time: 0.32,
      }),
    });
    global.fetch = mockFetch;

    const client = new TavilyClient({ apiKey: 'mock-tvly-key' });
    const res = await client.extract({
      urls: ['https://nature.com/articles/valid', 'https://paywalled-journal.org/restricted'],
    });

    expect(res.results.length).toBe(1);
    expect(res.failed_results.length).toBe(1);
    expect(res.failed_results[0].url).toBe('https://paywalled-journal.org/restricted');
  });

  // Acceptance Test 3: Truthful API Error Handling (e.g. 429 Rate Limit)
  it('3. Tavily API errors (429, 401) throw structured TavilyApiError', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded. Try again in 60s.',
    });
    global.fetch = mockFetch;

    const client = new TavilyClient({ apiKey: 'mock-key' });
    await expect(client.search({ query: 'test' })).rejects.toThrow(TavilyApiError);
  });

  // Acceptance Test 4: Idempotent job creation & bounded advance state machine
  it('4. VerificationJob creates idempotently and advances one stage per call', async () => {
    const job1 = await createVerificationJob(docId);
    expect(job1).toBeDefined();
    expect(job1.state).toBe('PENDING');

    // Duplicate creation returns existing job
    const job2 = await createVerificationJob(docId);
    expect(job2.id).toBe(job1.id);

    // Step 1: INIT -> RESOLVE
    const step1 = await advanceVerificationJob(job1.id);
    expect(step1.currentStage).toBe('RESOLVE');
    expect(step1.state).toBe('RUNNING');

    // Step 2: RESOLVE -> RETRIEVE
    const step2 = await advanceVerificationJob(job1.id);
    expect(step2.currentStage).toBe('RETRIEVE');

    // Step 3: RETRIEVE -> VERIFY
    const step3 = await advanceVerificationJob(job1.id);
    expect(step3.currentStage).toBe('VERIFY');

    // Step 4: VERIFY -> COMPLETED
    const step4 = await advanceVerificationJob(job1.id);
    expect(step4.state).toBe('COMPLETED');
  });

  // Acceptance Test 5: Resumability after restart
  it('5. Restart resumes a pending or running job from its persisted database stage', async () => {
    const freshJob = await prisma.verificationJob.create({
      data: {
        documentId: docId,
        state: 'RUNNING',
        currentStage: 'RETRIEVE',
        currentStep: 2,
        totalSteps: 4,
      },
    });

    // Advance should resume from RETRIEVE and transition to VERIFY
    const advanceRes = await advanceVerificationJob(freshJob.id);
    expect(advanceRes.currentStage).toBe('VERIFY');
    expect(advanceRes.currentStep).toBe(3);
  });
});
