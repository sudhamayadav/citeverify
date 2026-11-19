import React from 'react';

export interface CitationHealthCardProps {
  historicalClaimSupport: {
    claimText?: string | null;
    supportVerdict: string;
    confidence: string;
    quoteVerified?: boolean;
    extractedQuote?: string | null;
  };
  currentPublicationHealth: {
    title?: string | null;
    doi?: string | null;
    retractionStatus: string;
    correctionStatus?: string;
    currentnessAssessment?: string;
    retractionWarning?: string | null;
    forwardCitationSearchRun?: {
      status: string;
      verifiedContextCount: number;
      contexts?: Array<{
        citingTitle: string;
        citingUrl: string;
        contextClass: string;
        surroundingQuote: string;
        inTextCitationMarker?: string | null;
      }>;
    } | null;
    sampledContextsDisclaimer?: string;
  };
}

export const CitationHealthCard: React.FC<CitationHealthCardProps> = ({
  historicalClaimSupport,
  currentPublicationHealth,
}) => {
  const isRetracted = currentPublicationHealth.retractionStatus === 'CONFIRMED_RETRACTED';

  return (
    <div
      style={{
        border: isRetracted ? '2px solid #ef4444' : '1px solid #cbd5e1',
        borderRadius: '8px',
        background: '#ffffff',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        marginBottom: '1.5rem',
      }}
    >
      {/* Retraction Alert Banner */}
      {isRetracted && (
        <div
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            borderBottom: '1px solid #f87171',
          }}
        >
          🚨 CONFIRMED RETRACTED: This publication has been formally retracted.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', padding: '1rem' }}>
        {/* PANEL 1: Historical Claim Support */}
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Historical Claim Support
          </div>
          <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            Claim: <em>"{historicalClaimSupport.claimText || 'Referenced assertion'}"</em>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem' }}>Original Finding Support:</span>
            <span
              style={{
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '0.8rem',
                background: historicalClaimSupport.supportVerdict === 'SUPPORTED' ? '#dcfce7' : '#fef3c7',
                color: historicalClaimSupport.supportVerdict === 'SUPPORTED' ? '#166534' : '#92400e',
              }}
            >
              {historicalClaimSupport.supportVerdict}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#475569' }}>
            Confidence: <strong>{historicalClaimSupport.confidence}</strong> | Quote Verified: {historicalClaimSupport.quoteVerified ? '✓ Yes' : '✗ No'}
          </div>
          {historicalClaimSupport.extractedQuote && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', background: '#fff', padding: '0.5rem', borderRadius: '4px', borderLeft: '3px solid #22c55e' }}>
              &ldquo;{historicalClaimSupport.extractedQuote}&rdquo;
            </div>
          )}
        </div>

        {/* PANEL 2: Current Publication Health */}
        <div style={{ background: isRetracted ? '#fef2f2' : '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Current Publication Health
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            {currentPublicationHealth.title || 'Publication Details'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
            DOI: {currentPublicationHealth.doi || 'N/A'}
          </div>
          <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
            Retraction Status: <strong style={{ color: isRetracted ? '#dc2626' : '#16a34a' }}>{currentPublicationHealth.retractionStatus}</strong>
          </div>
          <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            Correction Status: <span>{currentPublicationHealth.correctionStatus || 'SEARCHED_NO_CORRECTION_FOUND'}</span>
          </div>

          {/* Forward citation context status */}
          <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
              Sampled Forward Citation Contexts: {currentPublicationHealth.forwardCitationSearchRun?.verifiedContextCount ?? 0}
            </div>
            {currentPublicationHealth.forwardCitationSearchRun?.contexts && currentPublicationHealth.forwardCitationSearchRun.contexts.length > 0 && (
              <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {currentPublicationHealth.forwardCitationSearchRun.contexts.slice(0, 2).map((ctx, idx) => (
                  <div key={idx} style={{ fontSize: '0.75rem', background: '#fff', padding: '0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 600 }}>{ctx.citingTitle} ({ctx.contextClass})</div>
                    <div style={{ color: '#64748b', fontStyle: 'italic' }}>&ldquo;{ctx.surroundingQuote}&rdquo;</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory Disclaimer Footer */}
      <div
        style={{
          background: '#f1f5f9',
          padding: '0.6rem 1rem',
          fontSize: '0.75rem',
          color: '#475569',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        ℹ️ {currentPublicationHealth.sampledContextsDisclaimer ||
          'Sampled, non-exhaustive forward citation context discovered through Tavily Search. Results and counts do not represent total scholarly citations or a complete citation index.'}
      </div>
    </div>
  );
};
