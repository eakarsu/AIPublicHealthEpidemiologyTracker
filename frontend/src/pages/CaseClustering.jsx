import { useState } from 'react';
import AIAnalysis from '../components/AIAnalysis';

export default function CaseClustering() {
  const [region, setRegion] = useState('');
  const [windowDays, setWindowDays] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  const handleRun = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const payload = {
        window_days: Math.max(1, Math.min(180, Number(windowDays) || 14)),
      };
      if (region) payload.region = region;
      const res = await fetch('/api/syndromic-surveillance/ai/case-clustering', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Clustering failed');
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'Network error');
    }
    setLoading(false);
  };

  const parsed = result?.parsed || result;
  const clusters = parsed?.clusters || parsed?.ranked_clusters || [];
  const content = parsed?.analysis || parsed?.content || result?.aiAnalysis;

  return (
    <div className="ai-feature-page">
      <div className="page-header">
        <h1>Syndromic Case Clustering</h1>
        <p>AI-ranked clusters with suspicion scores and recommended responses</p>
      </div>

      <div className="ai-input-form">
        <form onSubmit={handleRun}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label>Region (optional)</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g., Northeast US, ZIP 11215"
              />
            </div>
            <div style={{ width: 160 }}>
              <label>Window (days)</label>
              <input
                type="number"
                min="1"
                max="180"
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
              />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Clustering...' : 'Run Clustering'}
              </button>
            </div>
          </div>
        </form>
        {error && (
          <div
            style={{
              padding: 12,
              background: '#7f1d1d',
              color: '#fecaca',
              borderRadius: 8,
              marginTop: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {loading && <AIAnalysis loading />}

      {!loading && parsed && clusters.length > 0 && (
        <div className="ai-analysis" style={{ marginTop: 16 }}>
          <div className="ai-analysis-header">
            <div className="ai-icon">🤖</div>
            <div>
              <h3>Top Clusters ({clusters.length})</h3>
              <p>Suspicion-ranked syndromic clusters</p>
            </div>
          </div>
          <div className="ai-analysis-content">
            <ul>
              {clusters.map((c, i) => (
                <li key={i} style={{ marginBottom: 12 }}>
                  <strong>
                    {c.name || c.cluster_id || `Cluster ${i + 1}`}
                    {c.suspicion_score !== undefined && ` — score ${c.suspicion_score}`}
                  </strong>
                  {c.description && <div>{c.description}</div>}
                  {c.recommended_response && (
                    <div style={{ marginTop: 4 }}>
                      <em>Recommended response:</em> {c.recommended_response}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!loading && content && <AIAnalysis content={content} />}
    </div>
  );
}
