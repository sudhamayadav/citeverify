import React, { useState } from 'react';

interface ReportExportPanelProps {
  jobId: string;
}

export const ReportExportPanel: React.FC<ReportExportPanelProps> = ({ jobId }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (format: 'json' | 'markdown') => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/verification-jobs/${jobId}/report?format=${format}`);
      if (!res.ok) {
        throw new Error('Failed to generate report');
      }

      if (format === 'json') {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `citeverify-report-${jobId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `citeverify-report-${jobId}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        background: '#f8fafc',
        marginTop: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}
    >
      <div>
        <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#0f172a' }}>
          Verification Report Export
        </div>
        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Export sanitized provenance data, evidence quotes, and reviewer logs (no private file paths or secrets).
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={downloading}
          onClick={() => handleDownload('json')}
          style={{
            padding: '0.4rem 0.8rem',
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.85rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Export JSON
        </button>
        <button
          type="button"
          disabled={downloading}
          onClick={() => handleDownload('markdown')}
          style={{
            padding: '0.4rem 0.8rem',
            background: '#0f766e',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.85rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Export Markdown
        </button>
      </div>
    </div>
  );
};
