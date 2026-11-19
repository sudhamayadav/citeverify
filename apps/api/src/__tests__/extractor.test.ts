import { describe, it, expect } from 'vitest';
import {
  separateBodyAndBibliography,
  parseBibliography,
  detectCitationMarkers,
  extractClaimsFromText,
  extractClaimsAndReferences,
} from '@/lib/extractor';

describe('Milestone 3 Stage 2 Claim & Citation Extraction Suite', () => {
  const sampleDocumentText = `
1. Introduction
A recent clinical evaluation demonstrated that a novel mobile application improved student assessment test scores by 30% [1].
Furthermore, previous studies reported contrasting findings in adult populations [2, 3].
Another investigation showed significant cognitive benefits (Smith et al., 2022).
However, a distinct study found no measurable improvement across participants [4-6].
Finally, an uncited assertion states that software enhances memory retention.

References
[1] Smith, J., Doe, A. (2021). Mobile learning in schools. Journal of Educational Tech. 10.1016/j.jedutech.2021.05.001.
[2] Brown, K. (2020). Adult learning outcomes. Academic Press.
[3] White, L. (2019). Contrast in adult test scores. Learning Review.
[7] Unused Author (2018). Completely uncited paper in the document bibliography.
`;

  // Test 1: Body and Bibliography Separation
  it('1. Separates body text and bibliography sections cleanly', () => {
    const { bodyText, bibliographyText } = separateBodyAndBibliography(sampleDocumentText);
    expect(bodyText).toContain('1. Introduction');
    expect(bodyText).not.toContain('Mobile learning in schools');
    expect(bibliographyText).toContain('Mobile learning in schools');
    expect(bibliographyText).toContain('[7] Unused Author');
  });

  // Test 2: Parse Bibliography Entries
  it('2. Parses numbered bibliography entries and extracts DOI and year', () => {
    const { bibliographyText, bibliographyStartOffset } = separateBodyAndBibliography(sampleDocumentText);
    const refs = parseBibliography(bibliographyText, bibliographyStartOffset);

    expect(refs.length).toBeGreaterThanOrEqual(4);
    const ref1 = refs.find((r) => r.referenceNumber === 1);
    expect(ref1).toBeDefined();
    expect(ref1?.doi).toBe('10.1016/j.jedutech.2021.05.001');
    expect(ref1?.publicationYear).toBe(2021);
  });

  // Test 3: Citation Detection ([1], [2, 3], [4-6], (Smith et al., 2022))
  it('3. Detects multiple citation formats: single [1], multi [2, 3], range [4-6], and author-year', () => {
    const { bodyText, bibliographyText, bibliographyStartOffset } = separateBodyAndBibliography(sampleDocumentText);
    const refs = parseBibliography(bibliographyText, bibliographyStartOffset);

    // Numbered single [1]
    const m1 = detectCitationMarkers('Test scores improved by 30% [1].', 0, refs);
    expect(m1.length).toBe(1);
    expect(m1[0].rawMarker).toBe('[1]');
    expect(m1[0].mappingState).toBe('MATCHED');

    // Numbered comma list [2, 3]
    const m2 = detectCitationMarkers('Contrasting findings [2, 3].', 0, refs);
    expect(m2.length).toBe(2);
    expect(m2.map((m) => m.rawMarker)).toEqual(['[2]', '[3]']);

    // Range [4-6]
    const m3 = detectCitationMarkers('Found no improvement [4-6].', 0, refs);
    expect(m3.length).toBe(3);
    expect(m3.map((m) => m.rawMarker)).toEqual(['[4]', '[5]', '[6]']);
    // [4], [5], [6] are missing from the bibliography -> flagged as MISSING
    expect(m3.every((m) => m.mappingState === 'MISSING')).toBe(true);

    // Author-year (Smith et al., 2022)
    const m4 = detectCitationMarkers('Significant cognitive benefits (Smith et al., 2022).', 0, refs);
    expect(m4.length).toBe(1);
    expect(m4[0].markerType).toBe('AUTHOR_YEAR');
  });

  // Test 4: Claim Extraction & Normalization
  it('4. Extracts potential claims and normalizes assertions', () => {
    const { bodyText, bibliographyText, bibliographyStartOffset } = separateBodyAndBibliography(sampleDocumentText);
    const refs = parseBibliography(bibliographyText, bibliographyStartOffset);
    const claims = extractClaimsFromText(bodyText, refs);

    expect(claims.length).toBeGreaterThan(0);
    const statClaim = claims.find((c) => c.originalSentence.includes('30%'));
    expect(statClaim).toBeDefined();
    expect(statClaim?.claimType).toBe('STATISTICAL');
    // Normalized claim strips in-text citation marker
    expect(statClaim?.normalizedClaim).not.toContain('[1]');
    expect(statClaim?.normalizedClaim).toContain('30%');
  });

  // Test 5: Unused References and Orphaned Citations Detection
  it('5. Identifies unused references and orphaned citations', () => {
    const result = extractClaimsAndReferences(sampleDocumentText);

    // [7] is in bibliography but never cited
    const unused7 = result.unusedReferences.find((r) => r.referenceNumber === 7);
    expect(unused7).toBeDefined();

    // [4-6] are cited in text but not in bibliography -> orphaned
    const orphaned4 = result.orphanedCitations.find((c) => c.rawMarker === '[4]');
    expect(orphaned4).toBeDefined();
    expect(orphaned4?.mappingState).toBe('MISSING');

    // Contains mandatory disclaimer notice
    expect(result.extractionNotice).toContain('Heuristic extraction cannot guarantee');
  });
});
