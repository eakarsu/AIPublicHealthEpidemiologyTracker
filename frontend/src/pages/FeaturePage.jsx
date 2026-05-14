import { useState, useEffect, useCallback } from 'react';
import AIAnalysis from '../components/AIAnalysis';

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
    alert: 'badge-alert', resistant: 'badge-resistant', increasing: 'badge-increasing', r: 'badge-resistant',
    contained: 'badge-contained', safe: 'badge-safe', normal: 'badge-normal', good: 'badge-good',
    completed: 'badge-completed', low: 'badge-contained', cleared: 'badge-cleared', declining: 'badge-contained',
    sensitive: 'badge-contained', s: 'badge-contained',
    monitoring: 'badge-monitoring', medium: 'badge-monitoring', warning: 'badge-warning',
    moderate: 'badge-monitoring', intermediate: 'badge-monitoring', stable: 'badge-monitoring',
    i: 'badge-monitoring', planned: 'badge-monitoring',
    testing: 'badge-info', quarantined: 'badge-info', 'near-capacity': 'badge-warning',
    'unhealthy': 'badge-active', 'very-unhealthy': 'badge-critical', 'unhealthy-for-sensitive': 'badge-warning',
    hazardous: 'badge-critical', 'hospitalized': 'badge-active', 'symptomatic': 'badge-warning',
  };
  return map[v] || '';
}

function isBadgeField(field) {
  return ['status', 'severity', 'risk_level', 'alert_level', 'category', 'interpretation', 'resistance_pattern', 'habitat_risk', 'trend'].includes(field);
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

export default function FeaturePage({ feature }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({});
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [bulkAiResult, setBulkAiResult] = useState(null);
  const [bulkAiLoading, setBulkAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchItems = useCallback((p = 1) => {
    setLoading(true);
    fetch(`/api${feature.apiPath}?page=${p}&limit=${LIMIT}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.data) {
          setItems(data.data);
          setPage(data.pagination.page);
          setTotalPages(data.pagination.totalPages);
          setTotal(data.pagination.total);
        } else if (Array.isArray(data)) {
          // backward compat
          setItems(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [feature.apiPath]);

  useEffect(() => {
    fetchItems(1);
    setSelected(null);
    setEditing(false);
    setCreating(false);
    setAiResult(null);
    setBulkAiResult(null);
    setPage(1);
  }, [feature.key]);

  const handleExportCSV = () => {
    const url = `/api${feature.apiPath}?format=csv`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${feature.key}.csv`;
    a.click();
  };

  const handleRowClick = (item) => {
    setSelected(item);
    setEditing(false);
    setAiResult(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    await fetch(`/api${feature.apiPath}/${id}`, { method: 'DELETE', headers: authHeaders });
    setSelected(null);
    fetchItems(page);
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
  };

  const handleSave = async () => {
    const method = creating ? 'POST' : 'PUT';
    const url = creating ? `/api${feature.apiPath}` : `/api${feature.apiPath}/${formData.id}`;
    const body = {};
    feature.fields.forEach(f => {
      let val = formData[f];
      if (feature.fieldTypes[f] === 'number' && val !== '') val = Number(val);
      if (feature.fieldTypes[f]?.type === 'select' && f === 'lab_confirmed') val = val === 'true';
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

  const handleAiAnalyze = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch(`/api${feature.apiPath}/${selected.id}/${feature.aiEndpoint}`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      setAiResult(data.analysis);
    } catch (err) {
      setAiResult('Error: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleBulkAi = async () => {
    setBulkAiLoading(true);
    setBulkAiResult(null);
    try {
      const res = await fetch(`/api${feature.apiPath}/${feature.aiBulk}`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      setBulkAiResult(data.analysis);
    } catch (err) {
      setBulkAiResult('Error: ' + err.message);
    } finally {
      setBulkAiLoading(false);
    }
  };

  const renderField = (fieldName) => {
    const type = feature.fieldTypes[fieldName];
    const val = formData[fieldName] ?? '';

    if (type === 'textarea') {
      return <textarea value={val} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))} />;
    }
    if (type === 'date') {
      const dateVal = val ? val.substring(0, 10) : '';
      return <input type="date" value={dateVal} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))} />;
    }
    if (type === 'number') {
      return <input type="number" step="any" value={val} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))} />;
    }
    if (type?.type === 'select') {
      return (
        <select value={val} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))}>
          <option value="">Select...</option>
          {type.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return <input type="text" value={val} onChange={e => setFormData(p => ({ ...p, [fieldName]: e.target.value }))} />;
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{feature.icon} {feature.label}</h1>
          <p>Manage and analyze {feature.label.toLowerCase()} with AI-powered insights</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExportCSV} title="Export as CSV">
            Export CSV
          </button>
          <button className="btn btn-ai" onClick={handleBulkAi} disabled={bulkAiLoading}>
            {bulkAiLoading ? 'Analyzing...' : `AI ${feature.aiBulkLabel}`}
          </button>
          <button className="btn btn-primary" onClick={handleCreate}>
            + New Record
          </button>
        </div>
      </div>

      <div className="page-body">
        {bulkAiResult && <AIAnalysis content={bulkAiResult} />}
        {bulkAiLoading && <AIAnalysis loading={true} />}

        {loading ? (
          <div className="loading"><div className="loading-spinner"></div> Loading data...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{feature.icon}</div>
            <h3>No records found</h3>
            <p>Add your first record to get started</p>
          </div>
        ) : (
          <div className="data-table-container" style={{ marginTop: bulkAiResult || bulkAiLoading ? 24 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, color: '#6b7280', fontSize: 13 }}>
              <span>{total} total records</span>
              <span>Showing page {page} of {totalPages}</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  {feature.columns.map(col => (
                    <th key={col}>{formatLabel(col)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} onClick={() => handleRowClick(item)}>
                    {feature.columns.map(col => (
                      <td key={col}>
                        {isBadgeField(col) ? (
                          <span className={`badge ${getBadgeClass(item[col])}`}>{formatValue(item[col])}</span>
                        ) : formatValue(item[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} onPageChange={(p) => fetchItems(p)} />
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
                  <div className={`detail-field ${f === 'description' || f === 'notes' || f === 'symptoms' || f === 'control_measures' || f === 'symptoms_description' ? 'full' : ''}`} key={f}>
                    <label>{formatLabel(f)}</label>
                    {isBadgeField(f) ? (
                      <span className={`badge ${getBadgeClass(selected[f])}`}>{formatValue(selected[f])}</span>
                    ) : (
                      <span>{formatValue(selected[f])}</span>
                    )}
                  </div>
                ))}
              </div>

              <AIAnalysis content={aiResult} loading={aiLoading} />
            </div>
            <div className="detail-actions">
              <button className="btn btn-ai" onClick={handleAiAnalyze} disabled={aiLoading}>
                {aiLoading ? 'Analyzing...' : 'AI Analyze'}
              </button>
              <button className="btn btn-primary" onClick={handleEdit}>Edit</button>
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
    </>
  );
}
