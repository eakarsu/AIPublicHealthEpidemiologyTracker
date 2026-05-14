import { useState, useEffect } from 'react';
import AIAnalysis from '../components/AIAnalysis';

export default function OutbreakIntervention() {
  const [outbreaks, setOutbreaks] = useState([]);
  const [outbreakId, setOutbreakId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const headers = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  });

  useEffect(() => {
    fetch('/api/outbreaks', { headers: headers() })
      .then((r) => r.json())
      .then((d) => setOutbreaks(Array.isArray(d) ? d : d.data || []))
      .catch(() => {});
  }, []);

  const handleRun = async (e) => {
    e.preventDefault();
    setError('');
    if (!outbreakId) {
      setError('Select an outbreak');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/outbreaks/${outbreakId}/ai-intervention`, {
        method: 'POST',
        headers: headers(),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Intervention generation failed');
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err.message || 'Network error');
    }
    setLoading(false);
  };

  const parsed = result?.parsed || result;
  const interventions = parsed?.interventions || parsed?.ranked_interventions || [];
  const content = parsed?.analysis || parsed?.content || result?.aiAnalysis;

  return (
    <div className="ai-feature-page">
      <div className="page-header">
        <h1>Outbreak Intervention Recommender</h1>
        <p>Evidence-ranked interventions with feasibility, equity, cost tier, monitoring</p>
      </div>

      <div className="ai-input-form">
        <form onSubmit={handleRun}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px' }}>
              <label>Outbreak</label>
              <select value={outbreakId} onChange={(e) => setOutbreakId(e.target.value)} required>
                <option value="">Select outbreak...</option>
                {outbreaks.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.id} &middot; {o.disease_name} &middot; {o.location || ''}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Generating...' : 'Recommend Interventions'}
            </button>
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

      {!loading && interventions.length > 0 && (
        <div className="ai-analysis" style={{ marginTop: 16 }}>
          <div className="ai-analysis-header">
            <div className="ai-icon">🤖</div>
            <div>
              <h3>Ranked Interventions ({interventions.length})</h3>
              <p>Evidence + feasibility + equity + cost tier</p>
            </div>
          </div>
          <div className="ai-analysis-content">
            <ol>
              {interventions.map((iv, i) => (
                <li key={i} style={{ marginBottom: 12 }}>
                  <strong>{iv.name || iv.intervention || `Intervention ${i + 1}`}</strong>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {iv.feasibility && <span><em>Feasibility:</em> {iv.feasibility}</span>}
                    {iv.equity && <span><em>Equity:</em> {iv.equity}</span>}
                    {iv.cost_tier && <span><em>Cost:</em> {iv.cost_tier}</span>}
                    {iv.evidence && <span><em>Evidence:</em> {iv.evidence}</span>}
                  </div>
                  {iv.description && <div style={{ marginTop: 4 }}>{iv.description}</div>}
                  {iv.monitoring_metrics && (
                    <div style={{ marginTop: 4 }}>
                      <em>Monitoring:</em>{' '}
                      {Array.isArray(iv.monitoring_metrics)
                        ? iv.monitoring_metrics.join(', ')
                        : iv.monitoring_metrics}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {!loading && content && <AIAnalysis content={content} />}
    </div>
  );
}
