import { useEffect, useState } from 'react';

export default function CaseTrendLineChart() {
  const [data, setData] = useState(null);
  const [disease, setDisease] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async (d = '') => {
    setLoading(true); setErr('');
    try {
      const url = `/api/custom-views/case-trend${d ? `?disease=${encodeURIComponent(d)}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed');
      setData(j);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const W = 720, H = 260, P = 36;
  const series = data?.series || [];
  const allPoints = series.flatMap(s => s.points);
  const maxY = Math.max(10, ...allPoints.map(p => p.cases));
  const days = [...new Set(allPoints.map(p => p.date))].sort();
  const xFor = (d) => P + (days.length <= 1 ? 0 : ((days.indexOf(d)) / (days.length - 1)) * (W - 2 * P));
  const yFor = (v) => H - P - (v / maxY) * (H - 2 * P);
  const palette = ['#e63946', '#1d3557', '#2a9d8f', '#f4a261', '#9d4edd', '#118ab2'];

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#0a1f44' }}>Case Trend (per disease)</h3>
        <div>
          <input data-testid="cv-disease-input" placeholder="Filter disease (e.g. Influenza)" value={disease}
            onChange={(e) => setDisease(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, marginRight: 8 }} />
          <button data-testid="cv-trend-apply" onClick={() => load(disease)} style={{ padding: '6px 12px', background: '#1d3557', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Apply</button>
        </div>
      </div>
      {loading && <div>Loading...</div>}
      {err && <div style={{ color: '#c53030' }}>{err}</div>}
      {!loading && !err && (
        <>
          <svg width={W} height={H} style={{ maxWidth: '100%', display: 'block' }}>
            <rect x={0} y={0} width={W} height={H} fill="#f8fafc" />
            {/* axes */}
            <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#94a3b8" />
            <line x1={P} y1={P} x2={P} y2={H - P} stroke="#94a3b8" />
            {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
              <g key={i}>
                <line x1={P} y1={P + t * (H - 2 * P)} x2={W - P} y2={P + t * (H - 2 * P)} stroke="#e2e8f0" />
                <text x={4} y={P + t * (H - 2 * P) + 4} fontSize="10" fill="#64748b">{Math.round(maxY * (1 - t))}</text>
              </g>
            ))}
            {series.map((s, idx) => {
              const pts = s.points.map(p => `${xFor(p.date)},${yFor(p.cases)}`).join(' ');
              return (
                <g key={s.disease}>
                  <polyline points={pts} fill="none" stroke={palette[idx % palette.length]} strokeWidth="2" />
                  {s.points.map((p, i) => (
                    <circle key={i} cx={xFor(p.date)} cy={yFor(p.cases)} r="3" fill={palette[idx % palette.length]} />
                  ))}
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            {series.map((s, idx) => (
              <div key={s.disease} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ width: 12, height: 12, background: palette[idx % palette.length], display: 'inline-block', borderRadius: 2 }} />
                {s.disease}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
