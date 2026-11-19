import React from 'react';

interface EvidenceHighlighterProps {
  fullText: string;
  quote?: string | null;
  quoteVerified?: boolean;
}

/**
 * Highlights a verified contiguous quote within the passage text.
 */
export const EvidenceHighlighter: React.FC<EvidenceHighlighterProps> = ({
  fullText,
  quote,
  quoteVerified,
}) => {
  if (!quote || !fullText) {
    return (
      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem' }}>
        {fullText || 'No source passage text available.'}
      </div>
    );
  }

  const cleanQuote = quote.trim();
  const index = fullText.indexOf(cleanQuote);

  if (index === -1) {
    return (
      <div>
        <div style={{ color: '#dc2626', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          ⚠️ Quote not found as contiguous span in full text
        </div>
        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem' }}>
          {fullText}
        </div>
      </div>
    );
  }

  const before = fullText.slice(0, index);
  const match = fullText.slice(index, index + cleanQuote.length);
  const after = fullText.slice(index + cleanQuote.length);

  return (
    <div>
      {quoteVerified && (
        <div style={{ color: '#16a34a', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          ✓ Contiguous Quote Verified
        </div>
      )}
      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: '1.5' }}>
        <span>{before}</span>
        <mark
          style={{
            backgroundColor: quoteVerified ? '#bbf7d0' : '#fef08a',
            color: '#1e293b',
            padding: '2px 4px',
            borderRadius: '2px',
            fontWeight: 'bold',
          }}
        >
          {match}
        </mark>
        <span>{after}</span>
      </div>
    </div>
  );
};
