import { useState } from 'react';
import AIAnalysis from '../components/AIAnalysis';

const AI_FEATURES = [
  { key: 'comprehensive-assessment', icon: '🌐', title: 'Comprehensive Health Assessment', desc: 'Holistic situation analysis combining outbreak, vaccination, hospital, and mortality data for executive-level insights.' },
  { key: 'epidemic-risk-score', icon: '⚠️', title: 'Epidemic Risk Scoring', desc: 'Calculate numerical risk scores (1-10) for current epidemic threats based on outbreak and surveillance data.' },
  { key: 'resource-allocation', icon: '📦', title: 'Resource Allocation Optimizer', desc: 'AI-optimized resource distribution across hospitals, outbreak response, and vaccination campaigns.' },
  { key: 'environmental-health', icon: '🌍', title: 'Environmental Health Correlator', desc: 'Correlate water quality, air quality, and disease patterns to identify environmental health impacts.' },
  { key: 'pandemic-preparedness', icon: '🛡️', title: 'Pandemic Preparedness Assessment', desc: 'Assess readiness for potential pandemics based on hospital capacity, vaccination infrastructure, and AMR threats.' },
  { key: 'population-health', icon: '👥', title: 'Population Health Insights', desc: 'Analyze mortality trends, health equity, and syndromic patterns for population-level health recommendations.' },
];

export default function AICenter() {
  const [activeFeature, setActiveFeature] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [customResult, setCustomResult] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);

  const runFeature = async (key) => {
    setActiveFeature(key);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/ai-center/${key}`, { method: 'POST' });
      const data = await res.json();
      setResult(data.analysis);
    } catch (err) {
      setResult('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const runCustomQuery = async () => {
    if (!customQuery.trim()) return;
    setCustomLoading(true);
    setCustomResult(null);
    try {
      const res = await fetch('/api/ai-center/custom-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: customQuery }),
      });
      const data = await res.json();
      setCustomResult(data.analysis);
    } catch (err) {
      setCustomResult('Error: ' + err.message);
    } finally {
      setCustomLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🤖 AI Command Center</h1>
          <p>Comprehensive AI-powered public health intelligence and analytics</p>
        </div>
      </div>

      <div className="page-body">
        {/* Custom Query */}
        <div className="custom-query-box">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#553c9a' }}>
            🔮 Ask AI Anything About Public Health
          </h3>
          <textarea
            value={customQuery}
            onChange={e => setCustomQuery(e.target.value)}
            placeholder="Ask any public health question... e.g., 'What are the top disease threats right now?' or 'How should we prioritize resource allocation?'"
          />
          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button className="btn btn-ai" onClick={runCustomQuery} disabled={customLoading || !customQuery.trim()}>
              🤖 Ask AI
            </button>
            <button className="btn btn-secondary" onClick={() => { setCustomQuery(''); setCustomResult(null); }}>Clear</button>
          </div>
          {customLoading && <AIAnalysis loading={true} />}
          {customResult && <AIAnalysis content={customResult} />}
        </div>

        {/* AI Feature Cards */}
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#1a365d' }}>AI Analysis Modules</h3>
        <div className="ai-center-grid">
          {AI_FEATURES.map(f => (
            <div className="ai-feature-card" key={f.key}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <button
                className="btn btn-ai"
                onClick={() => runFeature(f.key)}
                disabled={loading && activeFeature === f.key}
              >
                {loading && activeFeature === f.key ? 'Analyzing...' : `Run ${f.title}`}
              </button>
              {activeFeature === f.key && loading && <AIAnalysis loading={true} />}
              {activeFeature === f.key && result && <AIAnalysis content={result} />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
