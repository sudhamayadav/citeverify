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

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual2D, setManual2D] = useState(false);
  const [currentRole, setCurrentRole] = useState<'Researcher' | 'Faculty Reviewer'>('Researcher');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
      {/* LOCAL-ONLY DEMO MODE banner */}
      <div
        style={{
          background: '#fef3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          padding: '0.5rem 1rem',
          marginBottom: '1.5rem',
          fontWeight: 'bold',
          textAlign: 'center',
        }}
      >
        LOCAL-ONLY DEMO MODE — NOT FOR PRODUCTION USE
      </div>

      {/* Role Switcher */}
      <RoleSwitcher onRoleChange={(r) => setCurrentRole(r)} />

      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0' }}>CiteVerify</h1>
        <p style={{ color: '#475569', margin: 0 }}>Scientific Claim and Citation Verification System</p>
      </header>

      {/* Evidence Highlighter Demo / Explorer Section */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <h2>Evidence Inspection</h2>
        <EvidenceHighlighter
          fullText="Recent advances demonstrate that multimodal models achieve 84.2% accuracy on benchmark tests across standard datasets."
          quote="multimodal models achieve 84.2% accuracy on benchmark tests"
          quoteVerified={true}
        />
        <HumanReviewPanel
          claimId="sample-claim-1"
          claimText="Multimodal models achieve 84.2% accuracy on benchmark tests"
          currentVerdict="SUPPORTED"
          currentRole={currentRole}
        />
        <ReportExportPanel jobId="sample-job-1" />
      </section>

      {/* Academic Lab (M8) */}
      <section style={{ marginBottom: '2.5rem' }}>
        <AcademicLabPage />
      </section>

      {/* Research Collections (M11) */}
      <section style={{ marginBottom: '2.5rem' }}>
        <CollectionsPage />
      </section>

      {/* 3D Visualizations with 2D fallback */}
      <section style={{ marginBottom: '2.5rem' }}>
        <Pipeline3D
          manual2D={manual2D}
          onToggle2D={() => setManual2D((prev) => !prev)}
        />
        <CitationGraph3D
          manual2D={manual2D}
          onToggle2D={() => setManual2D((prev) => !prev)}
        />
      </section>

      <section>
        <h2>System Health</h2>
        {error && (
          <div style={{ color: 'red', padding: '0.5rem', border: '1px solid red', borderRadius: '4px' }}>
            Error: {error}
          </div>
        )}
        {health && (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {Object.entries(health).map(([key, value]) => (
                <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{key}</td>
                  <td style={{ padding: '0.5rem' }}>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!health && !error && <p>Loading health status...</p>}
      </section>
    </div>
  );
}

export default App;
