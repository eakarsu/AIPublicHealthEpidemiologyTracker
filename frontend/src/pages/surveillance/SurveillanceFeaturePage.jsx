import { useState, useEffect, useCallback } from 'react';

function formatLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(val) {
  if (val === true) return 'Yes';
  if (val === false) return 'No';
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
    return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return String(val);
}

function getBadgeClass(val) {
  if (!val) return '';
  const v = String(val).toLowerCase().replace(/\s+/g, '-');
  const map = {
    active: 'badge-active', high: 'badge-high', critical: 'badge-critical', unsafe: 'badge-unsafe',
    alert: 'badge-alert', resistant: 'badge-resistant', increasing: 'badge-increasing',
    contained: 'badge-contained', safe: 'badge-safe', normal: 'badge-normal', good: 'badge-good',
    completed: 'badge-completed', low: 'badge-contained', cleared: 'badge-cleared', declining: 'badge-contained',
    monitoring: 'badge-monitoring', medium: 'badge-monitoring', warning: 'badge-warning',
    moderate: 'badge-monitoring', stable: 'badge-monitoring', pending: 'badge-monitoring',
    informational: 'badge-info', draft: 'badge-info', verified: 'badge-safe',
    'not_started': 'badge-monitoring', elevated: 'badge-warning', urgent: 'badge-high',
    emergency: 'badge-critical', 'very_high': 'badge-critical',
  };
  return map[v] || '';
}

function isBadgeField(field) {
  return ['status', 'severity', 'risk_level', 'alert_level', 'pheic_likelihood', 'international_spread_risk',
    'human_health_risk', 'transmission_regime', 'investigation_status', 'notification_status',
    'joint_investigation_status', 'bilateral_communication_status', 'importation_likelihood'].includes(field);
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, justifyContent: 'center' }}>
      <button className="btn btn-secondary" onClick={() => onPageChange(1)} disabled={page === 1}>&laquo;</button>
      <button className="btn btn-secondary" onClick={() => onPageChange(page - 1)} disabled={page === 1}>&lsaquo;</button>
      <span style={{ padding: '4px 12px', fontSize: 14, color: '#4a5568' }}>
        Page {page} of {totalPages}
      </span>
      <button className="btn btn-secondary" onClick={() => onPageChange(page + 1)} disabled={page === totalPages}>&rsaquo;</button>
      <button className="btn btn-secondary" onClick={() => onPageChange(totalPages)} disabled={page === totalPages}>&raquo;</button>
    </div>
  );
}

