import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ searchRunId: string }> }
) {
  try {
    const { searchRunId } = await params;

    const run = await prisma.forwardCitationSearchRun.findUnique({
      where: { id: searchRunId },
      include: {
        contexts: {
          orderBy: { retrievedAt: 'desc' },
        },
        reference: true,
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Forward citation search run not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: run.id,
      referenceId: run.referenceId,
      status: run.status,
      candidateUrlsFound: run.candidateUrlsFound,
      urlsExtracted: run.urlsExtracted,
      urlsFailed: run.urlsFailed,
      verifiedCitationRelationships: run.verifiedCitationRelationships,
      contextsClassified: run.contextsClassified,
      budgetConsumed: run.budgetConsumed,
      completedAt: run.completedAt,
      contexts: run.contexts,
      disclaimer: 'Sampled, non-exhaustive forward citation context discovered through Tavily Search. Results and counts do not represent total scholarly citations or a complete citation index.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve search run status', detail: err.message }, { status: 500 });
  }
}
