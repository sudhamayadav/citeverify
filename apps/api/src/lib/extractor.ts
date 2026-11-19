import crypto from 'crypto';

export interface ExtractedReference {
  referenceId: string;
  rawReferenceText: string;
  title: string | null;
  authors: string[] | null;
  publicationYear: number | null;
  doi: string | null;
  journal: string | null;
  volumeIssuePages: string | null;
  sourceLocation: {
    pageNumber: number | null;
    startOffset: number;
    endOffset: number;
  } | null;
  extractionWarnings: string[];
  referenceNumber?: number | null; // e.g. 1 for [1]
  authorYearKey?: string | null;   // e.g. "smith_2022"
  isCited: boolean;
}

export interface ExtractedCitationMention {
  mentionId: string;
  rawMarker: string;
  markerType: 'NUMBERED' | 'AUTHOR_YEAR';
  startOffset: number;
  endOffset: number;
  matchedReferenceId: string | null;
  mappingState: 'MATCHED' | 'AMBIGUOUS' | 'MISSING';
  mappingConfidence: number;
}

export interface ExtractedClaim {
  claimId: string;
  originalSentence: string;
  normalizedClaim: string;
  startOffset: number;
  endOffset: number;
  pageNumber: number | null;
  claimType: 'STATISTICAL' | 'COMPARISON' | 'CAUSAL' | 'FACTUAL' | 'POTENTIAL_CLAIM';
  extractionMethod: 'HEURISTIC';
  extractionConfidence: string;
  citationMentions: ExtractedCitationMention[];
  isUncited: boolean;
}

export interface ExtractionResult {
  bodyText: string;
  bibliographyText: string;
  claims: ExtractedClaim[];
  references: ExtractedReference[];
  unusedReferences: ExtractedReference[];
  orphanedCitations: ExtractedCitationMention[];
  extractionNotice: string;
}

/**
 * 1. Body & Bibliography Separation
 */
export function separateBodyAndBibliography(fullText: string): {
  bodyText: string;
  bibliographyText: string;
  bibliographyStartOffset: number;
} {
  const bibRegex = /\r?\n\s*(references|bibliography|works cited|literature cited)\s*\r?\n/i;
  const match = bibRegex.exec(fullText);

  if (!match) {
    return {
      bodyText: fullText,
      bibliographyText: '',
      bibliographyStartOffset: fullText.length,
    };
  }

  const bibliographyStartOffset = match.index;
  const bodyText = fullText.slice(0, bibliographyStartOffset);
  const bibliographyText = fullText.slice(bibliographyStartOffset + match[0].length);

  return {
    bodyText,
    bibliographyText,
    bibliographyStartOffset,
  };
}

/**
 * 2. Parse References from Bibliography Text
 */
