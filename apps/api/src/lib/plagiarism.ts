/**
 * Deterministic local plagiarism / text-overlap detection.
 * Compares document claim / sentence text against locally stored Tavily-extracted source passages
 * using normalized 5-grams (shingles) and longest contiguous matching substring search.
 * Hard rule: Local deterministic logic only, no external plagiarism APIs.
 */

export type PlagiarismStatus =
  | 'VERBATIM_UNQUOTED_OVERLAP'
  | 'QUOTED_MATCH'
  | 'NO_SIGNIFICANT_OVERLAP';

export interface SourcePassageCandidate {
  passageId?: string;
  sourceUrl?: string;
  text: string;
}

export interface PlagiarismCheckResult {
  plagiarismStatus: PlagiarismStatus;
  overlapPercentage: number;
  matchedSpan: string | null;
  sourceUrl: string | null;
  passageId: string | null;
  isProperlyQuoted: boolean;
  disclaimer: string;
}

const PLAGIARISM_DISCLAIMER =
  'Sampled text-overlap check against retrieved Tavily sources only — not a full-corpus plagiarism scan.';

/**
 * Normalizes text for n-gram extraction (lowercase, alphanumeric + space).
 */
function normalizeForTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Builds n-gram shingles (default 5-gram).
 */
function buildShingles(tokens: string[], n = 5): Set<string> {
  const shingles = new Set<string>();
  if (tokens.length < n) {
    if (tokens.length > 0) {
      shingles.add(tokens.join(' '));
    }
    return shingles;
  }
  for (let i = 0; i <= tokens.length - n; i++) {
    shingles.add(tokens.slice(i, i + n).join(' '));
  }
  return shingles;
}

/**
 * Finds the longest contiguous matching substring of normalized words between query and passage.
 */
function findLongestContiguousMatch(queryTokens: string[], passageTokens: string[]): string[] {
  let longest: string[] = [];
  const pLen = passageTokens.length;
  const qLen = queryTokens.length;

  for (let i = 0; i < qLen; i++) {
    for (let j = 0; j < pLen; j++) {
      let k = 0;
      while (
        i + k < qLen &&
        j + k < pLen &&
        queryTokens[i + k] === passageTokens[j + k]
      ) {
        k++;
      }
      if (k > longest.length) {
        longest = queryTokens.slice(i, i + k);
      }
    }
  }

  return longest;
}

/**
 * Checks whether the text or overlapping segment is enclosed in quotation marks.
 */
function isEnclosedInQuotes(originalText: string, matchedSegment: string): boolean {
  if (!matchedSegment) return false;
  const trimmed = originalText.trim();
  // Check if whole text is surrounded by quotes
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('“') && trimmed.endsWith('”')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return true;
  }

  // Check if the matched substring is inside quotation marks in originalText
  const quoteRegex = /["“']([^"”']+)["”']/g;
  let match: RegExpExecArray | null;
  const normSegment = matchedSegment.toLowerCase();

  while ((match = quoteRegex.exec(originalText)) !== null) {
    const quotedContent = match[1].toLowerCase();
    if (quotedContent.includes(normSegment) || normSegment.includes(quotedContent)) {
      return true;
    }
  }

  return false;
}

/**
 * Detects text overlap between claimText and candidates.
 */
export function detectTextOverlap(
  claimText: string,
  passages: SourcePassageCandidate[],
  options: { shingleSize?: number; verbatimThresholdPercent?: number } = {}
): PlagiarismCheckResult {
  const shingleSize = options.shingleSize ?? 5;
  const verbatimThreshold = options.verbatimThresholdPercent ?? 50;

  if (!claimText || !passages || passages.length === 0) {
    return {
      plagiarismStatus: 'NO_SIGNIFICANT_OVERLAP',
      overlapPercentage: 0,
      matchedSpan: null,
      sourceUrl: null,
      passageId: null,
      isProperlyQuoted: false,
      disclaimer: PLAGIARISM_DISCLAIMER,
    };
  }

  const claimTokens = normalizeForTokens(claimText);
  if (claimTokens.length === 0) {
    return {
      plagiarismStatus: 'NO_SIGNIFICANT_OVERLAP',
      overlapPercentage: 0,
      matchedSpan: null,
      sourceUrl: null,
      passageId: null,
      isProperlyQuoted: false,
      disclaimer: PLAGIARISM_DISCLAIMER,
    };
  }

  const claimShingles = buildShingles(claimTokens, shingleSize);

  let bestOverlapPercent = 0;
  let bestMatchedSpan: string | null = null;
  let bestSourceUrl: string | null = null;
  let bestPassageId: string | null = null;

  for (const p of passages) {
    const passageTokens = normalizeForTokens(p.text);
    if (passageTokens.length === 0) continue;

    const passageShingles = buildShingles(passageTokens, shingleSize);

    // Calculate shingle containment (how much of the claim shingles exist in the source)
    let commonShingles = 0;
    claimShingles.forEach((s) => {
      if (passageShingles.has(s)) {
        commonShingles++;
      }
    });

    const shingleOverlap = claimShingles.size > 0 ? (commonShingles / claimShingles.size) * 100 : 0;
    const contiguousTokens = findLongestContiguousMatch(claimTokens, passageTokens);
    const contiguousOverlap = (contiguousTokens.length / claimTokens.length) * 100;

    const effectiveOverlap = Math.max(shingleOverlap, contiguousOverlap);

    if (effectiveOverlap > bestOverlapPercent) {
      bestOverlapPercent = Math.round(effectiveOverlap * 10) / 10;
      bestMatchedSpan = contiguousTokens.length >= 4 ? contiguousTokens.join(' ') : null;
      bestSourceUrl = p.sourceUrl || null;
      bestPassageId = p.passageId || null;
    }
  }

  const properlyQuoted = isEnclosedInQuotes(claimText, bestMatchedSpan || '');

  let status: PlagiarismStatus = 'NO_SIGNIFICANT_OVERLAP';
  if (bestOverlapPercent >= verbatimThreshold) {
    status = properlyQuoted ? 'QUOTED_MATCH' : 'VERBATIM_UNQUOTED_OVERLAP';
  }

  return {
    plagiarismStatus: status,
    overlapPercentage: bestOverlapPercent,
    matchedSpan: bestMatchedSpan,
    sourceUrl: bestSourceUrl,
    passageId: bestPassageId,
    isProperlyQuoted: properlyQuoted,
    disclaimer: PLAGIARISM_DISCLAIMER,
  };
}
