import { useState, useEffect } from 'react';
import AIAnalysis from '../components/AIAnalysis';

export default function AIHistory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const token = localStorage.getItem('token');

  const fetchHistory = (p = 1) => {
    setLoading(true);
    fetch(`/api/ai/history?page=${p}&limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.data) {
          setItems(data.data);
          setPage(data.pagination.page);
          setTotalPages(data.pagination.totalPages);
          setTotal(data.pagination.total);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchHistory(1); }, []);

  const formatDate = (d) => new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>AI Analysis History</h1>
          <p>View all previous AI analyses and their results</p>
        </div>
      </div>
      <div className="page-body">
        {loading ? (
          <div className="loading"><div className="loading-spinner"></div> Loading history...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📜</div>
            <h3>No AI analyses yet</h3>
            <p>Run AI analyses on any feature to see history here</p>
          </div>
        ) : (
          <>
            <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>{total} total analyses</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map(item => (
                <div key={item.id} style={{ background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  <div
                    style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#1a365d', fontSize: 15 }}>{item.endpoint}</div>
                      <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{formatDate(item.created_at)}</div>
                    </div>
                    <span style={{ color: '#553c9a', fontSize: 18 }}>{expanded === item.id ? '▲' : '▼'}</span>
                  </div>
                  {expanded === item.id && (
                    <div style={{ padding: '0 16px 16px' }}>
                      {item.input_data && Object.keys(item.input_data).length > 0 && (
                        <div style={{ marginBottom: 8, padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#475569' }}>
                          <strong>Input:</strong> {JSON.stringify(item.input_data)}
                        </div>
                      )}
                      <AIAnalysis content={item.result} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center' }}>
                <button className="btn btn-secondary" onClick={() => fetchHistory(page - 1)} disabled={page === 1}>&lsaquo; Prev</button>
                <span style={{ padding: '6px 12px', fontSize: 14, color: '#4a5568' }}>Page {page} of {totalPages}</span>
                <button className="btn btn-secondary" onClick={() => fetchHistory(page + 1)} disabled={page === totalPages}>Next &rsaquo;</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
