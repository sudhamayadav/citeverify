import { useState, useEffect } from 'react';
import type { HealthResponse } from '@citeverify/shared';
import { Pipeline3D } from './components/Pipeline3D';
import { CitationGraph3D } from './components/CitationGraph3D';

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual2D, setManual2D] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '880px', margin: '0 auto', padding: '2rem' }}>
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

      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0' }}>CiteVerify</h1>
        <p style={{ color: '#475569', margin: 0 }}>Scientific Claim and Citation Verification System</p>
      </header>

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
