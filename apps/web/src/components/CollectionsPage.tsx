import React, { useState, useEffect } from 'react';

export const CollectionsPage: React.FC = () => {
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<any | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [diffData, setDiffData] = useState<any | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [loading, setLoading] = useState(false);
  const [rechecking, setRechecking] = useState(false);

  const fetchCollections = () => {
    fetch('/api/collections')
      .then((res) => res.json())
      .then((data) => {
        if (data.collections) {
          setCollections(data.collections);
          if (data.collections.length > 0 && !selectedCollection) {
            setSelectedCollection(data.collections[0]);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });
      if (res.ok) {
        setNewCollectionName('');
        fetchCollections();
      }
    } catch (err: any) {
      alert(`Error creating collection: ${err.message}`);
    }
  };

  const handleRecheck = async (itemId: string) => {
    if (!selectedCollection) return;
    setRechecking(true);
    try {
      const res = await fetch(`/api/collections/${selectedCollection.id}/items/${itemId}/recheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Recheck completed! Run #${data.runNumber} created.`);
        fetchCollections();
        handleViewDiff(itemId);
      } else {
        alert(`Recheck error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Recheck error: ${err.message}`);
    } finally {
      setRechecking(false);
    }
  };

  const handleViewDiff = async (itemId: string) => {
    if (!selectedCollection) return;
    setLoading(true);
    setDiffData(null);
    try {
      const res = await fetch(`/api/collections/${selectedCollection.id}/items/${itemId}/diff`);
      const data = await res.json();
      setDiffData(data);
    } catch (err: any) {
      alert(`Diff error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#0f172a' }}>Research Collections & Rechecking</h2>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Track collections of verified publications, monitor retraction notices, and inspect run-to-run differences.
          </div>
        </div>
        <div style={{ background: '#ede9fe', color: '#6d28d9', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
          COLLECTIONS (M11)
        </div>
      </div>

      {/* Scheduler Honesty Notice */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#1e40af' }}>
        <strong>Scheduler Notice:</strong> Manual recheck active. Automated background monitoring requires an external cron/scheduler triggering the protected <code>POST /api/collections/run-due-checks</code> endpoint with <code>CRON_SECRET</code>. No unconfigured background timers run on the server.
      </div>

      {/* Create Collection Form */}
      <form onSubmit={handleCreateCollection} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          placeholder="New collection title (e.g., 'STEM Active Learning Papers')..."
          style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
        />
        <button
          type="submit"
          style={{ padding: '0.4rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
        >
          Create Collection
        </button>
      </form>

      {/* Main Grid: Collections and Items */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1rem' }}>
        {/* Collections List */}
        <div style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            My Collections ({collections.length})
          </div>
          {collections.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No collections yet. Create one above.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {collections.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCollection(c); setDiffData(null); }}
                  style={{
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: selectedCollection?.id === c.id ? '#dbeafe' : 'transparent',
                    color: selectedCollection?.id === c.id ? '#1d4ed8' : '#334155',
                    fontWeight: selectedCollection?.id === c.id ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {c.name} ({c.items?.length || 0})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Collection Items & Actions */}
        <div style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '1rem' }}>
          {selectedCollection ? (
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>{selectedCollection.name}</h3>
              {selectedCollection.items?.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>No references saved to this collection yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedCollection.items.map((item: any) => (
                    <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem', background: '#f8fafc' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                        {item.reference.title || item.reference.rawReferenceText}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                        DOI: {item.reference.doi || 'N/A'} | Retraction Status: <strong>{item.reference.retractionStatus}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          disabled={rechecking}
                          onClick={() => handleRecheck(item.id)}
                          style={{
                            padding: '0.3rem 0.75rem',
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {rechecking ? 'Rechecking...' : 'Recheck Now'}
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleViewDiff(item.id)}
                          style={{
                            padding: '0.3rem 0.75rem',
                            background: '#475569',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                          }}
                        >
                          View Run Diff
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Select or create a collection.</div>
          )}

          {/* Run-to-Run Diff Panel */}
          {diffData && (
            <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e2e8f0', paddingTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#0f172a' }}>
                Run-to-Run Difference Inspection
              </h4>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
                Comparing Run #{diffData.comparedRuns?.previousRun?.runNumber || 1} vs Latest Run #{diffData.comparedRuns?.latestRun?.runNumber || 2}
              </div>

              {/* Retraction & Health Changes */}
              <div style={{ background: '#f1f5f9', padding: '0.75rem', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <div>Retraction Status: <code>{diffData.healthDiff?.retractionStatus?.previous}</code> &rarr; <strong>{diffData.healthDiff?.retractionStatus?.latest}</strong> {diffData.healthDiff?.retractionStatus?.changed ? '⚠️ (Changed)' : '(Unchanged)'}</div>
              </div>

              {/* Sampled Contexts Diff */}
              {diffData.forwardCitationDiff?.missingFromLatestSample?.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', color: '#92400e' }}>
                  <strong>Sample Differences (Absence from later sample):</strong>
                  {diffData.forwardCitationDiff.missingFromLatestSample.map((m: any, idx: number) => (
                    <div key={idx} style={{ marginTop: '0.25rem' }}>
                      &bull; <em>{m.citingTitle}</em>: <span style={{ fontWeight: 600 }}>{m.diffStatus}</span> ({m.explanation})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
