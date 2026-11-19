import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { detectTextOverlap, SourcePassageCandidate } from '@/lib/plagiarism';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';

    const job = await (prisma.verificationJob as any).findUnique({
      where: { id: jobId },
      include: {
        document: {
          include: {
            claims: {
              include: {
                verifications: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
                citationMentions: {
                  include: {
                    reference: true,
                  },
                },
              },
            },
            references: true,
            reviews: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const doc = job.document;
    const claims = doc?.claims || [];
    const references = doc?.references || [];
    const reviews = doc?.reviews || [];

    // Build structured sanitized report data (no private file paths or API keys)
    const structuredReport = {
      reportId: `REP-${job.id}`,
      jobId: job.id,
      stage: job.currentStage || job.state,
      document: {
        id: doc?.id,
        filename: doc?.originalFilename,
        fileHash: doc?.fileHash,
        pageCount: doc?.pageCount,
        extractionState: doc?.extractionState,
      },
      provenance: {
        generatedAt: new Date().toISOString(),
        tavilyRequestId: null,
        usageBudget: job.tavilyBudgetMax,
        creditsUsed: job.tavilyBudgetUsed,
      },
      limitations: [
        'Local-only hackathon demonstration.',
        'External verification searches use Tavily API exclusively.',
        'Incomplete/abstract-only sources result in honest abstention, never forced unsupported.',
        'Forward citations are sampled and non-exhaustive (not 0 citations).',
      ],
      claims: claims.map((c: any) => {
        const v = c.verifications?.[0];
        const claimReviews = reviews.filter((r: any) => r.claimId === c.id);
        const latestReview = claimReviews[claimReviews.length - 1];

        // Gather extracted passages from verifications to check text overlap
        const passageCandidates: SourcePassageCandidate[] = [];
        if (v?.evidenceQuotes) {
          try {
            const parsed = JSON.parse(v.evidenceQuotes);
            for (const pq of parsed) {
              passageCandidates.push({
                sourceUrl: v.candidateUrl || undefined,
                text: typeof pq === 'string' ? pq : pq.text || '',
              });
            }
          } catch {
            // ignore
          }
        }
        if (v?.extractedQuote) {
          passageCandidates.push({
            sourceUrl: v.candidateUrl || undefined,
            text: v.extractedQuote,
          });
        }

        const plagiarismCheck = detectTextOverlap(c.originalSentence || c.normalizedClaim, passageCandidates);

        return {
          claimId: c.id,
          claimText: c.normalizedClaim || c.originalSentence,
          claimType: c.claimType,
          originalSentence: c.originalSentence,
          automatedVerdict: v ? {
            verdict: v.verdict,
            confidence: v.confidence,
            sourceAccessState: v.sourceAccessState,
            quoteVerified: v.quoteVerified,
            extractedQuote: v.extractedQuote,
            candidateUrl: v.candidateUrl,
            issueFlags: v.issueFlags ? JSON.parse(v.issueFlags) : [],
            retractionStatus: v.retractionStatus,
            correctionStatus: v.correctionStatus,
            currentnessAssessment: v.currentnessAssessment,
          } : null,
          humanReview: latestReview ? {
            action: latestReview.action,
            resultingState: latestReview.resultingState,
            reviewerRole: latestReview.reviewerRole,
            reviewerLabel: latestReview.reviewerLabel,
            notes: latestReview.notes,
            recordHash: latestReview.recordHash,
            createdAt: latestReview.createdAt,
          } : { status: 'PENDING' },
          plagiarismCheck,
          citations: (c.citationMentions || []).map((cit: any) => ({
            citationMarker: cit.rawMarker,
            referenceTitle: cit.reference?.title,
            referenceYear: cit.reference?.publicationYear,
            doi: cit.reference?.doi,
          })),
        };
      }),
      references: references.map((r: any) => ({
        id: r.id,
        rawText: r.rawReferenceText,
        title: r.title,
        publicationYear: r.publicationYear,
        doi: r.doi,
      })),
      reviewAuditLog: reviews.map((r: any) => ({
        id: r.id,
        claimId: r.claimId,
        action: r.action,
        resultingState: r.resultingState,
        notes: r.notes,
        previousHash: r.previousHash,
        recordHash: r.recordHash,
        createdAt: r.createdAt,
      })),
    };

    if (format === 'markdown') {
      let md = `# CiteVerify Scientific Claim & Citation Verification Report\n\n`;
      md += `**Report ID:** ${structuredReport.reportId}\n`;
      md += `**Generated At:** ${structuredReport.provenance.generatedAt}\n`;
      md += `**Document:** ${structuredReport.document.filename} (Pages: ${structuredReport.document.pageCount || 'N/A'})\n`;
      md += `**Job Status:** ${structuredReport.stage}\n\n`;

      md += `## Limitations & Provenance\n`;
      for (const lim of structuredReport.limitations) {
        md += `- ${lim}\n`;
      }
      md += `- Tavily Credits Used: ${structuredReport.provenance.creditsUsed} / Budget: ${structuredReport.provenance.usageBudget}\n\n`;

      md += `## Claims & Evidence Summary\n\n`;
      for (const c of structuredReport.claims) {
        md += `### Claim: "${c.claimText}"\n`;
        md += `- **Original sentence:** *${c.originalSentence}*\n`;
        md += `- **Claim Type:** ${c.claimType}\n`;

        if (c.automatedVerdict) {
          md += `- **Automated Verdict:** \`${c.automatedVerdict.verdict}\` (Confidence: \`${c.automatedVerdict.confidence}\`)\n`;
          md += `- **Source Access State:** \`${c.automatedVerdict.sourceAccessState}\`\n`;
          md += `- **Quote Verified:** ${c.automatedVerdict.quoteVerified ? 'Yes (Contiguous span verified)' : 'No / Not Verified'}\n`;
          if (c.automatedVerdict.extractedQuote) {
            md += `- **Extracted Quote:** > "${c.automatedVerdict.extractedQuote}"\n`;
          }
          if (c.automatedVerdict.candidateUrl) {
            md += `- **Source URL:** ${c.automatedVerdict.candidateUrl}\n`;
          }
          if (c.automatedVerdict.retractionStatus) {
            md += `- **Retraction Status:** \`${c.automatedVerdict.retractionStatus}\`\n`;
          }
        } else {
          md += `- **Automated Verdict:** PENDING / NOT COMPLETED\n`;
        }

        if (c.humanReview && c.humanReview.action) {
          md += `- **Human Review:** \`${c.humanReview.resultingState}\` (Action: \`${c.humanReview.action}\` by ${c.humanReview.reviewerLabel})\n`;
          if (c.humanReview.notes) {
            md += `  - Reviewer Notes: ${c.humanReview.notes}\n`;
          }
          md += `  - Record Hash: \`${c.humanReview.recordHash}\`\n`;
        } else {
          md += `- **Human Review:** \`PENDING\`\n`;
        }
        md += `\n`;
      }

      md += `## Human Review Audit Trail (Append-Only Hash Chain)\n\n`;
      if (structuredReport.reviewAuditLog.length === 0) {
        md += `*No human reviews recorded yet.*\n`;
      } else {
        for (const rev of structuredReport.reviewAuditLog) {
          md += `- **[${rev.createdAt}]** Action: \`${rev.action}\` -> State: \`${rev.resultingState}\` (Hash: \`${rev.recordHash.slice(0, 16)}...\`)\n`;
          if (rev.notes) md += `  - Notes: ${rev.notes}\n`;
        }
      }

      return new NextResponse(md, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="verification-report-${job.id}.md"`,
        },
      });
    }

    return NextResponse.json(structuredReport);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
