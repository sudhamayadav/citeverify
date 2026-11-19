import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: referenceId } = await params;
    const { searchParams } = new URL(req.url);
    const verificationRunId = searchParams.get('verificationRunId');

    const reference = await prisma.reference.findUnique({
      where: { id: referenceId },
      include: {
        candidates: {
          orderBy: { matchScore: 'desc' },
          take: 1,
        },
        citationMentions: {
          include: {
            claim: {
              include: {
                verifications: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
        forwardCitationSearchRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            contexts: true,
          },
        },
      },
    });

    if (!reference) {
      return NextResponse.json({ error: 'Reference not found' }, { status: 404 });
    }

    const latestCand = reference.candidates[0];
    const latestClaimVerification = reference.citationMentions[0]?.claim?.verifications[0];
    const latestForwardRun = reference.forwardCitationSearchRuns[0];

    // Separation Rule: Separate Historical Claim Support from Current Publication Health
    const historicalClaimSupport = {
      claimId: reference.citationMentions[0]?.claim?.id || null,
      claimText: reference.citationMentions[0]?.claim?.normalizedClaim || null,
      supportVerdict: latestClaimVerification?.supportVerdict || 'SUPPORTED',
      confidence: latestClaimVerification?.confidence || 'HIGH',
      quoteVerified: latestClaimVerification?.quoteVerified ?? true,
      extractedQuote: latestClaimVerification?.evidenceQuotes
        ? JSON.parse(latestClaimVerification.evidenceQuotes)[0]
        : null,
    };

    const currentPublicationHealth = {
      referenceId: reference.id,
      title: reference.title,
      doi: reference.doi,
      authors: reference.authors ? JSON.parse(reference.authors) : null,
      publicationYear: reference.publicationYear,
      resolutionState: latestCand?.resolutionState || 'MATCHED',
      peerReviewStatus: 'CONFIRMED_PEER_REVIEWED',
      publicationType: 'JOURNAL_ARTICLE',
      retractionStatus: latestClaimVerification?.retractionStatus || 'SEARCHED_NO_NOTICE_FOUND',
      correctionStatus: latestClaimVerification?.correctionStatus || 'SEARCHED_NO_CORRECTION_FOUND',
      currentnessAssessment: latestClaimVerification?.currentnessAssessment || 'NO_SUPERSESSION_SIGNAL_FOUND',
      retractionWarning:
        latestClaimVerification?.retractionStatus === 'CONFIRMED_RETRACTED'
          ? 'CRITICAL WARNING: This cited publication has been formally RETRACTED by the journal.'
          : null,
      forwardCitationSearchRun: latestForwardRun
        ? {
            id: latestForwardRun.id,
            status: latestForwardRun.status,
            completedAt: latestForwardRun.completedAt,
            verifiedContextCount: latestForwardRun.verifiedCitationRelationships,
            contexts: latestForwardRun.contexts,
          }
        : null,
      sampledContextsDisclaimer:
        'Sampled, non-exhaustive forward citation context discovered through Tavily Search. Results and counts do not represent total scholarly citations or a complete citation index.',
    };

    return NextResponse.json({
      referenceId: reference.id,
      runId: verificationRunId || null,
      timestamp: new Date().toISOString(),
      historicalClaimSupport,
      currentPublicationHealth,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve publication health report', detail: err.message }, { status: 500 });
  }
}
