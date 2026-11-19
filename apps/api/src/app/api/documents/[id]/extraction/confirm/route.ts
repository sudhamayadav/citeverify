import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractClaimsAndReferences } from '@/lib/extractor';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const body = await req.json().catch(() => ({}));
    const { corrections } = body;

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc || !doc.extractedText) {
      return NextResponse.json({ error: 'Document or extracted text not found' }, { status: 404 });
    }

    // 1. Initial heuristic extraction
    const extractionResult = extractClaimsAndReferences(doc.extractedText);

    // 2. Persist versioned ExtractionRun
    const extractionRun = await prisma.extractionRun.create({
      data: {
        documentId,
        runType: corrections ? 'CORRECTION' : 'INITIAL',
        state: 'COMPLETED',
        extractedData: JSON.stringify(extractionResult),
        corrections: corrections ? JSON.stringify(corrections) : null,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // 3. Persist References
    const createdRefs: Record<string, string> = {};
    for (const ref of extractionResult.references) {
      const created = await prisma.reference.create({
        data: {
          documentId,
          rawReferenceText: ref.rawReferenceText,
          title: ref.title,
          authors: ref.authors ? JSON.stringify(ref.authors) : null,
          publicationYear: ref.publicationYear,
          doi: ref.doi,
          sourceLocation: ref.sourceLocation ? JSON.stringify(ref.sourceLocation) : null,
          extractionWarnings: JSON.stringify(ref.extractionWarnings),
        },
      });
      createdRefs[ref.referenceId] = created.id;
    }

    // 4. Persist Claims & CitationMentions
    const persistedClaims = [];
    for (const claim of extractionResult.claims) {
      // Check if user corrections apply to this claim
      let originalSentence = claim.originalSentence;
      let normalizedClaim = claim.normalizedClaim;
      let claimType = claim.claimType;

      if (corrections && corrections.claims && corrections.claims[claim.claimId]) {
        const corr = corrections.claims[claim.claimId];
        if (corr.isFalsePositive) continue; // Skip discarded false positives
        if (corr.normalizedClaim) normalizedClaim = corr.normalizedClaim;
        if (corr.claimType) claimType = corr.claimType;
      }

      const createdClaim = await prisma.claim.create({
        data: {
          documentId,
          originalSentence,
          normalizedClaim,
          claimType,
          extractionMethod: claim.extractionMethod,
          extractionConfidence: claim.extractionConfidence,
          startOffset: claim.startOffset,
          endOffset: claim.endOffset,
          citationMentions: {
            create: claim.citationMentions.map((m) => ({
              rawMarker: m.rawMarker,
              markerType: m.markerType,
              mappingState: m.mappingState,
              mappingConfidence: m.mappingConfidence,
              startOffset: m.startOffset,
              endOffset: m.endOffset,
              referenceId: m.matchedReferenceId ? createdRefs[m.matchedReferenceId] || null : null,
            })),
          },
        },
        include: {
          citationMentions: true,
        },
      });

      // Record initial ClaimVersion event
      await prisma.claimVersion.create({
        data: {
          claimId: createdClaim.id,
          versionNumber: 1,
          previousText: originalSentence,
          newText: normalizedClaim,
          changeType: corrections ? 'USER_CORRECTION' : 'INITIAL_EXTRACTION',
          changedBy: 'user',
        },
      });

      persistedClaims.push(createdClaim);
    }

    return NextResponse.json({
      success: true,
      extractionRunId: extractionRun.id,
      claimsCount: persistedClaims.length,
      referencesCount: Object.keys(createdRefs).length,
      unusedReferencesCount: extractionResult.unusedReferences.length,
      orphanedCitationsCount: extractionResult.orphanedCitations.length,
      claims: persistedClaims,
      extractionNotice: extractionResult.extractionNotice,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to confirm extraction', detail: err.message },
      { status: 500 }
    );
  }
}
