import React, { useState, useEffect } from 'react';
import type { HealthResponse } from '@citeverify/shared';
import { Pipeline3D } from './components/Pipeline3D';
import { CitationGraph3D } from './components/CitationGraph3D';
import { RoleSwitcher } from './components/RoleSwitcher';
import { AcademicLabPage } from './components/AcademicLabPage';
import { CollectionsPage } from './components/CollectionsPage';
import { ExtractionCorrectionUI, EditableClaim } from './components/ExtractionCorrectionUI';
import { ReportPage, ClaimReportItem, CitationReportItem } from './components/ReportPage';

type WorkflowStep = 'UPLOAD' | 'CORRECTION' | 'VERIFYING' | 'REPORT';

const INITIAL_DEMO_CLAIMS: ClaimReportItem[] = [
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
    plagiarismStatus: 'VERBATIM_UNQUOTED_OVERLAP',
    overlapPercentage: 86.4,
    matchedSpan: 'multimodal models achieve 84.2% accuracy on benchmark tests across standard datasets',
    plagiarismSourceUrl: 'https://arxiv.org/abs/2301.00001',
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
    plagiarismStatus: 'NO_SIGNIFICANT_OVERLAP',
    overlapPercentage: 18.2,
    matchedSpan: null,
    plagiarismSourceUrl: null,
  },
];

const INITIAL_DEMO_CITATIONS: CitationReportItem[] = [
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

  // Claims
  const [claims, setClaims] = useState<ClaimReportItem[]>(INITIAL_DEMO_CLAIMS);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setActiveStep('CORRECTION');
  };

  const handleConfirmExtraction = async (corrections: any) => {
    setActiveStep('VERIFYING');
    setIsVerifying(true);
    setVerificationProgress(20);

    setTimeout(() => setVerificationProgress(60), 300);
    setTimeout(() => {
      setVerificationProgress(100);
      setIsVerifying(false);
      setActiveStep('REPORT');
    }, 700);
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

      {/* 3. Step 4: Verification Report Page with Integrated Text-Overlap / Plagiarism Check */}
      {activeStep === 'REPORT' && (
        <main style={{ marginBottom: '2.5rem' }}>
          <ReportPage
            jobId={jobId}
            claims={claims}
            citations={INITIAL_DEMO_CITATIONS}
            currentRole={currentRole}
            onReviewRecorded={(review) => {
              if (review?.resultingState) {
                setClaims((prev) =>
                  prev.map((c) =>
                    c.id === review.claimId ? { ...c, verdict: review.resultingState } : c
                  )
                );
              }
            }}
          />
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
    </div>
  );
}

export default App;
