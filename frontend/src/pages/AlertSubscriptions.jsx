import { useState, useEffect } from 'react';

const FEATURES = [
  'outbreaks', 'vaccinations', 'contact-tracing', 'surveillance',
  'water-quality', 'air-quality', 'hospital-capacity', 'mortality',
  'disease-reports', 'amr', 'vector-diseases', 'health-equity',
];

export default function AlertSubscriptions() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ feature: '', threshold_field: '', threshold_value: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = () => {
    setLoading(true);
    fetch('/api/alerts/subscriptions', { headers: authHeaders })
      .then(r => r.json())
      .then(data => { setSubscriptions(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.feature) { setError('Feature is required'); return; }
    setSaving(true);
    setError('');
    const res = await fetch('/api/alerts/subscriptions', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setCreating(false);
      setForm({ feature: '', threshold_field: '', threshold_value: '', email: '' });
      load();
    } else {
      const data = await res.json();
      setError(data.errors?.[0]?.msg || data.error || 'Failed to create subscription');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this alert subscription?')) return;
    await fetch(`/api/alerts/subscriptions/${id}`, { method: 'DELETE', headers: authHeaders });
    load();
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Alert Subscriptions</h1>
          <p>Set up alerts for disease outbreaks, environmental thresholds, and public health events</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setCreating(true)}>+ New Alert</button>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="loading"><div className="loading-spinner"></div> Loading...</div>
        ) : subscriptions.length === 0 && !creating ? (
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            <h3>No alert subscriptions</h3>
            <p>Create an alert to be notified when health thresholds are exceeded</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setCreating(true)}>+ Create First Alert</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subscriptions.map(sub => (
              <div key={sub.id} style={{ background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#1a365d', textTransform: 'capitalize' }}>{sub.feature}</div>
                  {sub.threshold_field && (
                    <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                      Alert when {sub.threshold_field} &gt; {sub.threshold_value}
                    </div>
                  )}
                  {sub.email && <div style={{ color: '#6b7280', fontSize: 12 }}>Notify: {sub.email}</div>}
                  <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 12, fontSize: 11, background: sub.active ? '#dcfce7' : '#f3f4f6', color: sub.active ? '#166534' : '#6b7280' }}>
                    {sub.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <button className="btn btn-danger" onClick={() => handleDelete(sub.id)} style={{ padding: '6px 14px' }}>Delete</button>
              </div>
            ))}
          </div>
        )}

        {creating && (
          <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCreating(false); }}>
            <div className="form-modal">
              <div className="detail-header">
                <h2>New Alert Subscription</h2>
                <button className="detail-close" onClick={() => setCreating(false)}>&times;</button>
              </div>
              <div className="detail-body">
                {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}
                <div className="form-grid">
                  <div className="form-group">
                    <label>Feature *</label>
                    <select value={form.feature} onChange={e => setForm(f => ({ ...f, feature: e.target.value }))}>
                      <option value="">Select feature...</option>
                      {FEATURES.map(f => <option key={f} value={f}>{f.replace(/-/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Threshold Field (optional)</label>
                    <input type="text" value={form.threshold_field} onChange={e => setForm(f => ({ ...f, threshold_field: e.target.value }))} placeholder="e.g. cases_count" />
                  </div>
                  <div className="form-group">
                    <label>Threshold Value (optional)</label>
                    <input type="number" value={form.threshold_value} onChange={e => setForm(f => ({ ...f, threshold_value: e.target.value }))} placeholder="e.g. 100" />
                  </div>
                  <div className="form-group">
                    <label>Notification Email (optional)</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
                  </div>
                </div>
              </div>
              <div className="detail-actions">
                <button className="btn btn-success" onClick={handleCreate} disabled={saving}>
                  {saving ? 'Saving...' : 'Create Alert'}
                </button>
                <button className="btn btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
