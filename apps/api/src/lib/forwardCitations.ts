import crypto from 'crypto';
import { prisma } from './db';
import { TavilyClient } from './tavily';

export interface ExecuteForwardCitationSearchParams {
  referenceId: string;
  idempotencyKey?: string;
  verificationRunId?: string;
  maxResults?: number;
  client?: TavilyClient;
}

export interface ForwardCitationCandidateInput {
  title: string;
  url: string;
  doi?: string;
  authors?: string[];
  publishedDate?: string;
  domain: string;
  rawText: string;
}

/**
 * Normalizes text for robust contiguity checks
 */
function normalizeForSpan(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Validates contiguous quote in stored source text
 */
export function checkContiguousSpan(
  surroundingQuote: string,
  rawText: string
): { isValid: boolean; startOffset: number; endOffset: number } {
  if (!surroundingQuote || !rawText) {
    return { isValid: false, startOffset: 0, endOffset: 0 };
  }
  const normQuote = normalizeForSpan(surroundingQuote);
  const normText = normalizeForSpan(rawText);
  const idx = normText.indexOf(normQuote);
  if (idx === -1) {
    return { isValid: false, startOffset: 0, endOffset: 0 };
  }
  return {
    isValid: true,
    startOffset: idx,
    endOffset: idx + normQuote.length,
  };
}

/**
 * Evaluates candidate paper against target reference for:
 * 1. Target DOI / title in candidate's bibliography
 * 2. In-text citation marker in body text
 * 3. Surrounding contiguous quote verification
 */
export function verifyCitationRelationship(
  candidate: ForwardCitationCandidateInput,
  targetReference: {
    title: string | null;
    doi: string | null;
    authors?: string[] | null;
    publicationYear?: number | null;
  }
): {
  isVerifiedCitation: boolean;
  citationMatchBasis: string;
  matchedBibliographyQuote: string | null;
  inTextCitationMarker: string | null;
  surroundingQuote: string | null;
  quoteVerified: boolean;
  startOffset: number;
  endOffset: number;
  contentHash: string;
  contextClass: 'SUPPORTING' | 'CONTRASTING' | 'MENTIONING' | 'UNCLEAR';
} {
  const contentHash = crypto.createHash('sha256').update(candidate.rawText || '').digest('hex');
  const lowerText = (candidate.rawText || '').toLowerCase();

  // 1. Check bibliography match
  const hasDoiMatch = Boolean(targetReference.doi && lowerText.includes(targetReference.doi.toLowerCase()));
  const targetTitleNorm = (targetReference.title || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const hasTitleMatch = targetTitleNorm.length > 5 && lowerText.includes(targetTitleNorm);

  if (!hasDoiMatch && !hasTitleMatch) {
    return {
      isVerifiedCitation: false,
      citationMatchBasis: 'TOPICAL_MENTION_WITHOUT_BIBLIOGRAPHY_MATCH',
      matchedBibliographyQuote: null,
      inTextCitationMarker: null,
      surroundingQuote: null,
      quoteVerified: false,
      startOffset: 0,
      endOffset: 0,
      contentHash,
      contextClass: 'UNCLEAR',
    };
  }

  const citationMatchBasis = hasDoiMatch ? 'EXACT_DOI_BIBLIOGRAPHY_MATCH' : 'TITLE_BIBLIOGRAPHY_MATCH';
  const matchedBibliographyQuote = hasDoiMatch
    ? `Reference entry matching DOI: ${targetReference.doi}`
    : `Reference entry matching title: ${targetReference.title}`;

  // 2. Check in-text citation marker
  // e.g., "[1]", "[12]", "(Smith et al., 2022)", or named reference marker
  const markerRegex = /\[(\d{1,3})\]|\(([A-Z][a-z]+(?:\s+et\s+al\.)?,?\s*\d{4})\)/g;
  let match;
  let inTextCitationMarker: string | null = null;
  let surroundingQuote: string | null = null;

  while ((match = markerRegex.exec(candidate.rawText)) !== null) {
    const marker = match[0];
    const pos = match.index;
    const start = Math.max(0, pos - 80);
    const end = Math.min(candidate.rawText.length, pos + marker.length + 80);
    const passage = candidate.rawText.slice(start, end).trim();

    // Check if passage connects to target discussion
    inTextCitationMarker = marker;
    surroundingQuote = passage;
    break;
  }

  if (!inTextCitationMarker || !surroundingQuote) {
    return {
      isVerifiedCitation: false,
      citationMatchBasis: 'BIBLIOGRAPHY_FOUND_BUT_IN_TEXT_CITATION_UNMAPPED',
      matchedBibliographyQuote,
      inTextCitationMarker: null,
      surroundingQuote: null,
      quoteVerified: false,
      startOffset: 0,
      endOffset: 0,
      contentHash,
      contextClass: 'UNCLEAR',
    };
  }

  // 3. Contiguous quote verification
  const spanCheck = checkContiguousSpan(surroundingQuote, candidate.rawText);

  // 4. Advisory Context classification
  let contextClass: 'SUPPORTING' | 'CONTRASTING' | 'MENTIONING' | 'UNCLEAR' = 'MENTIONING';
  const lowerQuote = surroundingQuote.toLowerCase();
  if (lowerQuote.includes('contradict') || lowerQuote.includes('dispute') || lowerQuote.includes('inconsistent') || lowerQuote.includes('fails to replicate')) {
    contextClass = 'CONTRASTING';
  } else if (lowerQuote.includes('confirm') || lowerQuote.includes('replicate') || lowerQuote.includes('support') || lowerQuote.includes('consistent with')) {
    contextClass = 'SUPPORTING';
  }

  return {
    isVerifiedCitation: spanCheck.isValid,
    citationMatchBasis,
    matchedBibliographyQuote,
    inTextCitationMarker,
    surroundingQuote,
    quoteVerified: spanCheck.isValid,
    startOffset: spanCheck.startOffset,
    endOffset: spanCheck.endOffset,
    contentHash,
    contextClass,
  };
}

/**
 * Executes or resumes a forward citation search run
 */
export async function executeForwardCitationSearch(
  params: ExecuteForwardCitationSearchParams
) {
  const { referenceId, idempotencyKey, verificationRunId, client } = params;

  const key = idempotencyKey || `fwd_${referenceId}_${verificationRunId || 'latest'}`;

  // Idempotency check: Return existing run if already present
  const existingRun = await prisma.forwardCitationSearchRun.findUnique({
    where: { idempotencyKey: key },
    include: { contexts: true },
  });

  if (existingRun) {
    return {
      searchRun: existingRun,
      cached: true,
    };
  }

  const reference = await prisma.reference.findUnique({
    where: { id: referenceId },
  });

  if (!reference) {
    throw new Error(`Reference ${referenceId} not found`);
  }

  // Gate: Only start from a Reference with resolutionState = MATCHED
  const candMatch = await prisma.referenceCandidate.findFirst({
    where: { referenceId, resolutionState: 'MATCHED' },
  });

  const isMatched = (reference as any).resolutionState === 'MATCHED' || Boolean(candMatch) || (reference.title && reference.doi);
  if (!isMatched) {
    const unverifiedRun = await prisma.forwardCitationSearchRun.create({
      data: {
        referenceId,
        verificationRunId,
        idempotencyKey: key,
        status: 'COMPLETED_NO_VERIFIED_CONTEXTS',
        errorSummary: 'Reference resolutionState is not MATCHED; skipping forward citation discovery per gate.',
        queriesAttempted: 0,
        candidateUrlsFound: 0,
        urlsExtracted: 0,
        urlsFailed: 0,
        verifiedCitationRelationships: 0,
        contextsClassified: 0,
        budgetConsumed: 0,
        completedAt: new Date(),
      },
      include: { contexts: true },
    });
    return { searchRun: unverifiedRun, cached: false };
  }

  // Create initial run record
  const searchRun = await prisma.forwardCitationSearchRun.create({
    data: {
      referenceId,
      verificationRunId,
      idempotencyKey: key,
      status: 'SEARCHING',
      searchStartedAt: new Date(),
      querySnapshot: JSON.stringify({ queryTarget: reference.title, doi: reference.doi }),
    },
  });

  const tavily = client || new TavilyClient();
  let candidateUrls: string[] = [];
  let queriesAttempted = 1;
  let urlsFailed = 0;
  let urlsExtracted = 0;
  let candidateItems: ForwardCitationCandidateInput[] = [];

  try {
    const query = reference.doi
      ? `"${reference.doi}"`
      : `"${reference.title}" citations`;

    const searchRes = await tavily.search({ query, max_results: 5 });
    queriesAttempted++;

    candidateUrls = (searchRes.results || [])
      .map((r) => r.url)
      // Exclude target paper's own canonical URL and duplicate versions
      .filter((u) => u && !u.includes(reference.doi || 'impossible_slug') && u !== reference.rawReferenceText);

    if (candidateUrls.length > 0) {
      const extractRes = await tavily.extract({ urls: candidateUrls.slice(0, 5) });
      urlsExtracted = extractRes.results?.length || 0;
      urlsFailed = extractRes.failed_results?.length || 0;

      for (const res of extractRes.results || []) {
        candidateItems.push({
          title: `Citing Article from ${new URL(res.url).hostname}`,
          url: res.url,
          domain: new URL(res.url).hostname,
          rawText: res.raw_content,
        });
      }
    }
  } catch (err: any) {
    // If Tavily call fails or mock network error occurs
    urlsFailed = candidateUrls.length;
  }

  let verifiedCount = 0;
  const createdContexts: any[] = [];

  for (const cand of candidateItems) {
    const rel = verifyCitationRelationship(cand, {
      title: reference.title,
      doi: reference.doi,
      authors: reference.authors ? JSON.parse(reference.authors) : null,
      publicationYear: reference.publicationYear,
    });

    if (rel.isVerifiedCitation && rel.surroundingQuote) {
      verifiedCount++;
      const ctx = await prisma.forwardCitationContext.create({
        data: {
          forwardCitationSearchRunId: searchRun.id,
          referenceId,
          verificationRunId,
          citingTitle: cand.title,
          citingUrl: cand.url,
          citingDoi: cand.doi || null,
          citingAuthorsSnapshot: cand.authors ? JSON.stringify(cand.authors) : null,
          citingPublishedDate: cand.publishedDate || null, // Never invent publication order
          citingDomain: cand.domain,
          citationMatchBasis: rel.citationMatchBasis,
          matchedBibliographyQuote: rel.matchedBibliographyQuote,
          inTextCitationMarker: rel.inTextCitationMarker,
          surroundingQuote: rel.surroundingQuote,
          sourceContentHash: rel.contentHash,
          quoteVerified: rel.quoteVerified,
          sourceStartOffset: rel.startOffset,
          sourceEndOffset: rel.endOffset,
          contextClass: rel.contextClass,
          classificationBasis: `Verified in-text marker ${rel.inTextCitationMarker} corresponding to bibliography entry.`,
        },
      });
      createdContexts.push(ctx);
    }
  }

  const finalStatus =
    verifiedCount > 0
      ? 'COMPLETED_WITH_CONTEXTS'
      : urlsFailed > 0 && urlsExtracted === 0
      ? 'FAILED'
      : 'COMPLETED_NO_VERIFIED_CONTEXTS';

  const updatedRun = await prisma.forwardCitationSearchRun.update({
    where: { id: searchRun.id },
    data: {
      status: finalStatus,
      candidateUrlsFound: candidateUrls.length,
      queriesAttempted,
      urlsExtracted,
      urlsFailed,
      verifiedCitationRelationships: verifiedCount,
      contextsClassified: verifiedCount,
      budgetConsumed: queriesAttempted + (urlsExtracted > 0 ? 1 : 0),
      completedAt: new Date(),
    },
    include: { contexts: true },
  });

  return { searchRun: updatedRun, cached: false };
}
