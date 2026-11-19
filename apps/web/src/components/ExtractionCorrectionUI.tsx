import React, { useState } from 'react';

export interface EditableClaim {
  id: string;
  originalSentence: string;
  normalizedClaim: string;
  claimType: string;
  isFalsePositive: boolean;
  citationMarkers: string[];
}

export interface ExtractionCorrectionUIProps {
  documentId: string;
  initialClaims: EditableClaim[];
  unusedReferencesCount: number;
  orphanedCitationsCount: number;
  onConfirm: (corrections: any) => Promise<void>;
}

export function ExtractionCorrectionUI({
  documentId,
  initialClaims,
  unusedReferencesCount,
  orphanedCitationsCount,
  onConfirm,
}: ExtractionCorrectionUIProps) {
  const [claims, setClaims] = useState<EditableClaim[]>(initialClaims);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleUpdateClaim = (id: string, updatedText: string) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === id ? { ...c, normalizedClaim: updatedText } : c))
    );
  };

  const handleToggleFalsePositive = (id: string) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isFalsePositive: !c.isFalsePositive } : c))
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const correctionsMap: Record<string, any> = {};
      claims.forEach((c) => {
        correctionsMap[c.id] = {
          normalizedClaim: c.normalizedClaim,
          claimType: c.claimType,
          isFalsePositive: c.isFalsePositive,
        };
      });

      await onConfirm({ claims: correctionsMap });
      setConfirmed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Extraction Correction Interface"
      style={{
        padding: '1.5rem',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        marginBottom: '2rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
          Stage 2: Review & Correct Extracted Claims
        </h2>
        {/* Honest limitation notice required by spec */}
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            color: '#1e40af',
          }}
        >
          <strong>Notice:</strong> Rule-based heuristic extraction cannot guarantee detection of every factual assertion or citation. Please review, edit, or discard false positives below before external verification.
        </div>

        {/* Citation Mapping Summary */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.8125rem' }}>
          <span style={{ color: '#475569' }}>
            Unused References: <strong>{unusedReferencesCount}</strong>
          </span>
          <span style={{ color: orphanedCitationsCount > 0 ? '#b91c1c' : '#475569' }}>
            Orphaned Citations: <strong>{orphanedCitationsCount}</strong>
          </span>
        </div>
      </div>

      {/* Claim Review List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {claims.map((claim, index) => (
          <div
            key={claim.id}
            style={{
              padding: '1rem',
              borderRadius: '6px',
              border: `1px solid ${claim.isFalsePositive ? '#fca5a5' : '#e2e8f0'}`,
              backgroundColor: claim.isFalsePositive ? '#fef2f2' : '#f8fafc',
              opacity: claim.isFalsePositive ? 0.6 : 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155' }}>
                Claim #{index + 1} ({claim.claimType})
              </span>
              <button
                type="button"
                onClick={() => handleToggleFalsePositive(claim.id)}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: claim.isFalsePositive ? '#ffffff' : '#f1f5f9',
                  cursor: 'pointer',
                }}
              >
                {claim.isFalsePositive ? 'Restore Claim' : 'Mark as False Positive'}
              </button>
            </div>

            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.5rem' }}>
              <em>Original:</em> &ldquo;{claim.originalSentence}&rdquo;
            </div>

            {!claim.isFalsePositive && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                  Normalized Claim Assertion:
                </label>
                <input
                  type="text"
                  value={claim.normalizedClaim}
                  onChange={(e) => handleUpdateClaim(claim.id, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || confirmed}
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: confirmed ? '#10b981' : '#2563eb',
            color: '#ffffff',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 600,
            cursor: isSubmitting || confirmed ? 'default' : 'pointer',
          }}
        >
          {confirmed ? '✔ Extraction Confirmed' : isSubmitting ? 'Saving...' : 'Confirm & Proceed to Verification'}
        </button>
      </div>
    </div>
  );
}