export function parseBibliography(
  bibliographyText: string,
  baseOffset: number
): ExtractedReference[] {
  if (!bibliographyText.trim()) return [];

  // Split entries by numbered prefix [1] or 1. or double newline
  const entries: { text: string; start: number; end: number }[] = [];
  const lines = bibliographyText.split(/\r?\n/);
  
  let currentEntry = '';
  let entryStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isNewNumbered = /^\s*(\[\d+\]|\d+\.)\s+/.test(line);
    const isNewAuthorYear = /^\s*[A-Z][a-zA-Z\s.-]+,\s*[A-Z].*?\(\d{4}\)/.test(line);

    if ((isNewNumbered || isNewAuthorYear) && currentEntry.trim()) {
      const idx = bibliographyText.indexOf(currentEntry, entryStart);
      entries.push({
        text: currentEntry.trim(),
        start: baseOffset + idx,
        end: baseOffset + idx + currentEntry.length,
      });
      currentEntry = line + '\n';
      entryStart = idx + currentEntry.length;
    } else {
      currentEntry += line + '\n';
    }
  }

  if (currentEntry.trim()) {
    const idx = bibliographyText.indexOf(currentEntry, entryStart);
    entries.push({
      text: currentEntry.trim(),
      start: baseOffset + (idx >= 0 ? idx : 0),
      end: baseOffset + (idx >= 0 ? idx : 0) + currentEntry.length,
    });
  }

  return entries.map((entry, idx) => {
    const raw = entry.text;
    const warnings: string[] = [];

    // Reference Number detection ([1] or 1.)
    let refNum: number | null = null;
    const numMatch = /^\[(\d+)\]|^\s*(\d+)\.\s+/.exec(raw);
    if (numMatch) {
      refNum = parseInt(numMatch[1] || numMatch[2], 10);
    }

    // DOI extraction
    let doi: string | null = null;
    const doiMatch = /10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/i.exec(raw);
    if (doiMatch) {
      doi = doiMatch[0].replace(/[,.)]+$/, '');
    }

    // Year extraction: 4 digits (19xx or 20xx)
    let year: number | null = null;
    const yearMatch = /\b(19\d{2}|20\d{2})\b/.exec(raw);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }

    // Author detection
    let authors: string[] | null = null;
    let authorYearKey: string | null = null;
    const authorSection = raw.replace(/^\[\d+\]\s*|\d+\.\s*/, '').split(/\.|\(/)[0];
    if (authorSection && authorSection.length < 80) {
      authors = authorSection.split(/,|&|and/).map((a) => a.trim()).filter(Boolean);
      const firstAuthor = (authors[0] || '').split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
      if (firstAuthor && year) {
        authorYearKey = `${firstAuthor}_${year}`;
      }
    }

    // Title heuristic: text between first period/year and subsequent period
    let title: string | null = null;
    const titleMatch = /(?:\.|\))\s+([A-Z][^.]+?\.)\s+/.exec(raw);
    if (titleMatch && titleMatch[1].length > 10) {
      title = titleMatch[1].trim();
    }

    return {
      referenceId: crypto.randomUUID(),
      rawReferenceText: raw,
      title,
      authors,
      publicationYear: year,
      doi,
      journal: null,
      volumeIssuePages: null,
      sourceLocation: {
        pageNumber: null,
        startOffset: entry.start,
        endOffset: entry.end,
      },
      extractionWarnings: warnings,
      referenceNumber: refNum,
      authorYearKey,
      isCited: false,
    };
  });
}

/**
 * 3. Citation Mention Detection
 * Supports [1], [1, 2], [3-5], (Smith et al., 2022), (Smith and Brown, 2023)
 */
export function detectCitationMarkers(
  sentence: string,
  sentenceOffset: number,
  references: ExtractedReference[]
): ExtractedCitationMention[] {
  const mentions: ExtractedCitationMention[] = [];

  // 1. Bracketed Numbered Citations: e.g. [1], [1, 2], [3-5]
  const bracketRegex = /\[(\d+(?:\s*,\s*\d+|\s*-\s*\d+)*)\]/g;
  let match: RegExpExecArray | null;

  while ((match = bracketRegex.exec(sentence)) !== null) {
    const rawMarker = match[0];
    const markerInner = match[1];
    const startOffset = sentenceOffset + match.index;
    const endOffset = startOffset + rawMarker.length;

    // Parse sub-numbers like [1, 2] or range [3-5]
    const parts = markerInner.split(',').map((p) => p.trim());
    const numbers: number[] = [];

    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end) && end >= start && end - start < 20) {
          for (let n = start; n <= end; n++) numbers.push(n);
        }
      } else {
        const n = parseInt(part, 10);
        if (!isNaN(n)) numbers.push(n);
      }
    }

    // False-positive suppression: lone zero or number > 999 is likely equation or year
    if (numbers.length === 1 && (numbers[0] === 0 || numbers[0] > 999)) {
      continue;
    }

    for (const num of numbers) {
      const matchedRef = references.find((r) => r.referenceNumber === num);
      if (matchedRef) {
        matchedRef.isCited = true;
      }

      mentions.push({
        mentionId: crypto.randomUUID(),
        rawMarker: `[${num}]`,
        markerType: 'NUMBERED',
        startOffset,
        endOffset,
        matchedReferenceId: matchedRef ? matchedRef.referenceId : null,
        mappingState: matchedRef ? 'MATCHED' : 'MISSING',
        mappingConfidence: matchedRef ? 0.95 : 0.3,
      });
    }
  }

  // 2. Author-Year Citations: e.g. (Smith et al., 2022), (Smith and Brown, 2023)
  const authorYearRegex = /\(([A-Z][a-zA-Z]+(?:\s+et\s+al\.?|\s+and\s+[A-Z][a-zA-Z]+)?),\s*(19\d{2}|20\d{2})\)/g;

  while ((match = authorYearRegex.exec(sentence)) !== null) {
    const rawMarker = match[0];
    const authorStr = match[1];
    const yearStr = match[2];
    const startOffset = sentenceOffset + match.index;
    const endOffset = startOffset + rawMarker.length;

    const firstAuthor = authorStr.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    const key = `${firstAuthor}_${yearStr}`;

    const matchedRef = references.find(
      (r) => r.authorYearKey === key || (r.publicationYear === parseInt(yearStr, 10) && r.rawReferenceText.toLowerCase().includes(firstAuthor))
    );

    if (matchedRef) {
      matchedRef.isCited = true;
    }

    mentions.push({
      mentionId: crypto.randomUUID(),
      rawMarker,
      markerType: 'AUTHOR_YEAR',
      startOffset,
      endOffset,
      matchedReferenceId: matchedRef ? matchedRef.referenceId : null,
      mappingState: matchedRef ? 'MATCHED' : 'MISSING',
      mappingConfidence: matchedRef ? 0.9 : 0.4,
    });
  }

  return mentions;
}

