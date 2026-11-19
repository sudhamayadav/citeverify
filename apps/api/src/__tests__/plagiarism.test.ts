import { describe, it, expect } from 'vitest';
import { detectTextOverlap } from '../lib/plagiarism';

describe('Deterministic Local Plagiarism / Text Overlap Detection', () => {
  const mockPassages = [
    {
      passageId: 'p-101',
      sourceUrl: 'https://nature.com/articles/s41586-023-example',
      text: 'Recent advances demonstrate that high capacity multimodal foundation models achieve unprecedented accuracy on standardized benchmark evaluation datasets.',
    },
    {
      passageId: 'p-102',
      sourceUrl: 'https://arxiv.org/abs/2301.99999',
      text: 'Our experimental results show a 35 percent reduction in processing latency across distributed server clusters without accuracy degradation.',
    },
  ];

  it('1. Flags unquoted copied sentence as VERBATIM_UNQUOTED_OVERLAP with matched span and source', () => {
    // Unquoted copied sentence with verbatim overlap against p-101
    const copiedClaim =
      'Recent advances demonstrate that high capacity multimodal foundation models achieve unprecedented accuracy on standardized benchmark evaluation datasets.';

    const result = detectTextOverlap(copiedClaim, mockPassages);

    expect(result.plagiarismStatus).toBe('VERBATIM_UNQUOTED_OVERLAP');
    expect(result.overlapPercentage).toBeGreaterThanOrEqual(80);
    expect(result.isProperlyQuoted).toBe(false);
    expect(result.sourceUrl).toBe('https://nature.com/articles/s41586-023-example');
    expect(result.matchedSpan).toContain('high capacity multimodal foundation models achieve');
    expect(result.disclaimer).toBe(
      'Sampled text-overlap check against retrieved Tavily sources only — not a full-corpus plagiarism scan.'
    );
  });

  it('2. Marks verbatim copied sentence enclosed in quotation marks as QUOTED_MATCH', () => {
    // Exact same phrase but properly wrapped in quotation marks
    const quotedClaim =
      '"Recent advances demonstrate that high capacity multimodal foundation models achieve unprecedented accuracy on standardized benchmark evaluation datasets."';

    const result = detectTextOverlap(quotedClaim, mockPassages);

    expect(result.plagiarismStatus).toBe('QUOTED_MATCH');
    expect(result.overlapPercentage).toBeGreaterThanOrEqual(80);
    expect(result.isProperlyQuoted).toBe(true);
    expect(result.sourceUrl).toBe('https://nature.com/articles/s41586-023-example');
    expect(result.disclaimer).toContain('Sampled text-overlap check');
  });

  it('3. Marks distinct or paraphrased original text as NO_SIGNIFICANT_OVERLAP', () => {
    // Paraphrased text with new vocabulary and different syntactic structure
    const originalAuthorText =
      'We engineered an alternative heuristic framework which reduced latency by thirty-five percent when evaluated in our customized test harness.';

    const result = detectTextOverlap(originalAuthorText, mockPassages);

    expect(result.plagiarismStatus).toBe('NO_SIGNIFICANT_OVERLAP');
    expect(result.overlapPercentage).toBeLessThan(50);
    expect(result.disclaimer).toBe(
      'Sampled text-overlap check against retrieved Tavily sources only — not a full-corpus plagiarism scan.'
    );
  });
});
