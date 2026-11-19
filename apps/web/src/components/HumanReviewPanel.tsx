import React, { useState } from 'react';

interface HumanReviewPanelProps {
  claimId: string;
  claimText: string;
  currentVerdict?: string;
  currentRole: 'Researcher' | 'Faculty Reviewer';
  onReviewSubmitted?: (review: any) => void;
}

export const HumanReviewPanel: React.FC<HumanReviewPanelProps> = ({
  claimId,
  claimText,
  currentVerdict = 'PENDING',
  currentRole,
  onReviewSubmitted,
}) => {
  const [action, setAction] = useState<'APPROVE' | 'OVERRIDE' | 'REJECT' | 'COMMENT'>('APPROVE');
  const [resultingState, setResultingState] = useState(currentVerdict);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isReviewer = currentRole === 'Faculty Reviewer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReviewer) {
      setError('Forbidden: Only Faculty Reviewer demo role can submit reviews.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/claims/${claimId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          resultingState,
          notes,
          previousDecision: { automatedVerdict: currentVerdict },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review');
      }

      setSuccessMsg(`Review recorded! Record hash: ${data.review.recordHash.slice(0, 12)}...`);
      if (onReviewSubmitted) onReviewSubmitted(data.review);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: '#ffffff',
        marginTop: '1rem',
      }}
    >
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#0f172a' }}>
        Human Review Interface
      </h3>
      <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.75rem' }}>
        Claim: <span style={{ fontStyle: 'italic' }}>"{claimText}"</span>
      </div>
      <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
        Automated Verdict: <strong>{currentVerdict}</strong>
      </div>

      {!isReviewer ? (
        <div
          style={{
            padding: '0.5rem',
            background: '#fee2e2',
            border: '1px solid #f87171',
            borderRadius: '4px',
            color: '#991b1b',
            fontSize: '0.85rem',
          }}
        >
          🔒 Review actions are locked for <strong>Researcher</strong>. Switch to <strong>Faculty Reviewer</strong> above to approve or override.
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Action:
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as any)}
                style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem' }}
              >
                <option value="APPROVE">APPROVE (Keep Verdict)</option>
                <option value="OVERRIDE">OVERRIDE (Change Verdict)</option>
                <option value="REJECT">REJECT</option>
                <option value="COMMENT">COMMENT</option>
              </select>
            </label>

            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Resulting Verdict:
              <select
                value={resultingState}
                onChange={(e) => setResultingState(e.target.value)}
                style={{ marginLeft: '0.5rem', padding: '0.25rem 0.5rem' }}
              >
                <option value="SUPPORTED">SUPPORTED</option>
                <option value="PARTLY_SUPPORTED">PARTLY_SUPPORTED</option>
                <option value="CONTRADICTORY">CONTRADICTORY</option>
                <option value="UNSUPPORTED">UNSUPPORTED</option>
                <option value="POTENTIALLY_OUTDATED">POTENTIALLY_OUTDATED</option>
                <option value="ABSTAINED">ABSTAINED</option>
              </select>
            </label>
          </div>

          <div>
            <textarea
              placeholder="Reviewer rationales or notes (required for overrides)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.4rem 1rem',
                background: '#7c3aed',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              {submitting ? 'Appending Review...' : 'Submit Review Event'}
            </button>
            {successMsg && (
              <span style={{ color: '#16a34a', fontSize: '0.85rem', fontWeight: 500 }}>
                {successMsg}
              </span>
            )}
            {error && (
              <span style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 500 }}>
                {error}
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
