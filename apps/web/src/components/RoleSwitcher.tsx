import React, { useState, useEffect } from 'react';

interface RoleSwitcherProps {
  onRoleChange?: (newRole: 'Researcher' | 'Faculty Reviewer') => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ onRoleChange }) => {
  const [currentRole, setCurrentRole] = useState<'Researcher' | 'Faculty Reviewer'>('Researcher');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/demo/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.role) setCurrentRole(data.role);
      })
      .catch(() => {});
  }, []);

  const handleRoleChange = async (role: 'Researcher' | 'Faculty Reviewer') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/demo/session/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to switch role');
      }
      setCurrentRole(role);
      if (onRoleChange) onRoleChange(role);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        background: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '6px',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      <div>
        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e293b' }}>
          Current Role: <span style={{ color: currentRole === 'Faculty Reviewer' ? '#7c3aed' : '#2563eb' }}>{currentRole}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
          ⚠️ Local demo mode only. Does not provide real identity verification or secure access control.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          disabled={loading || currentRole === 'Researcher'}
          onClick={() => handleRoleChange('Researcher')}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '4px',
            border: '1px solid #94a3b8',
            background: currentRole === 'Researcher' ? '#2563eb' : '#ffffff',
            color: currentRole === 'Researcher' ? '#ffffff' : '#1e293b',
            cursor: currentRole === 'Researcher' ? 'default' : 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          Researcher
        </button>
        <button
          type="button"
          disabled={loading || currentRole === 'Faculty Reviewer'}
          onClick={() => handleRoleChange('Faculty Reviewer')}
          style={{
            padding: '0.35rem 0.75rem',
            borderRadius: '4px',
            border: '1px solid #94a3b8',
            background: currentRole === 'Faculty Reviewer' ? '#7c3aed' : '#ffffff',
            color: currentRole === 'Faculty Reviewer' ? '#ffffff' : '#1e293b',
            cursor: currentRole === 'Faculty Reviewer' ? 'default' : 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          Faculty Reviewer
        </button>
      </div>
      {error && <div style={{ color: '#dc2626', fontSize: '0.75rem', width: '100%' }}>{error}</div>}
    </div>
  );
};
