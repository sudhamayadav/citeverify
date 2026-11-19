import { NextRequest, NextResponse } from 'next/server';
import { executeForwardCitationSearch } from '@/lib/forwardCitations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: referenceId } = await params;
    const body = await req.json().catch(() => ({}));
    const { idempotencyKey, verificationRunId } = body;

    const result = await executeForwardCitationSearch({
      referenceId,
      idempotencyKey,
      verificationRunId,
    });

    return NextResponse.json({
      success: true,
      cached: result.cached,
      searchRunId: result.searchRun.id,
      status: result.searchRun.status,
      coverage: {
        queriesAttempted: result.searchRun.queriesAttempted,
        candidateUrlsFound: result.searchRun.candidateUrlsFound,
        urlsExtracted: result.searchRun.urlsExtracted,
        urlsFailed: result.searchRun.urlsFailed,
        verifiedContexts: result.searchRun.verifiedCitationRelationships,
        budgetConsumed: result.searchRun.budgetConsumed,
        completedAt: result.searchRun.completedAt,
      },
      contexts: result.searchRun.contexts,
      disclaimer: 'Sampled, non-exhaustive forward citation context discovered through Tavily Search. Results and counts do not represent total scholarly citations or a complete citation index.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to execute forward citation search', detail: err.message }, { status: 500 });
  }
}
