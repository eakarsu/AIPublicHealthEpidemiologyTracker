import { useEffect, useState } from 'react';

const blank = { disease_name: '', case_definition: '', alert_threshold: 10, window_days: 7, severity: 'Medium', active: true };

export default function SurveillanceRulesEditor() {
  const [rules, setRules] = useState([]);
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const auth = { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/custom-views/rules', { headers: auth });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      setRules(j.data || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setErr('');
    try {
      const url = editingId ? `/api/custom-views/rules/${editingId}` : '/api/custom-views/rules';
      const method = editingId ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: auth, body: JSON.stringify(draft) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Save failed');
      setDraft(blank); setEditingId(null); load();
    } catch (e) { setErr(e.message); }
  };

  const edit = (rule) => { setDraft({ ...rule }); setEditingId(rule.id); };

  const del = async (id) => {
    if (!confirm('Delete rule?')) return;
    try {
      const r = await fetch(`/api/custom-views/rules/${id}`, { method: 'DELETE', headers: auth });
      if (!r.ok) throw new Error('Delete failed');
      load();
    } catch (e) { setErr(e.message); }
  };

  const cancel = () => { setDraft(blank); setEditingId(null); };

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h3 style={{ margin: '0 0 12px', color: '#0a1f44' }}>Surveillance Rules Editor</h3>
      {err && <div style={{ color: '#c53030', marginBottom: 8 }}>{err}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <input data-testid="cv-rule-disease" placeholder="Disease name" value={draft.disease_name}
          onChange={e => setDraft({ ...draft, disease_name: e.target.value })}
          style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
        <input type="number" placeholder="Threshold" value={draft.alert_threshold}
          onChange={e => setDraft({ ...draft, alert_threshold: parseInt(e.target.value) || 0 })}
          style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
        <input type="number" placeholder="Window days" value={draft.window_days}
          onChange={e => setDraft({ ...draft, window_days: parseInt(e.target.value) || 0 })}
          style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
        <select value={draft.severity} onChange={e => setDraft({ ...draft, severity: e.target.value })}
          style={{ padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }}>
          <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={!!draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />
          Active
        </label>
      </div>
      <textarea placeholder="Case definition" value={draft.case_definition || ''}
        onChange={e => setDraft({ ...draft, case_definition: e.target.value })}
        rows={2} style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6, marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button data-testid="cv-rule-save" onClick={save}
          style={{ padding: '6px 14px', background: '#2a9d8f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          {editingId ? 'Update Rule' : 'Add Rule'}
        </button>
        {editingId && (
          <button onClick={cancel} style={{ padding: '6px 14px', background: '#94a3b8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
        )}
      </div>

      {loading ? <div>Loading rules...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ padding: 8, textAlign: 'left' }}>Disease</th>
              <th style={{ padding: 8 }}>Threshold</th>
              <th style={{ padding: 8 }}>Window (d)</th>
              <th style={{ padding: 8 }}>Severity</th>
              <th style={{ padding: 8 }}>Active</th>
              <th style={{ padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{r.disease_name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{r.case_definition}</div>
                </td>
                <td style={{ padding: 8, textAlign: 'center' }}>{r.alert_threshold}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{r.window_days}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{r.severity}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{r.active ? 'Yes' : 'No'}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <button onClick={() => edit(r)} style={{ marginRight: 4, padding: '4px 8px', background: '#1d3557', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => del(r.id)} style={{ padding: '4px 8px', background: '#e63946', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && <tr><td colSpan={6} style={{ padding: 12, textAlign: 'center', color: '#64748b' }}>No rules yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
