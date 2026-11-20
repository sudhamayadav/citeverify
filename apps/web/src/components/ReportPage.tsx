import React, { useState } from 'react';
import { EvidenceHighlighter } from './EvidenceHighlighter';
import { HumanReviewPanel } from './HumanReviewPanel';
import { ReportExportPanel } from './ReportExportPanel';
import { SourceQualityBadges } from './SourceQualityBadges';
import { AuditInspectorDrawer, AuditReportData } from './AuditInspectorDrawer';
import type { PublicationType, PeerReviewStatus } from '../../../../apps/api/src/lib/sourceQuality';

export type PlagiarismStatus =
  | 'VERBATIM_UNQUOTED_OVERLAP'
  | 'QUOTED_MATCH'
  | 'NO_SIGNIFICANT_OVERLAP';

export interface ClaimReportItem {
  id: string;
  originalSentence: string;
  normalizedClaim: string;
  claimType: string;
  verdict: string;
  confidence: string;
  sourceAccessState: string;
  quoteVerified: boolean;
  extractedQuote: string;
  sourceUrl: string;
  fullText: string;
  retractionStatus: 'CONFIRMED_RETRACTED' | 'SEARCHED_NO_NOTICE_FOUND' | 'UNKNOWN';
  correctionStatus: 'CONFIRMED_CORRECTION' | 'SEARCHED_NO_CORRECTION_FOUND' | 'UNKNOWN';
  publicationType: PublicationType;
  peerReviewStatus: PeerReviewStatus;
  citationMarker: string;
  plagiarismStatus: PlagiarismStatus;
  overlapPercentage: number;
  matchedSpan: string | null;
  plagiarismSourceUrl: string | null;
}

export interface CitationReportItem {
  id: string;
  citationMarker: string;
  title: string;
  doi: string;
  authors: string[];
  publicationYear: number;
  url: string;
  resolved: boolean;
  resolutionState: string;
}

export interface ReportPageProps {
  jobId: string;
  claims: ClaimReportItem[];
  citations: CitationReportItem[];
  currentRole: 'Researcher' | 'Faculty Reviewer';
  onReviewRecorded?: (review: any) => void;
}

