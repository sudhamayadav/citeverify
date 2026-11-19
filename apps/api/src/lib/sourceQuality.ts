export type PublicationType =
  | 'JOURNAL_ARTICLE'
  | 'PREPRINT'
  | 'CONFERENCE_PROCEEDING'
  | 'THESIS'
  | 'BOOK_OR_CHAPTER'
  | 'EDITORIAL_OR_CORRECTION_NOTICE'
  | 'UNKNOWN';

export type PeerReviewStatus =
  | 'VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT'
  | 'NOT_ESTABLISHED'
  | 'UNKNOWN';

export interface SourceQualityClassification {
  publicationType: PublicationType;
  publicationTypeBasis: string;
  publicationTypeSourceUrl?: string | null;
  peerReviewStatus: PeerReviewStatus;
  peerReviewBasis: string;
  peerReviewSourceUrl?: string | null;
}

export interface CandidateSourceMetadata {
  url?: string | null;
  doi?: string | null;
  venue?: string | null;
  journal?: string | null;
  title?: string | null;
  publisher?: string | null;
  rawText?: string | null;
  explicitPeerReviewStatementUrl?: string | null;
  explicitPeerReviewStatementText?: string | null;
}

/**
 * Deterministically classifies publication type from verified domain, DOI, and venue signals.
 * Strictly adheres to rule: never infer peer review from ISSN/publisher alone.
 */
export function classifySourceQuality(
  metadata: CandidateSourceMetadata
): SourceQualityClassification {
  const url = (metadata.url || '').toLowerCase();
  const doi = (metadata.doi || '').toLowerCase();
  const venue = (metadata.venue || metadata.journal || '').toLowerCase();
  const title = (metadata.title || '').toLowerCase();

  // 1. Check for Editorial / Retraction / Erratum notices
  if (
    title.includes('retraction notice') ||
    title.includes('erratum') ||
    title.includes('corrigendum') ||
    venue.includes('retraction')
  ) {
    return {
      publicationType: 'EDITORIAL_OR_CORRECTION_NOTICE',
      publicationTypeBasis: 'Title or venue explicitly denotes a formal correction, erratum, or retraction notice.',
      publicationTypeSourceUrl: metadata.url,
      peerReviewStatus: 'NOT_ESTABLISHED',
      peerReviewBasis: 'Editorial notices/errata typically follow editorial oversight rather than standard external peer review.',
    };
  }

  // 2. Check for Preprints (arXiv, bioRxiv, medRxiv, ChemRxiv, Research Square, SSRN)
  const isPreprintDomain =
    url.includes('arxiv.org') ||
    url.includes('biorxiv.org') ||
    url.includes('medrxiv.org') ||
    url.includes('chemrxiv.org') ||
    url.includes('researchsquare.com') ||
    url.includes('ssrn.com') ||
    doi.startsWith('10.48550/') || // arXiv DOI prefix
    doi.startsWith('10.1101/');   // bioRxiv / medRxiv DOI prefix

  if (isPreprintDomain) {
    return {
      publicationType: 'PREPRINT',
      publicationTypeBasis: 'Verified hosted domain or DOI prefix belongs to an established open preprint repository.',
      publicationTypeSourceUrl: metadata.url,
      peerReviewStatus: 'NOT_ESTABLISHED',
      peerReviewBasis: 'Preprint servers distribute manuscripts prior to formal peer review.',
    };
  }

  // 3. Check for Theses / Dissertations
  if (
    venue.includes('dissertation') ||
    venue.includes('master thesis') ||
    venue.includes('doctoral thesis') ||
    url.includes('/theses/') ||
    url.includes('etd.')
  ) {
    return {
      publicationType: 'THESIS',
      publicationTypeBasis: 'Repository record indicates academic thesis or doctoral dissertation.',
      publicationTypeSourceUrl: metadata.url,
      peerReviewStatus: 'NOT_ESTABLISHED',
      peerReviewBasis: 'Academic theses undergo graduate committee defense rather than journal peer review.',
    };
  }

  // 4. Check for Conference Proceedings
  if (
    venue.includes('proceedings') ||
    venue.includes('conference') ||
    venue.includes('symposium') ||
    venue.includes('acm') ||
    venue.includes('ieee')
  ) {
    let peerReview: PeerReviewStatus = 'UNKNOWN';
    let peerBasis = 'Conference proceedings require explicit publication track documentation to establish peer-review standards.';

    if (metadata.explicitPeerReviewStatementUrl && metadata.explicitPeerReviewStatementText) {
      peerReview = 'VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT';
      peerBasis = `Venue provided explicit peer-review process statement: "${metadata.explicitPeerReviewStatementText.slice(0, 100)}"`;
    }

    return {
      publicationType: 'CONFERENCE_PROCEEDING',
      publicationTypeBasis: 'Venue metadata indicates academic conference proceedings.',
      publicationTypeSourceUrl: metadata.url,
      peerReviewStatus: peerReview,
      peerReviewBasis: peerBasis,
      peerReviewSourceUrl: metadata.explicitPeerReviewStatementUrl,
    };
  }

  // 5. Check for Books / Book Chapters
  if (venue.includes('book') || venue.includes('handbook') || venue.includes('springer series')) {
    return {
      publicationType: 'BOOK_OR_CHAPTER',
      publicationTypeBasis: 'Publication metadata indicates book chapter or monograph volume.',
      publicationTypeSourceUrl: metadata.url,
      peerReviewStatus: 'UNKNOWN',
      peerReviewBasis: 'Monographs follow editorial or invited review processes; standard peer-review status requires explicit statement.',
    };
  }

  // 6. Check for Journal Articles
  const isRecognizedPublisher =
    url.includes('nature.com') ||
    url.includes('sciencedirect.com') ||
    url.includes('springer.com') ||
    url.includes('wiley.com') ||
    url.includes('oup.com') ||
    url.includes('cell.com') ||
    url.includes('thelancet.com') ||
    url.includes('plos.org') ||
    url.includes('frontiersin.org') ||
    venue.includes('journal') ||
    venue.includes('annals') ||
    venue.includes('bulletin');

  if (isRecognizedPublisher) {
    let peerReview: PeerReviewStatus = 'NOT_ESTABLISHED';
    let peerBasis = 'Journal publication confirmed; publisher statement required to independently verify specific peer-review policy.';

    if (metadata.explicitPeerReviewStatementUrl && metadata.explicitPeerReviewStatementText) {
      peerReview = 'VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT';
      peerBasis = `Publisher/venue statement explicitly confirms peer review: "${metadata.explicitPeerReviewStatementText.slice(0, 100)}"`;
    }

    return {
      publicationType: 'JOURNAL_ARTICLE',
      publicationTypeBasis: 'Verified publisher domain or journal title metadata.',
      publicationTypeSourceUrl: metadata.url,
      peerReviewStatus: peerReview,
      peerReviewBasis: peerBasis,
      peerReviewSourceUrl: metadata.explicitPeerReviewStatementUrl,
    };
  }

  // 7. Unknown default
  return {
    publicationType: 'UNKNOWN',
    publicationTypeBasis: 'Insufficient publisher or repository signals to determine formal publication category.',
    publicationTypeSourceUrl: metadata.url,
    peerReviewStatus: 'UNKNOWN',
    peerReviewBasis: 'Cannot assess peer-review status for unverified or unknown publication venues.',
  };
}
