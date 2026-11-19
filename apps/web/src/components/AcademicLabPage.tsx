import React, { useState, useEffect } from 'react';

export const AcademicLabPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'capture' | 'validation' | 'benchmark' | 'find-citations'>('capture');
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [valMode, setValMode] = useState<'SIMULATION' | 'LAB' | 'FIELD'>('SIMULATION');
  const [attemptResult, setAttemptResult] = useState<any | null>(null);
  const [metricsData, setMetricsData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Tab 4 Find Citations state
  const [searchClaim, setSearchClaim] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/lab/cases')
      .then((res) => res.json())
      .then((data) => {
        if (data.cases && data.cases.length > 0) {
          setCases(data.cases);
          setSelectedCase(data.cases[0]);
        }
      })
      .catch(() => {});

    fetch('/api/lab/metrics')
      .then((res) => res.json())
      .then((data) => setMetricsData(data))
      .catch(() => {});
  }, []);

  const handleRunValidation = async () => {
    if (!selectedCase) return;
    setLoading(true);
    setAttemptResult(null);
    try {
      const res = await fetch('/api/lab/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCase.id,
          mode: valMode,
        }),
      });
      const data = await res.json();
      setAttemptResult(data);
    } catch (err: any) {
      alert(`Validation error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFindCitations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchClaim) return;
    setLoading(true);
    try {
      const res = await fetch('/api/lab/find-citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimText: searchClaim }),
      });
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (err: any) {
      alert(`Search error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#0f172a' }}>Academic Lab & Benchmark Suite</h2>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Experimental testbench for evidence capture, modular validation, and gold standard benchmarking.
          </div>
        </div>
        <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
          LAB SUITE (M8)
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem' }}>
        {[
          { key: 'capture', label: '1. Capture Relevant Evidence' },
          { key: 'validation', label: '2. Validation Environment' },
          { key: 'benchmark', label: '3. Comparator / Benchmark' },
          { key: 'find-citations', label: '4. Find Citation(s)' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === tab.key ? '#2563eb' : '#64748b',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Capture Relevant Evidence */}
      {activeTab === 'capture' && (
        <div style={{ padding: '0.5rem 0' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Module 1 & 2: Scientific Claims & Evidence Retrieval</h3>
          {selectedCase && (
            <div style={{ background: '#ffffff', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <div style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', fontSize: '0.75rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                {selectedCase.isSynthetic ? 'SYNTHETIC DEMO FIXTURE' : 'REAL CASE'}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{selectedCase.name}</div>
              <div style={{ color: '#475569', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{selectedCase.description}</div>
              <div style={{ background: '#f1f5f9', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <strong>Asserted Claim:</strong> "{selectedCase.claimText}"
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                <strong>Expected Teaching Outcome:</strong> <code style={{ color: '#b45309' }}>{selectedCase.expectedVerdict}</code> (NEEDS_HUMAN_REVIEW)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Validation Environment */}
      {activeTab === 'validation' && (
        <div style={{ padding: '0.5rem 0' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Modules 3–8: Modular Verification Pipeline</h3>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Validation Mode:</span>
            {(['SIMULATION', 'LAB', 'FIELD'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setValMode(m)}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: valMode === m ? '#2563eb' : '#ffffff',
                  color: valMode === m ? '#ffffff' : '#1e293b',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {m}
              </button>
            ))}
            <button
              onClick={handleRunValidation}
              disabled={loading}
              style={{
                marginLeft: 'auto',
                padding: '0.4rem 1rem',
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Evaluating...' : 'Run Validation'}
            </button>
          </div>

          {attemptResult && (
            <div style={{ background: '#ffffff', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Validation Result ({attemptResult.mode} Mode — Latency: {attemptResult.latencyMs}ms)
              </div>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Support Verdict: <strong style={{ color: '#d97706' }}>{attemptResult.result?.supportVerdict}</strong>
              </div>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Verification State: <code>{attemptResult.result?.verificationState}</code>
              </div>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Quote Verified: {attemptResult.result?.quoteVerified ? '✓ Yes (Contiguous span)' : '✗ Failed'}
              </div>
              {attemptResult.fieldTelemetry && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '4px', fontSize: '0.75rem', color: '#475569' }}>
                  Field Telemetry: {JSON.stringify(attemptResult.fieldTelemetry)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Comparator / Benchmark */}
      {activeTab === 'benchmark' && (
        <div style={{ padding: '0.5rem 0' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Benchmark Metrics & Gold Comparator</h3>
          {metricsData?.status === 'NOT_ENOUGH_LABELLED_DATA' ? (
            <div style={{ padding: '1.5rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', color: '#b45309', marginBottom: '0.5rem', fontSize: '1rem' }}>
                NOT ENOUGH LABELLED DATA
              </div>
              <div style={{ fontSize: '0.85rem', color: '#78350f', maxWidth: '540px', margin: '0 auto' }}>
                {metricsData.message}
              </div>
            </div>
          ) : (
            <div style={{ background: '#fff', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <div>Accuracy: {(metricsData?.metrics?.accuracy * 100).toFixed(1)}%</div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Find Citation(s) */}
      {activeTab === 'find-citations' && (
        <div style={{ padding: '0.5rem 0' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Reverse Citation Discovery</h3>
          <form onSubmit={handleFindCitations} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              value={searchClaim}
              onChange={(e) => setSearchClaim(e.target.value)}
              placeholder="Enter an uncited scientific claim to search candidate literature..."
              style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '0.4rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {loading ? 'Searching...' : 'Find Candidates'}
            </button>
          </form>

          {candidates.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {candidates.map((c, i) => (
                <div key={i} style={{ background: '#ffffff', padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                  <div style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {c.label}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.title}</div>
                  <div style={{ color: '#2563eb', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{c.url}</div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>{c.snippet}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
