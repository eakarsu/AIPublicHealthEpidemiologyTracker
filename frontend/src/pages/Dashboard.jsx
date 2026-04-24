import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard({ features }) {
  const [stats, setStats] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    features.forEach(f => {
      fetch(`/api${f.apiPath}`)
        .then(r => r.json())
        .then(data => {
          setStats(prev => ({ ...prev, [f.key]: Array.isArray(data) ? data.length : 0 }));
        })
        .catch(() => {});
    });
  }, []);

  const summaryCards = [
    { label: 'Active Outbreaks', value: stats['outbreaks'] || 0, icon: '🦠', color: '#e53e3e', bgColor: '#fff5f5' },
    { label: 'Vaccination Campaigns', value: stats['vaccinations'] || 0, icon: '💉', color: '#38a169', bgColor: '#f0fff4' },
    { label: 'Contacts Traced', value: stats['contact-tracing'] || 0, icon: '🔗', color: '#3182ce', bgColor: '#ebf8ff' },
    { label: 'Hospital Reports', value: stats['hospital-capacity'] || 0, icon: '🏥', color: '#805ad5', bgColor: '#faf5ff' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Public Health Dashboard</h1>
          <p>Real-time epidemiological intelligence overview</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ai" onClick={() => navigate('/ai-center')}>
            🤖 AI Command Center
          </button>
        </div>
      </div>
      <div className="page-body">
        <div className="stats-row">
          {summaryCards.map((card, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-label">{card.icon} {card.label}</div>
              <div className="stat-value">{card.value}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#1a365d' }}>Feature Modules</h2>
        <div className="dashboard-grid">
          {features.map(f => (
            <div className="dash-card" key={f.key} onClick={() => navigate(`/${f.key}`)}>
              <div className={`card-icon ${f.color}`}>{f.icon}</div>
              <h3>{f.label}</h3>
              <p>Manage and analyze {f.label.toLowerCase()} data with AI insights</p>
              <div className="card-stat">
                {stats[f.key] !== undefined ? stats[f.key] : '—'}
                <small>records</small>
              </div>
            </div>
          ))}
          <div className="dash-card" onClick={() => navigate('/ai-center')} style={{ borderImage: 'linear-gradient(135deg, #667eea, #764ba2) 1', borderWidth: 2, borderStyle: 'solid' }}>
            <div className="card-icon purple">🤖</div>
            <h3>AI Command Center</h3>
            <p>Comprehensive AI-powered health intelligence, risk scoring, and resource optimization</p>
            <div className="card-stat" style={{ color: '#805ad5' }}>
              7<small>AI features</small>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
