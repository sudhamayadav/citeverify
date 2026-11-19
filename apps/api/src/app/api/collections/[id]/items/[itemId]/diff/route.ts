import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: collectionId, itemId } = await params;
    const { searchParams } = new URL(req.url);
    const runId1 = searchParams.get('runId1');
    const runId2 = searchParams.get('runId2');

    const item = await prisma.collectionItem.findUnique({
      where: { id: itemId },
      include: {
        reference: {
          include: {
            forwardCitationSearchRuns: {
              include: { contexts: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!item || item.collectionId !== collectionId) {
      return NextResponse.json({ error: 'Collection item not found' }, { status: 404 });
    }

    const docId = item.documentId || item.reference.documentId;
    const runs = await prisma.verificationRun.findMany({
      where: { documentId: docId },
      include: {
        auditSnapshot: true,
      },
      orderBy: { runNumber: 'desc' },
    });

    let rLatest = runs[0];
    let rPrevious = runs[1] || runs[0];

    if (runId1 && runId2) {
      const match1 = runs.find((r) => r.id === runId1);
      const match2 = runs.find((r) => r.id === runId2);
      if (match1 && match2) {
        rPrevious = match1;
        rLatest = match2;
      }
    }

    const snapLatest = rLatest?.auditSnapshot ? JSON.parse(rLatest.auditSnapshot.resultSnapshot || '{}') : {};
    const snapPrev = rPrevious?.auditSnapshot ? JSON.parse(rPrevious.auditSnapshot.resultSnapshot || '{}') : {};

    // Forward citation runs comparison: find runs with contexts to compare
    const fwdRunsWithContexts = item.reference.forwardCitationSearchRuns.filter((r) => r.contexts.length > 0);
    const fLatest = fwdRunsWithContexts[0] || item.reference.forwardCitationSearchRuns[0];
    const fPrevious = fwdRunsWithContexts[1] || item.reference.forwardCitationSearchRuns[1] || fLatest;

    const prevContextUrls = new Set((fPrevious?.contexts || []).map((c) => c.citingUrl));
    const latestContextUrls = new Set((fLatest?.contexts || []).map((c) => c.citingUrl));

    // Notice: Missing contexts are labelled "not found in latest sample", NEVER "citation removed from literature"
    const missingFromLatestSample = (fPrevious?.contexts || [])
      .filter((c) => !latestContextUrls.has(c.citingUrl))
      .map((c) => ({
        citingTitle: c.citingTitle,
        citingUrl: c.citingUrl,
        diffStatus: 'not found in latest sample',
        explanation: 'Present in earlier sample but not discovered in this bounded search. Does not mean citation was removed.',
      }));

    const newlyDiscoveredContexts = (fLatest?.contexts || [])
      .filter((c) => !prevContextUrls.has(c.citingUrl))
      .map((c) => ({
        citingTitle: c.citingTitle,
        citingUrl: c.citingUrl,
        diffStatus: 'newly discovered in sample',
      }));

    return NextResponse.json({
      collectionItemId: item.id,
      referenceId: item.referenceId,
      comparedRuns: {
        previousRun: { id: rPrevious?.id, runNumber: rPrevious?.runNumber, createdAt: rPrevious?.createdAt },
        latestRun: { id: rLatest?.id, runNumber: rLatest?.runNumber, createdAt: rLatest?.createdAt },
      },
      healthDiff: {
        retractionStatus: {
          previous: snapPrev.retractionStatus || item.reference.retractionStatus,
          latest: snapLatest.retractionStatus || item.reference.retractionStatus,
          changed: (snapPrev.retractionStatus || item.reference.retractionStatus) !== (snapLatest.retractionStatus || item.reference.retractionStatus),
        },
        correctionStatus: {
          previous: snapPrev.correctionStatus || item.reference.correctionStatus,
          latest: snapLatest.correctionStatus || item.reference.correctionStatus,
          changed: (snapPrev.correctionStatus || item.reference.correctionStatus) !== (snapLatest.correctionStatus || item.reference.correctionStatus),
        },
        currentnessAssessment: {
          previous: snapPrev.currentnessAssessment || item.reference.currentnessAssessment,
          latest: snapLatest.currentnessAssessment || item.reference.currentnessAssessment,
          changed: (snapPrev.currentnessAssessment || item.reference.currentnessAssessment) !== (snapLatest.currentnessAssessment || item.reference.currentnessAssessment),
        },
      },
      forwardCitationDiff: {
        newlyDiscoveredContexts,
        missingFromLatestSample,
        disclaimer: 'Absence from a later sampled search does not imply a paper was uncited; Tavily forward citation searches are non-exhaustive samples.',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to compute diff', detail: err.message }, { status: 500 });
  }
}
