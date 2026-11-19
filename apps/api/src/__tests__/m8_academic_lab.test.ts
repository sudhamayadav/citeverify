import { describe, it, expect, vi, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { GET as getCases } from '@/app/api/lab/cases/route';
import { POST as postAttempt } from '@/app/api/lab/attempts/route';
import { GET as getMetrics } from '@/app/api/lab/metrics/route';
import { POST as postFindCitations } from '@/app/api/lab/find-citations/route';
import { NextRequest } from 'next/server';

describe('Milestone 8 Academic Lab Suite', () => {
  let createdCaseId: string;

  beforeAll(async () => {
    // Clean up any test lab cases
    await prisma.labCase.deleteMany({
      where: { name: { contains: 'Test Suite' } },
    });
  });

  // Test 1: GET /api/lab/cases preloads the synthetic DEMO FIXTURE
  it('1. GET /api/lab/cases preloads labelled synthetic DEMO FIXTURE', async () => {
    const res = await getCases();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.cases.length).toBeGreaterThanOrEqual(1);
    const demo = data.cases.find((c: any) => c.isSynthetic);
    expect(demo).toBeDefined();
    expect(demo.claimText).toContain('30%');
    expect(demo.expectedVerdict).toBe('PARTLY_SUPPORTED');
    createdCaseId = demo.id;
  });

  // Test 2: POST /api/lab/attempts records simulation evaluation
  it('2. POST /api/lab/attempts runs simulation mode and returns verified verdict', async () => {
    const req = new NextRequest('http://localhost:3000/api/lab/attempts', {
      method: 'POST',
      body: JSON.stringify({
        caseId: createdCaseId,
        mode: 'SIMULATION',
      }),
    });

    const res = await postAttempt(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.attemptId).toBeDefined();
    expect(data.mode).toBe('SIMULATION');
    expect(data.result.supportVerdict).toBe('PARTLY_SUPPORTED');
    expect(data.result.verificationState).toBe('NEEDS_HUMAN_REVIEW');
    expect(data.result.issueFlags).toContain('NUMERICAL_EXAGGERATION');
  });

  // Test 3: GET /api/lab/metrics displays NOT ENOUGH LABELLED DATA when gold data absent
  it('3. GET /api/lab/metrics displays NOT ENOUGH LABELLED DATA without gold labels', async () => {
    const res = await getMetrics();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.status).toBe('NOT_ENOUGH_LABELLED_DATA');
    expect(data.message).toContain('NOT ENOUGH LABELLED DATA');
    expect(data.metrics).toBeNull();
  });

  // Test 4: POST /api/lab/find-citations labels all candidates CANDIDATE SOURCE — REQUIRES HUMAN REVIEW
  it('4. POST /api/lab/find-citations searches candidates and attaches required warning label', async () => {
    const req = new NextRequest('http://localhost:3000/api/lab/find-citations', {
      method: 'POST',
      body: JSON.stringify({
        claimText: 'Machine learning algorithms reduce diagnostic delays in radiology',
      }),
    });

    const res = await postFindCitations(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.candidates.length).toBeGreaterThan(0);
    for (const cand of data.candidates) {
      expect(cand.label).toBe('CANDIDATE SOURCE — REQUIRES HUMAN REVIEW');
    }
  });
});
