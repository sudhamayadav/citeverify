import React, { useState, useEffect } from 'react';
import type { HealthResponse } from '@citeverify/shared';
import { Pipeline3D } from './components/Pipeline3D';
import { CitationGraph3D } from './components/CitationGraph3D';
import { RoleSwitcher } from './components/RoleSwitcher';
import { EvidenceHighlighter } from './components/EvidenceHighlighter';
import { HumanReviewPanel } from './components/HumanReviewPanel';
import { ReportExportPanel } from './components/ReportExportPanel';
import { AcademicLabPage } from './components/AcademicLabPage';
import { CollectionsPage } from './components/CollectionsPage';
import { ExtractionCorrectionUI, EditableClaim } from './components/ExtractionCorrectionUI';
import { AuditInspectorDrawer, AuditReportData } from './components/AuditInspectorDrawer';
import { SourceQualityBadges } from './components/SourceQualityBadges';

type WorkflowStep = 'UPLOAD' | 'CORRECTION' | 'VERIFYING' | 'REPORT';

interface ClaimItem {
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
  publicationType: 'JOURNAL_ARTICLE' | 'PREPRINT' | 'CONFERENCE_PROCEEDING' | 'THESIS' | 'BOOK_OR_CHAPTER' | 'UNKNOWN';
  peerReviewStatus: 'VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT' | 'NOT_ESTABLISHED' | 'UNKNOWN';
  citationMarker: string;
}