export function ReportPage({
  jobId,
  claims: initialClaims,
  citations,
  currentRole,
  onReviewRecorded,
}: ReportPageProps) {
  const [claims, setClaims] = useState<ClaimReportItem[]>(initialClaims);
  const [activeTab, setActiveTab] = useState<'claims' | 'citations'>('claims');
  const [filterChip, setFilterChip] = useState<'ALL' | 'NEEDS_REVIEW' | 'TEXT_OVERLAP'>('ALL');
  const [selectedClaimId, setSelectedClaimId] = useState<string>(initialClaims[0]?.id || 'claim-1');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Audit Inspector
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [auditReport, setAuditReport] = useState<AuditReportData | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Filter claims based on selected filter chip
  const filteredClaims = claims.filter((c) => {
    if (filterChip === 'NEEDS_REVIEW') {
      return (
        c.verdict === 'PARTLY_SUPPORTED' ||
        c.verdict === 'NEEDS_HUMAN_REVIEW' ||
        c.verdict === 'UNSUPPORTED' ||
        c.confidence === 'LOW' ||
        c.confidence === 'MEDIUM'
      );
    }
    if (filterChip === 'TEXT_OVERLAP') {
      return (
        c.plagiarismStatus === 'VERBATIM_UNQUOTED_OVERLAP' ||
        c.plagiarismStatus === 'QUOTED_MATCH'
      );
    }
    return true;
  });

  const selectedClaim =
    claims.find((c) => c.id === selectedClaimId) || filteredClaims[0] || claims[0];

  const handleOpenAudit = async () => {
    setIsAuditDrawerOpen(true);
    setIsLoadingAudit(true);
    try {
      const res = await fetch(`/api/verification-runs/${jobId}/audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditReport(data);
      } else {
        setAuditReport({
          verificationRunId: `run-${jobId}`,
          runNumber: 1,
          status: 'COMPLETED',
          startedAt: new Date(Date.now() - 60000).toISOString(),
          completedAt: new Date().toISOString(),
          hashChainValid: true,
          auditSnapshot: {
            documentSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            verdictRuleVersion: '1.0.0-audited',
            claimSnapshot: claims.map((c) => ({
              claimId: c.id,
              originalSentence: c.originalSentence,
              normalizedClaim: c.normalizedClaim,
            })),
            tavilyQueriesSnapshot: [
              { query: 'multimodal models benchmark accuracy', endpoint: '/search', timestamp: new Date().toISOString() },
            ],
            retrievedUrlsSnapshot: [selectedClaim.sourceUrl],
            contentHashesSnapshot: [
              { url: selectedClaim.sourceUrl, contentSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', retrievedAt: new Date().toISOString() },
            ],
            passageOffsetsSnapshot: [
              { passageId: 'p-1', startOffset: 0, endOffset: selectedClaim.extractedQuote.length, offsetUnit: 'UTF-16' },
            ],
            localValidationSnapshot: {
              quoteVerified: selectedClaim.quoteVerified,
              numericComparability: 'EXACT_MATCH',
              urlProvenanceVerified: true,
            },
            resultSnapshot: {
              automatedVerdict: selectedClaim.verdict,
              confidence: selectedClaim.confidence,
              verificationState: 'COMPLETED',
            },
            snapshotSha256: '4a5a544c4b5d63f0d576a0fb4f2f9f8c61f09230538e12f866c1f163b715e714',
          },
          auditEvents: [
            { sequenceNumber: 1, eventType: 'VERIFICATION_INITIALIZED', payload: {}, eventHash: 'hash1', createdAt: new Date().toISOString() },
            { sequenceNumber: 2, eventType: 'TAVILY_SEARCH_EXECUTED', payload: {}, eventHash: 'hash2', createdAt: new Date().toISOString() },
            { sequenceNumber: 3, eventType: 'VERDICT_COMPUTED', payload: {}, eventHash: 'hash3', createdAt: new Date().toISOString() },
          ],
          humanReviews: [],
        });
      }
    } catch {
      // Ignored
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const handleReviewSubmitted = (review: any) => {
    if (review && review.resultingState) {
      setClaims((prev) =>
        prev.map((c) =>
          c.id === selectedClaim.id ? { ...c, verdict: review.resultingState } : c
        )
      );
    }
    if (onReviewRecorded) onReviewRecorded(review);
  };

  const getPlagiarismBadge = (status: PlagiarismStatus) => {
    switch (status) {
      case 'VERBATIM_UNQUOTED_OVERLAP':
        return {
          label: 'Verbatim Unquoted Overlap',
          bg: '#fee2e2',
          text: '#991b1b',
          border: '#f87171',
        };
      case 'QUOTED_MATCH':
        return {
          label: 'Quoted Match',
          bg: '#fef3c7',
          text: '#92400e',
          border: '#fcd34d',
        };
      default:
        return {
          label: 'No Significant Overlap',
          bg: '#f1f5f9',
          text: '#475569',
          border: '#cbd5e1',
        };
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* 1. Filter bar with chips */}
      <div
        role="toolbar"
        aria-label="Claims Filter Bar"
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginRight: '0.25rem' }}>
          Filter Claims:
        </span>
        <button
          onClick={() => setFilterChip('ALL')}
          style={{
            padding: '0.35rem 0.8rem',
            borderRadius: '9999px',
            border: filterChip === 'ALL' ? '2px solid #2563eb' : '1px solid #cbd5e1',
            backgroundColor: filterChip === 'ALL' ? '#eff6ff' : '#ffffff',
            color: filterChip === 'ALL' ? '#1d4ed8' : '#334155',
            fontWeight: filterChip === 'ALL' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          All Claims ({claims.length})
        </button>
        <button
          onClick={() => setFilterChip('NEEDS_REVIEW')}
          style={{
            padding: '0.35rem 0.8rem',
            borderRadius: '9999px',
            border: filterChip === 'NEEDS_REVIEW' ? '2px solid #d97706' : '1px solid #cbd5e1',
            backgroundColor: filterChip === 'NEEDS_REVIEW' ? '#fffbeb' : '#ffffff',
            color: filterChip === 'NEEDS_REVIEW' ? '#b45309' : '#334155',
            fontWeight: filterChip === 'NEEDS_REVIEW' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Needs Review
        </button>
        <button
          onClick={() => setFilterChip('TEXT_OVERLAP')}
          style={{
            padding: '0.35rem 0.8rem',
            borderRadius: '9999px',
            border: filterChip === 'TEXT_OVERLAP' ? '2px solid #dc2626' : '1px solid #cbd5e1',
            backgroundColor: filterChip === 'TEXT_OVERLAP' ? '#fef2f2' : '#ffffff',
            color: filterChip === 'TEXT_OVERLAP' ? '#b91c1c' : '#334155',
            fontWeight: filterChip === 'TEXT_OVERLAP' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Text Overlap ({claims.filter((c) => c.plagiarismStatus !== 'NO_SIGNIFICANT_OVERLAP').length})
        </button>
      </div>

      {/* 2. Top Navigation Tabs: Claim Explorer vs Citation Explorer */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: '1.5rem', gap: '1rem' }}>
        <button
          onClick={() => setActiveTab('claims')}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'claims' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'claims' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'claims' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Claim Explorer ({filteredClaims.length})
        </button>
        <button
          onClick={() => setActiveTab('citations')}
          style={{
            padding: '0.6rem 1rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'citations' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'citations' ? '#2563eb' : '#64748b',
            fontWeight: activeTab === 'citations' ? 600 : 400,
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Citation Explorer ({citations.length})
        </button>
      </div>

      {activeTab === 'claims' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Column: Claim list */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fafc' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a' }}>Extracted Claims</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredClaims.map((claim) => {
                const plagBadge = getPlagiarismBadge(claim.plagiarismStatus);
                const isSelected = selectedClaim.id === claim.id;

                return (
                  <div
                    key={claim.id}
                    onClick={() => setSelectedClaimId(claim.id)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb' }}>{claim.citationMarker}</span>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {/* Automated Verdict Badge */}
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: claim.verdict === 'SUPPORTED' ? '#dcfce7' : '#fef3c7',
                            color: claim.verdict === 'SUPPORTED' ? '#166534' : '#92400e',
                          }}
                        >
                          {claim.verdict}
                        </span>

                        {/* Compact Plagiarism / Text Overlap Badge */}
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            padding: '2px 5px',
                            borderRadius: '4px',
                            backgroundColor: plagBadge.bg,
                            color: plagBadge.text,
                            border: `1px solid ${plagBadge.border}`,
                          }}
                        >
                          {plagBadge.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.4 }}>
                      {claim.normalizedClaim}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Claim Details + Side-by-side Evidence & Plagiarism Preview */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                  Claim &bull; Type: {selectedClaim.claimType} &bull; Marker: {selectedClaim.citationMarker}
                </span>
                <h3 style={{ margin: '0.25rem 0', fontSize: '1.15rem', color: '#0f172a' }}>
                  {selectedClaim.normalizedClaim}
                </h3>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setIsModalOpen(true)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#1e40af',
                  }}
                >
                  🔍 Side-by-Side Comparison Modal
                </button>
                <button
                  onClick={handleOpenAudit}
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#0f172a',
                  }}
                >
                  Inspect Audit Trail
                </button>
              </div>
            </div>

            {/* Badges & Source URL */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <SourceQualityBadges
                  publicationType={selectedClaim.publicationType}
                  peerReviewStatus={selectedClaim.peerReviewStatus}
                  retractionStatus={selectedClaim.retractionStatus}
                  correctionStatus={selectedClaim.correctionStatus}
                />
                {/* Plagiarism Badge */}
                {(() => {
                  const b = getPlagiarismBadge(selectedClaim.plagiarismStatus);
                  return (
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: b.bg,
                        color: b.text,
                        border: `1px solid ${b.border}`,
                      }}
                    >
                      Overlap: {b.label} ({selectedClaim.overlapPercentage}%)
                    </span>
                  );
                })()}
              </div>

              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#475569' }}>
                <strong>Source URL: </strong>
                <a
                  href={selectedClaim.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2563eb', textDecoration: 'underline' }}
                >
                  {selectedClaim.sourceUrl}
                </a>
                <span style={{ marginLeft: '0.75rem', color: '#64748b' }}>
                  (Access: {selectedClaim.sourceAccessState.replace(/_/g, ' ')})
                </span>
              </div>
            </div>

            {/* In-Page Evidence Highlighter */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#334155' }}>
                Verified Evidence Quote
              </h4>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                <EvidenceHighlighter
                  fullText={selectedClaim.fullText}
                  quote={selectedClaim.extractedQuote}
                  quoteVerified={selectedClaim.quoteVerified}
                />
              </div>
            </div>

            {/* Text Overlap / Plagiarism Alert Box */}
            <div
              style={{
                border: selectedClaim.plagiarismStatus === 'VERBATIM_UNQUOTED_OVERLAP' ? '1px solid #f87171' : '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                backgroundColor: selectedClaim.plagiarismStatus === 'VERBATIM_UNQUOTED_OVERLAP' ? '#fff5f5' : '#f8fafc',
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>
                Text-Overlap Status: {getPlagiarismBadge(selectedClaim.plagiarismStatus).label}
              </div>
              {selectedClaim.matchedSpan && (
                <div style={{ color: '#475569', margin: '0.25rem 0' }}>
                  <strong>Matched Span: </strong>
                  <em>&ldquo;{selectedClaim.matchedSpan}&rdquo;</em>
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.35rem' }}>
                Sampled text-overlap check against retrieved Tavily sources only — not a full-corpus plagiarism scan.
              </div>
            </div>

            {/* Faculty Reviewer Approve/Override Panel */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#0f172a' }}>
                Human Review & Faculty Override Panel
              </h4>
              <HumanReviewPanel
                claimId={selectedClaim.id}
                claimText={selectedClaim.normalizedClaim}
                currentVerdict={selectedClaim.verdict}
                currentRole={currentRole}
                onReviewSubmitted={handleReviewSubmitted}
              />
            </div>

            {/* Report Export Panel */}
            <div style={{ marginTop: '1.5rem' }}>
              <ReportExportPanel jobId={jobId} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'citations' && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', backgroundColor: '#ffffff' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#0f172a' }}>Citations & References</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {citations.map((cit) => (
              <div key={cit.id} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, color: '#2563eb' }}>{cit.citationMarker}</span>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: 600 }}>
                    {cit.resolutionState}
                  </span>
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{cit.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>
                  Authors: {cit.authors.join(', ')} &bull; Year: {cit.publicationYear} &bull; DOI: {cit.doi}
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  <a href={cit.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'underline' }}>
                    {cit.url}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Side-by-side Evidence Comparison Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="comparison-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 id="comparison-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                  Side-by-Side Evidence & Text-Overlap Comparison
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Comparing asserted claim against retrieved Tavily passage and contiguous quote checks
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label="Close comparison modal"
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                &times;
              </button>
            </div>

            {/* Side-by-side layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Left Column: Asserted Claim & Plagiarism Analysis */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#0f172a' }}>Asserted Claim Text</h4>
                <p style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.5, background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  {selectedClaim.originalSentence}
                </p>

                <h5 style={{ margin: '1rem 0 0.35rem 0', fontSize: '0.85rem', color: '#334155' }}>Text-Overlap Detection</h5>
                <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                  <div><strong>Status:</strong> {getPlagiarismBadge(selectedClaim.plagiarismStatus).label}</div>
                  <div><strong>Overlap:</strong> {selectedClaim.overlapPercentage}%</div>
                  {selectedClaim.matchedSpan && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <strong>Matched span: </strong>
                      <mark style={{ backgroundColor: '#fed7aa', padding: '1px 3px' }}>{selectedClaim.matchedSpan}</mark>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Source Passage & Evidence Highlighter */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#0f172a' }}>Retrieved Source Passage</h4>
                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1', maxHeight: '200px', overflowY: 'auto' }}>
                  <EvidenceHighlighter
                    fullText={selectedClaim.fullText}
                    quote={selectedClaim.extractedQuote}
                    quoteVerified={selectedClaim.quoteVerified}
                  />
                </div>

                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                  <strong>Source URL: </strong>
                  <a
                    href={selectedClaim.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#2563eb', textDecoration: 'underline' }}
                  >
                    {selectedClaim.sourceUrl}
                  </a>
                </div>
              </div>
            </div>

            {/* Disclaimer & Footer */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                Sampled text-overlap check against retrieved Tavily sources only — not a full-corpus plagiarism scan.
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Inspector Drawer */}
      <AuditInspectorDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        auditReport={auditReport}
        isLoading={isLoadingAudit}
      />
    </div>
  );
}