function AIPanel({ feature, onClose }) {
  const [activeVerb, setActiveVerb] = useState(null);
  const [formInputs, setFormInputs] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

  const runVerb = async () => {
    if (!activeVerb) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/surveillance/${feature.slug}/ai/${activeVerb.name}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(formInputs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setResult(data.result || data);
    } catch (e) {
      setError(e.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="detail-panel" style={{ maxWidth: 680 }}>
        <div className="detail-header">
          <h2>🤖 AI Verbs — {feature.label}</h2>
          <button className="detail-close" onClick={onClose}>&times;</button>
        </div>
        <div className="detail-body">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {feature.aiVerbs.map(verb => (
              <button
                key={verb.name}
                className={`btn ${activeVerb?.name === verb.name ? 'btn-ai' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
                onClick={() => { setActiveVerb(verb); setFormInputs({}); setResult(null); setError(null); }}
              >
                {verb.label}
              </button>
            ))}
          </div>

          {activeVerb && (
            <div>
              <h3 style={{ marginBottom: 12, fontSize: 15, color: '#4a5568' }}>{activeVerb.label}</h3>
              <div className="form-grid">
                {activeVerb.fields.map(field => (
                  <div className="form-group" key={field}>
                    <label>{formatLabel(field)}</label>
                    <input
                      type="text"
                      placeholder={`Enter ${formatLabel(field).toLowerCase()}…`}
                      value={formInputs[field] || ''}
                      onChange={e => setFormInputs(p => ({ ...p, [field]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-ai" onClick={runVerb} disabled={loading}>
                  {loading ? 'Running…' : `Run ${activeVerb.label}`}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, padding: 12, background: '#fee', color: '#900', borderRadius: 6, fontSize: 13 }}>
              {error}
            </div>
          )}
          {result && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#2d3748' }}>Result</div>
              <pre style={{ padding: 12, background: '#f7f9fc', borderRadius: 6, overflow: 'auto', maxHeight: 400, fontSize: 12, border: '1px solid #e2e8f0' }}>
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <div className="detail-actions">
          <button className="btn btn-secondary" onClick={onClose} style={{ marginLeft: 'auto' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function SurveillanceFeaturePage({ feature }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const LIMIT = 20;

  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchItems = useCallback((p = 1) => {
    setLoading(true);
    fetch(`/api/surveillance/${feature.slug}?page=${p}&limit=${LIMIT}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.data) {
          setItems(data.data);
          setPage(data.pagination?.page || p);
          setTotalPages(data.pagination?.totalPages || 1);
          setTotal(data.pagination?.total || data.data.length);
        } else if (Array.isArray(data)) {
          setItems(data);
          setTotal(data.length);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [feature.slug]);

  useEffect(() => {
    fetchItems(1);
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setSearchResults(null);
    setSearch('');
    setPage(1);
  }, [feature.slug]);

  const handleSearch = () => {
    if (!search.trim()) { setSearchResults(null); return; }
    fetch(`/api/surveillance/${feature.slug}/search?q=${encodeURIComponent(search)}&limit=50`)
      .then(r => r.json())
      .then(data => { setSearchResults(data.data || []); })
      .catch(() => {});
  };

  const handleExportCSV = () => {
    const a = document.createElement('a');
    a.href = `/api/surveillance/${feature.slug}/export/csv`;
    a.download = `${feature.slug}.csv`;
    a.click();
  };

  const handleRowClick = (item) => {
    setSelected(item);
    setEditing(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    await fetch(`/api/surveillance/${feature.slug}/${id}`, { method: 'DELETE', headers: authHeaders });
    setSelected(null);
    fetchItems(page);
  };

  const handleArchive = async (id) => {
    await fetch(`/api/surveillance/${feature.slug}/${id}/archive`, { method: 'POST', headers: authHeaders });
    fetchItems(page);
    setSelected(null);
  };

  const handleEdit = () => {
    setFormData({ ...selected });
    setEditing(true);
  };

  const handleCreate = () => {
    const empty = {};
    feature.fields.forEach(f => { empty[f] = ''; });
    setFormData(empty);
    setCreating(true);
    setSelected(null);
  };

  const handleSave = async () => {
    const method = creating ? 'POST' : 'PUT';
    const url = creating
      ? `/api/surveillance/${feature.slug}`
      : `/api/surveillance/${feature.slug}/${formData.id}`;
    const body = {};
    feature.fields.forEach(f => {
      const ft = feature.fieldTypes[f];
      let val = formData[f];
      if (ft === 'number' && val !== '') val = Number(val);
      body[f] = val;
    });
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setEditing(false);
      setCreating(false);
      setSelected(null);
      fetchItems(page);
    }
  };

  const renderField = (fieldName) => {
    const type = feature.fieldTypes[fieldName];
    const val = formData[fieldName] ?? '';
    if (type === 'textarea') {
      return <textarea value={val} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))} />;
    }
    if (type === 'date') {
      return <input type="date" value={val ? val.substring(0, 10) : ''} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))} />;
    }
    if (type === 'number') {
      return <input type="number" step="any" value={val} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))} />;
    }
    if (type === 'checkbox') {
      return (
        <select value={String(val)} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value === 'true' }))}>
          <option value="">Select…</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }
    if (type?.type === 'select') {
      return (
        <select value={val} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))}>
          <option value="">Select…</option>
          {type.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return <input type="text" value={val} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))} />;
  };

  const displayItems = searchResults !== null ? searchResults : items;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{feature.icon} {feature.label}</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 2 }}>{feature.description}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV}>Export CSV</button>
          <button className="btn btn-ai" onClick={() => setShowAIPanel(true)}>
            🤖 AI Verbs ({feature.aiVerbs.length})
          </button>
          <button className="btn btn-primary" onClick={handleCreate}>+ New Record</button>
        </div>
      </div>

      <div className="page-body">
        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            placeholder={`Search ${feature.label.toLowerCase()}…`}
            value={search}
            onChange={e => { setSearch(e.target.value); if (!e.target.value) setSearchResults(null); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14 }}
          />
          <button className="btn btn-secondary" onClick={handleSearch}>Search</button>
          {searchResults !== null && (
            <button className="btn btn-secondary" onClick={() => { setSearchResults(null); setSearch(''); }}>Clear</button>
          )}
        </div>

        {loading ? (
          <div className="loading"><div className="loading-spinner"></div> Loading data…</div>
        ) : displayItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{feature.icon}</div>
            <h3>{searchResults !== null ? 'No results found' : 'No records found'}</h3>
            <p>{searchResults !== null ? 'Try a different search term' : 'Add your first record to get started'}</p>
          </div>
        ) : (
          <div className="data-table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, color: '#6b7280', fontSize: 13 }}>
              <span>{searchResults !== null ? `${displayItems.length} search results` : `${total} total records`}</span>
              {searchResults === null && <span>Page {page} of {totalPages}</span>}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  {feature.columns.map(col => <th key={col}>{formatLabel(col)}</th>)}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map(item => (
                  <tr key={item.id} onClick={() => handleRowClick(item)} style={{ cursor: 'pointer' }}>
                    {feature.columns.map(col => (
                      <td key={col}>
                        {isBadgeField(col) ? (
                          <span className={`badge ${getBadgeClass(item[col])}`}>{formatValue(item[col])}</span>
                        ) : formatValue(item[col])}
                      </td>
                    ))}
                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px', marginRight: 4 }} onClick={() => { setSelected(item); setEditing(false); }}>View</button>
                      <button className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => { setFormData({ ...item }); setEditing(true); setCreating(false); setSelected(null); }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {searchResults === null && (
              <Pagination page={page} totalPages={totalPages} onPageChange={(p) => fetchItems(p)} />
            )}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && !editing && !creating && (
        <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="detail-panel">
            <div className="detail-header">
              <h2>{feature.icon} Record Details</h2>
              <button className="detail-close" onClick={() => setSelected(null)}>&times;</button>
            </div>
            <div className="detail-body">
              <div className="detail-grid">
                {feature.fields.map(f => (
                  <div className={`detail-field ${['notes', 'description', 'event_description', 'chief_complaint_text', 'control_measures', 'screening_measures', 'source_hypothesis', 'intervention_context', 'affected_areas', 'event_title', 'alert_title', 'mutations', 'spike_mutations'].includes(f) ? 'full' : ''}`} key={f}>
                    <label>{formatLabel(f)}</label>
                    {isBadgeField(f) ? (
                      <span className={`badge ${getBadgeClass(selected[f])}`}>{formatValue(selected[f])}</span>
                    ) : (
                      <span>{formatValue(selected[f])}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="detail-actions">
              <button className="btn btn-primary" onClick={handleEdit}>Edit</button>
              <button className="btn btn-secondary" onClick={() => handleArchive(selected.id)}>Archive</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)} style={{ marginLeft: 'auto' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Create Modal */}
      {(editing || creating) && (
        <div className="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setEditing(false); setCreating(false); } }}>
          <div className="form-modal">
            <div className="detail-header">
              <h2>{creating ? '+ New' : 'Edit'} {feature.label} Record</h2>
              <button className="detail-close" onClick={() => { setEditing(false); setCreating(false); }}>&times;</button>
            </div>
            <div className="detail-body">
              <div className="form-grid">
                {feature.fields.map(f => (
                  <div className={`form-group ${feature.fieldTypes[f] === 'textarea' ? 'full' : ''}`} key={f}>
                    <label>{formatLabel(f)}</label>
                    {renderField(f)}
                  </div>
                ))}
              </div>
            </div>
            <div className="detail-actions">
              <button className="btn btn-success" onClick={handleSave}>
                {creating ? 'Create Record' : 'Save Changes'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setEditing(false); setCreating(false); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* AI Verbs Panel */}
      {showAIPanel && <AIPanel feature={feature} onClose={() => setShowAIPanel(false)} />}
    </>
  );
}