interface CitationItem {
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

const INITIAL_DEMO_CLAIMS: ClaimItem[] = [
  {
    id: 'claim-1',
    originalSentence: 'Recent advances demonstrate that multimodal models achieve 84.2% accuracy on benchmark tests across standard datasets.',
    normalizedClaim: 'Multimodal models achieve 84.2% accuracy on benchmark tests across standard datasets.',
    claimType: 'STATISTICAL',
    verdict: 'SUPPORTED',
    confidence: 'HIGH',
    sourceAccessState: 'FULL_TEXT_ACCESSIBLE',
    quoteVerified: true,
    extractedQuote: 'multimodal models achieve 84.2% accuracy on benchmark tests',
    sourceUrl: 'https://arxiv.org/abs/2301.00001',
    fullText: 'Recent advances demonstrate that multimodal models achieve 84.2% accuracy on benchmark tests across standard datasets, exceeding previous unimodal baselines by 4.8%.',
    retractionStatus: 'SEARCHED_NO_NOTICE_FOUND',
    correctionStatus: 'SEARCHED_NO_CORRECTION_FOUND',
    publicationType: 'JOURNAL_ARTICLE',
    peerReviewStatus: 'VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT',
    citationMarker: '[1]',
  },
  {
    id: 'claim-2',
    originalSentence: 'A subsequent replication study confirmed a 30% reduction in processing latency without accuracy degradation.',
    normalizedClaim: 'A subsequent replication study confirmed a 30% reduction in processing latency.',
    claimType: 'STATISTICAL',
    verdict: 'PARTLY_SUPPORTED',
    confidence: 'MEDIUM',
    sourceAccessState: 'ABSTRACT_ONLY',
    quoteVerified: false,
    extractedQuote: 'modest latency reduction observed in preliminary microbenchmarks',
    sourceUrl: 'https://example-journal.org/latency-paper',
    fullText: 'In preliminary microbenchmarks, modest latency reduction observed in preliminary microbenchmarks was approximately 12%, though extended trials were inconclusive.',
    retractionStatus: 'SEARCHED_NO_NOTICE_FOUND',
    correctionStatus: 'SEARCHED_NO_CORRECTION_FOUND',
    publicationType: 'CONFERENCE_PROCEEDING',
    peerReviewStatus: 'VERIFIED_BY_PUBLISHER_OR_VENUE_STATEMENT',
    citationMarker: '[2]',
  },
];

const INITIAL_DEMO_CITATIONS: CitationItem[] = [
  {
    id: 'ref-1',
    citationMarker: '[1]',
    title: 'Multimodal Benchmark Evaluations for High-Capacity Foundation Models',
    doi: '10.1038/s41586-023-00001-x',
    authors: ['Vaswani, A.', 'Devlin, J.'],
    publicationYear: 2023,
    url: 'https://arxiv.org/abs/2301.00001',
    resolved: true,
    resolutionState: 'MATCHED',
  },
  {
    id: 'ref-2',
    citationMarker: '[2]',
    title: 'Latency Profile Characteristics of Dense Transformer Kernels',
    doi: '10.1145/3543873.3587321',
    authors: ['Doe, J.', 'Smith, K.'],
    publicationYear: 2024,
    url: 'https://example-journal.org/latency-paper',
    resolved: true,
    resolutionState: 'MATCHED',
  },
];

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual2D, setManual2D] = useState(false);
  const [currentRole, setCurrentRole] = useState<'Researcher' | 'Faculty Reviewer'>('Researcher');

  // Workflow state
  const [activeStep, setActiveStep] = useState<WorkflowStep>('UPLOAD');
  const [documentId, setDocumentId] = useState<string>('doc-demo-1');
  const [jobId, setJobId] = useState<string>('job-demo-1');
  const [verificationProgress, setVerificationProgress] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Claims & Citations
  const [claims, setClaims] = useState<ClaimItem[]>(INITIAL_DEMO_CLAIMS);
  const [selectedClaimId, setSelectedClaimId] = useState<string>('claim-1');
  const [activeTab, setActiveTab] = useState<'claims' | 'citations' | 'lab' | 'collections'>('claims');

  // Audit Inspector Drawer
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);
  const [auditReport, setAuditReport] = useState<AuditReportData | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  const selectedClaim = claims.find((c) => c.id === selectedClaimId) || claims[0];

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate upload or call /api/documents/upload
    setActiveStep('CORRECTION');
  };

  const handleConfirmExtraction = async (corrections: any) => {
    // Stage 2 Confirmation
    setActiveStep('VERIFYING');
    setIsVerifying(true);
    setVerificationProgress(20);

    // Progress timeline simulation
    setTimeout(() => setVerificationProgress(60), 300);
    setTimeout(() => {
      setVerificationProgress(100);
      setIsVerifying(false);
      setActiveStep('REPORT');
    }, 700);
  };

  const handleOpenAudit = async () => {
    setIsAuditDrawerOpen(true);
    setIsLoadingAudit(true);
    try {
      const res = await fetch(`/api/verification-runs/${jobId}/audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditReport(data);
      } else {
        // Fallback default fixture for inspection if route returns 404
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
              { query: 'multimodal models accuracy benchmark', endpoint: '/search', timestamp: new Date().toISOString() },
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

  const handleReviewRecorded = (review: any) => {
    if (review && review.resultingState) {
      setClaims((prev) =>
        prev.map((c) =>
          c.id === selectedClaimId ? { ...c, verdict: review.resultingState } : c
        )
      );
    }
  };

  const editableClaims: EditableClaim[] = claims.map((c) => ({
    id: c.id,
    originalSentence: c.originalSentence,
    normalizedClaim: c.normalizedClaim,
    claimType: c.claimType,
    isFalsePositive: false,
    citationMarkers: [c.citationMarker],
  }));

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '1080px', margin: '0 auto', padding: '1.5rem' }}>
      {/* 1. Top-bar LOCAL-ONLY DEMO MODE banner + Role Switcher */}
      <div
        style={{
          background: '#fef3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          padding: '0.6rem 1rem',
          marginBottom: '1rem',
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#856404',
        }}
      >
        LOCAL-ONLY DEMO MODE — NOT FOR PRODUCTION USE
      </div>

      <RoleSwitcher onRoleChange={(r) => setCurrentRole(r)} />

      {/* Main Header & Workflow Steps */}
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.75rem', color: '#0f172a' }}>CiteVerify</h1>
          <p style={{ color: '#475569', margin: 0, fontSize: '0.9rem' }}>Scientific Claim and Citation Verification System</p>
        </div>

        <nav aria-label="Workflow Navigation" style={{ display: 'flex', gap: '0.5rem' }}>
          {(['UPLOAD', 'CORRECTION', 'VERIFYING', 'REPORT'] as WorkflowStep[]).map((step, idx) => (
            <button
              key={step}
              onClick={() => setActiveStep(step)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: activeStep === step ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: activeStep === step ? '#eff6ff' : '#ffffff',
                color: activeStep === step ? '#1d4ed8' : '#475569',
                fontWeight: activeStep === step ? 600 : 400,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {idx + 1}. {step}
            </button>
          ))}
        </nav>
      </header>

      {/* 2. Step 1: Upload Workspace */}
      {activeStep === 'UPLOAD' && (
        <section
          style={{
            padding: '2rem',
            border: '2px dashed #cbd5e1',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            textAlign: 'center',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>Upload Scientific Manuscript</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto 1.5rem' }}>
            Upload a PDF manuscript to extract claims, identify citations, and perform deterministic Tavily-powered evidence verification.
          </p>
          <form onSubmit={handleStartUpload}>
            <input
              type="file"
              accept=".pdf,.txt"
              style={{ display: 'inline-block', marginBottom: '1rem' }}
            />
            <div>
              <button
                type="submit"
                style={{
                  padding: '0.6rem 1.4rem',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Upload & Extract Claims
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 2. Step 2: Extraction Correction Screen */}
      {activeStep === 'CORRECTION' && (
        <section style={{ marginBottom: '2rem' }}>
          <ExtractionCorrectionUI
            documentId={documentId}
            initialClaims={editableClaims}
            unusedReferencesCount={0}
            orphanedCitationsCount={0}
            onConfirm={handleConfirmExtraction}
          />
        </section>
      )}

      {/* 2. Step 3: Live Verification Timeline */}
      {activeStep === 'VERIFYING' && (
        <section
          style={{
            padding: '2rem',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            textAlign: 'center',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>Verification Job In Progress</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Resolving references with Tavily search, extracting candidate passages, and verifying contiguous quotes...
          </p>
          <div style={{ maxWidth: '400px', margin: '1.5rem auto', background: '#e2e8f0', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${verificationProgress}%`,
                height: '100%',
                backgroundColor: '#2563eb',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ fontSize: '0.85rem', color: '#475569' }}>
            {verificationProgress}% Completed — Pipeline 3D visualization active below
          </div>
          <button
            onClick={() => setActiveStep('REPORT')}
            style={{
              marginTop: '1.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Jump to Verification Report
          </button>
        </section>
      )}

      {/* 3. Step 4: Verification Report Page */}
      {activeStep === 'REPORT' && (
        <main style={{ marginBottom: '2.5rem' }}>
          {/* Tab Bar: Claim Explorer vs Citation Explorer */}
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
              Claim Explorer ({claims.length})
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
              Citation Explorer ({INITIAL_DEMO_CITATIONS.length})
            </button>
          </div>

          {activeTab === 'claims' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', alignItems: 'start' }}>
              {/* Left Column: Claim list */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#0f172a' }}>Extracted Claims</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {claims.map((claim) => (
                    <div
                      key={claim.id}
                      onClick={() => setSelectedClaimId(claim.id)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '6px',
                        border: selectedClaimId === claim.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: selectedClaimId === claim.id ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb' }}>{claim.citationMarker}</span>
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
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#1e293b', lineHeight: 1.4 }}>
                        {claim.normalizedClaim}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Claim Details + Side-by-side Evidence Comparison + Badges + Faculty Review */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.5rem', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                      Claim &bull; Type: {selectedClaim.claimType} &bull; Marker: {selectedClaim.citationMarker}
                    </span>
                    <h3 style={{ margin: '0.25rem 0', fontSize: '1.15rem', color: '#0f172a' }}>
                      {selectedClaim.normalizedClaim}
                    </h3>
                  </div>

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
                    🔍 Inspect Audit Trail
                  </button>
                </div>

                {/* Source Quality Badges & Clickable Source URL */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <SourceQualityBadges
                    publicationType={selectedClaim.publicationType}
                    peerReviewStatus={selectedClaim.peerReviewStatus}
                    retractionStatus={selectedClaim.retractionStatus}
                    correctionStatus={selectedClaim.correctionStatus}
                  />

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

                {/* Side-by-Side Evidence Comparison Highlighter */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#334155' }}>
                    Evidence Comparison (Contiguous Quote Check)
                  </h4>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                    <EvidenceHighlighter
                      fullText={selectedClaim.fullText}
                      quote={selectedClaim.extractedQuote}
                      quoteVerified={selectedClaim.quoteVerified}
                    />
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
                    onReviewSubmitted={handleReviewRecorded}
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
                {INITIAL_DEMO_CITATIONS.map((cit) => (
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
        </main>
      )}

      {/* 2. Visualizations driving Pipeline3D & CitationGraph3D with 2D fallback */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '1rem' }}>Interactive Pipeline Visualization</h3>
        <Pipeline3D
          manual2D={manual2D}
          onToggle2D={() => setManual2D((prev) => !prev)}
        />
        <CitationGraph3D
          manual2D={manual2D}
          onToggle2D={() => setManual2D((prev) => !prev)}
        />
      </section>

      {/* Academic Lab Page (M8) */}
      <section style={{ marginBottom: '2.5rem' }}>
        <AcademicLabPage />
      </section>

      {/* Research Collections Page (M11) */}
      <section style={{ marginBottom: '2.5rem' }}>
        <CollectionsPage />
      </section>

      {/* System Health */}
      <section style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', marginTop: '2rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '0.9rem' }}>System Status</h4>
        {error && (
          <div style={{ color: 'red', padding: '0.5rem', border: '1px solid red', borderRadius: '4px', fontSize: '0.85rem' }}>
            Error: {error}
          </div>
        )}
        {health && (
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Backend: {health.status} &bull; Database: {health.database} &bull; Uptime: {health.uptime}s
          </div>
        )}
        {!health && !error && <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Loading health status...</p>}
      </section>

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

export default App;