/**
 * 4. Claim Extraction via Local Deterministic Rules
 */
export function extractClaimsFromText(
  bodyText: string,
  references: ExtractedReference[]
): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  // Sentence boundary split
  const sentenceRegex = /([A-Z0-9][^.!?]*?(?:\[\d+[^\]]*?\]|\([^)]*?\d{4}[^)]*?\)|[0-9]+%|demonstrate|show|find|indicate|conclude|suggest|improve|reduce|increase)[^.!?]*?[.!?])/g;

  let match: RegExpExecArray | null;
  while ((match = sentenceRegex.exec(bodyText)) !== null) {
    const originalSentence = match[0].trim();
    const startOffset = match.index;
    const endOffset = startOffset + match[0].length;

    if (originalSentence.length < 20) continue;

    // Detect citations within sentence
    const mentions = detectCitationMarkers(originalSentence, startOffset, references);

    // Heuristic Claim Type Classification
    let claimType: ExtractedClaim['claimType'] = 'POTENTIAL_CLAIM';
    if (/\b\d+(\.\d+)?%|\bp\s*<|\bCI\b|\bSD\b|\bmean\b/i.test(originalSentence)) {
      claimType = 'STATISTICAL';
    } else if (/\b(more than|less than|greater|higher|lower|superior|compared to|versus|relative to)\b/i.test(originalSentence)) {
      claimType = 'COMPARISON';
    } else if (/\b(causes|leads to|results in|induced|prevents|triggers|attributed to)\b/i.test(originalSentence)) {
      claimType = 'CAUSAL';
    } else if (/\b(found that|demonstrated that|showed that|observed|reported that)\b/i.test(originalSentence)) {
      claimType = 'FACTUAL';
    }

    // Normalized claim (lowercase, collapse whitespace, strip citations)
    const normalizedClaim = originalSentence
      .replace(/\[\d+[^\]]*?\]/g, '')
      .replace(/\([^)]*?\d{4}[^)]*?\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    claims.push({
      claimId: crypto.randomUUID(),
      originalSentence,
      normalizedClaim,
      startOffset,
      endOffset,
      pageNumber: null,
      claimType,
      extractionMethod: 'HEURISTIC',
      extractionConfidence: `Heuristic rule match: ${claimType}. User confirmation recommended before verification.`,
      citationMentions: mentions,
      isUncited: mentions.length === 0,
    });
  }

  return claims;
}

/**
 * Stage 2 Orchestrator
 */
export function extractClaimsAndReferences(fullText: string): ExtractionResult {
  const { bodyText, bibliographyText, bibliographyStartOffset } = separateBodyAndBibliography(fullText);
  const references = parseBibliography(bibliographyText, bibliographyStartOffset);
  const claims = extractClaimsFromText(bodyText, references);

  const unusedReferences = references.filter((r) => !r.isCited);
  const orphanedCitations: ExtractedCitationMention[] = [];

  for (const claim of claims) {
    for (const mention of claim.citationMentions) {
      if (mention.mappingState === 'MISSING') {
        orphanedCitations.push(mention);
      }
    }
  }

  return {
    bodyText,
    bibliographyText,
    claims,
    references,
    unusedReferences,
    orphanedCitations,
    extractionNotice:
      'Heuristic extraction cannot guarantee detection of every factual assertion or citation. Please review, edit, split/merge claims, and confirm mappings before external verification.',
  };
}
