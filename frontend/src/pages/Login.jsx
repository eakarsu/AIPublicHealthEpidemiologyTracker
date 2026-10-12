import { useRef as useDemoLoginRef, useState as useDemoLoginState } from 'react';
import { useState } from 'react';

export default function Login({ onLogin }) {
  const demoLoginLock = useDemoLoginRef(false);
  const [demoLoginBusy, setDemoLoginBusy] = useDemoLoginState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e, demoLoginCredentials) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: (demoLoginCredentials?.email ?? email), password: (demoLoginCredentials?.password ?? password) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = async () => {
    try {
      const res = await fetch('/api/auth/demo-credentials');
      const data = await res.json();
      if (!res.ok || !data.email || !data.password) throw new Error('Demo credentials unavailable');
      setEmail(data.email);
      setPassword(data.password);
    } catch {
      setEmail(import.meta.env.VITE_DEMO_EMAIL || '');
      setPassword(import.meta.env.VITE_DEMO_PASSWORD || '');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <div className="logo-icon">🏛️</div>
          <h1>EpiTracker AI</h1>
          <p>AI-Powered Public Health Epidemiology Platform</p>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button disabled={loading || demoLoginBusy} className="demo-btn" onClick={async (event) => {
 if (demoLoginLock.current) return;
 demoLoginLock.current = true; setDemoLoginBusy(true);
 const values = {};
 const captureDemoValue = (key, value) => { values[key] = value; return value; };
 try {
  await (async () => {
    try {
      const res = await fetch('/api/auth/demo-credentials');
      const data = await res.json();
      if (!res.ok || !data.email || !data.password) throw new Error('Demo credentials unavailable');
      setEmail(captureDemoValue("email", data.email));
      setPassword(captureDemoValue("password", data.password));
    } catch {
      setEmail(captureDemoValue("email", import.meta.env.VITE_DEMO_EMAIL || ''));
      setPassword(captureDemoValue("password", import.meta.env.VITE_DEMO_PASSWORD || ''));
    }
  })(event);
  if (values.error || typeof values.email !== 'string' || !values.email || typeof values.password !== 'string' || !values.password) { setError(typeof values.error === 'string' ? values.error : 'Demo credentials are unavailable.'); return; }
  await handleSubmit(event, { email: values.email, password: values.password });
 } finally { demoLoginLock.current = false; setDemoLoginBusy(false); }
}}>
          Log In as Demo
        </button>
      </div>
    </div>
  );
}
