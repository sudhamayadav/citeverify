import React, { useState } from 'react';

export interface AuditSnapshotPayload {
  documentSha256: string;
  verdictRuleVersion: string;
  claimSnapshot: { claimId: string; originalSentence: string; normalizedClaim: string }[];
  tavilyQueriesSnapshot: { query: string; endpoint: string; timestamp: string; requestId?: string }[];
  retrievedUrlsSnapshot: string[];
  contentHashesSnapshot: { url: string; contentSha256: string; retrievedAt: string }[];
  passageOffsetsSnapshot: { passageId: string; startOffset: number; endOffset: number; offsetUnit: string }[];
  localValidationSnapshot: { quoteVerified: boolean; numericComparability: string; urlProvenanceVerified: boolean };
  resultSnapshot: { automatedVerdict: string; confidence: string; verificationState: string };
  snapshotSha256: string;
}

export interface AuditReportData {
  verificationRunId: string;
  runNumber: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
  hashChainValid: boolean;
  chainAuditDetails?: { isValid: boolean; eventCount: number; reason?: string };
  auditSnapshot: AuditSnapshotPayload | null;
  auditEvents: { sequenceNumber: number; eventType: string; payload: any; eventHash: string; createdAt: string }[];
  humanReviews: { id: string; reviewerRole: string; reviewerLabel: string; action: string; notes?: string; resultingState: string; createdAt: string }[];
}

export interface AuditInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  auditReport: AuditReportData | null;
  isLoading?: boolean;
}

export function AuditInspectorDrawer({
  isOpen,
  onClose,
  auditReport,
  isLoading = false,
}: AuditInspectorDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-drawer-title"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '520px',
        maxWidth: '90vw',
        height: '100vh',
        backgroundColor: '#ffffff',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
        zIndex: 1000,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          padding: '1.25rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
        }}
      >
        <div>
          <h2 id="audit-drawer-title" style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a' }}>
            Reproducibility & Audit Trail
          </h2>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            Run #{auditReport?.runNumber ?? 1} &bull; ID: {auditReport?.verificationRunId?.slice(0, 8)}...
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close audit drawer"
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: '1.25rem',
            cursor: 'pointer',
            padding: '0.5rem',
            color: '#64748b',
          }}
        >
          &times;
        </button>
      </div>

      <div style={{ padding: '1.25rem', flex: 1 }}>
        {isLoading && <p>Loading cryptographic audit trail...</p>}

        {!isLoading && auditReport && (
          <div>
            {/* Hash Chain Validation Status */}
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '6px',
                marginBottom: '1.25rem',
                backgroundColor: auditReport.hashChainValid ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${auditReport.hashChainValid ? '#86efac' : '#fca5a5'}`,
                color: auditReport.hashChainValid ? '#15803d' : '#b91c1c',
                fontSize: '0.8125rem',
                fontWeight: 600,
              }}
            >
              {auditReport.hashChainValid
                ? `✔ Cryptographic Event Hash Chain Verified (${auditReport.auditEvents.length} events intact)`
                : `✖ Hash Chain Integrity Broken: ${auditReport.chainAuditDetails?.reason}`}
            </div>

            {/* Document Hash & Rule Version */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Provenance Hashes
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#1e293b', marginTop: '0.375rem', wordBreak: 'break-all' }}>
                <strong>Document SHA-256:</strong>{' '}
                <code style={{ backgroundColor: '#f1f5f9', padding: '0.125rem 0.25rem', borderRadius: '3px' }}>
                  {auditReport.auditSnapshot?.documentSha256 || 'N/A'}
                </code>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#1e293b', marginTop: '0.375rem', wordBreak: 'break-all' }}>
                <strong>Snapshot SHA-256:</strong>{' '}
                <code style={{ backgroundColor: '#f1f5f9', padding: '0.125rem 0.25rem', borderRadius: '3px' }}>
                  {auditReport.auditSnapshot?.snapshotSha256 || 'N/A'}
                </code>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>
                Verdict Rule Version: {auditReport.auditSnapshot?.verdictRuleVersion}
              </div>
            </div>

            {/* Local Guardrail Validations */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Deterministic Local Guardrails
              </div>
              <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, fontSize: '0.8125rem', color: '#334155' }}>
                <li>
                  Contiguous Quote Verified:{' '}
                  <strong>{auditReport.auditSnapshot?.localValidationSnapshot.quoteVerified ? 'YES' : 'NO'}</strong>
                </li>
                <li>
                  URL Provenance Verified:{' '}
                  <strong>{auditReport.auditSnapshot?.localValidationSnapshot.urlProvenanceVerified ? 'YES' : 'NO'}</strong>
                </li>
                <li>
                  Numeric Comparability:{' '}
                  <strong>{auditReport.auditSnapshot?.localValidationSnapshot.numericComparability}</strong>
                </li>
              </ul>
            </div>

            {/* Append-Only Events Timeline */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                Append-Only Audit Log
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {auditReport.auditEvents.map((evt) => (
                  <div
                    key={evt.sequenceNumber}
                    style={{
                      padding: '0.5rem',
                      borderRadius: '4px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>
                        #{evt.sequenceNumber} {evt.eventType}
                      </span>
                      <span style={{ color: '#94a3b8' }}>{new Date(evt.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ color: '#64748b', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                      Hash: {evt.eventHash.slice(0, 16)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subsequent Human Reviews */}
            {auditReport.humanReviews.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Subsequent Human Reviews
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {auditReport.humanReviews.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '4px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        fontSize: '0.75rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#92400e' }}>
                        {rev.action} by {rev.reviewerRole} ({rev.reviewerLabel})
                      </div>
                      {rev.notes && <div style={{ marginTop: '0.25rem', color: '#78350f' }}>{rev.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
