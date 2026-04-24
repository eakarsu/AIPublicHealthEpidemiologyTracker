import { useNavigate } from 'react-router-dom';

export default function Sidebar({ features, user, onLogout, currentPath }) {
  const navigate = useNavigate();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon">🏛️</div>
          <div className="brand-text">
            <h2>EpiTracker AI</h2>
            <p>Public Health Intelligence</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Overview</div>
          <div className={`nav-item ${currentPath === '/dashboard' ? 'active' : ''}`} onClick={() => navigate('/dashboard')}>
            <span className="nav-icon">📊</span>
            Dashboard
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Disease Tracking</div>
          {features.filter(f => ['outbreaks','disease-reports','contact-tracing','surveillance'].includes(f.key)).map(f => (
            <div key={f.key} className={`nav-item ${currentPath === `/${f.key}` ? 'active' : ''}`} onClick={() => navigate(`/${f.key}`)}>
              <span className="nav-icon">{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Prevention</div>
          {features.filter(f => ['vaccinations','amr','vector-diseases'].includes(f.key)).map(f => (
            <div key={f.key} className={`nav-item ${currentPath === `/${f.key}` ? 'active' : ''}`} onClick={() => navigate(`/${f.key}`)}>
              <span className="nav-icon">{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Environment & Resources</div>
          {features.filter(f => ['water-quality','air-quality','hospital-capacity'].includes(f.key)).map(f => (
            <div key={f.key} className={`nav-item ${currentPath === `/${f.key}` ? 'active' : ''}`} onClick={() => navigate(`/${f.key}`)}>
              <span className="nav-icon">{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">Population Health</div>
          {features.filter(f => ['mortality','health-equity'].includes(f.key)).map(f => (
            <div key={f.key} className={`nav-item ${currentPath === `/${f.key}` ? 'active' : ''}`} onClick={() => navigate(`/${f.key}`)}>
              <span className="nav-icon">{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-section-title">AI Intelligence</div>
          <div className={`nav-item ${currentPath === '/ai-center' ? 'active' : ''}`} onClick={() => navigate('/ai-center')} style={{ background: currentPath === '/ai-center' ? 'rgba(128, 90, 213, 0.2)' : '' }}>
            <span className="nav-icon">🤖</span>
            AI Command Center
            <span className="nav-badge" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}>AI</span>
          </div>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.name?.[0] || 'A'}</div>
          <div className="user-details">
            <div className="name">{user?.name || 'Admin'}</div>
            <div className="role">{user?.role || 'Analyst'}</div>
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">⏻</button>
        </div>
      </div>
    </div>
  );
}
