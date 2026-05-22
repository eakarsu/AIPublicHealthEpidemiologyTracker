import { useEffect, useState } from 'react';

export default function TransmissionHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/custom-views/transmission-heatmap', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Failed');
        setData(j);
      } catch (e) { setErr(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>Loading heatmap...</div>;
  if (err) return <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0', color: '#c53030' }}>{err}</div>;

  const { regions = [], diseases = [], matrix = [], max = 1 } = data || {};
  const colorFor = (v) => {
    const t = max ? v / max : 0;
    const r = Math.round(255 * t);
    const g = Math.round(220 * (1 - t));
    const b = Math.round(120 * (1 - t));
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h3 style={{ margin: '0 0 12px', color: '#0a1f44' }}>Transmission Heatmap (Region x Disease)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: 8, background: '#f1f5f9', textAlign: 'left' }}>Region</th>
              {diseases.map(d => (<th key={d} style={{ padding: 8, background: '#f1f5f9' }}>{d}</th>))}
            </tr>
          </thead>
          <tbody>
            {regions.map((rg, ri) => (
              <tr key={rg}>
                <td style={{ padding: 8, fontWeight: 600 }}>{rg}</td>
                {diseases.map((d, di) => {
                  const v = matrix[ri]?.[di] ?? 0;
                  return (
                    <td key={d} title={`${rg} / ${d}: ${v}`}
                      style={{ padding: 8, textAlign: 'center', background: colorFor(v), color: v > max * 0.55 ? '#fff' : '#1f2937', minWidth: 60 }}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>Max value: {max}</div>
    </div>
  );
}
