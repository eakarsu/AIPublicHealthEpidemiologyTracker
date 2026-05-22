import { useState } from 'react';

export default function OutbreakReportPDF() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true); setStatus('');
    try {
      const res = await fetch('/api/custom-views/outbreak-report.pdf', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'outbreak-report.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setStatus(`PDF generated (${(blob.size / 1024).toFixed(1)} KB)`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
      <h3 style={{ margin: '0 0 8px', color: '#0a1f44' }}>Outbreak Report (PDF)</h3>
      <p style={{ margin: '0 0 12px', color: '#475569', fontSize: 13 }}>Generate a printable surveillance report of the most recent outbreaks for distribution to field epidemiologists.</p>
      <button data-testid="cv-pdf-download" onClick={download} disabled={busy}
        style={{ padding: '8px 14px', background: '#e63946', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
        {busy ? 'Generating...' : 'Download PDF'}
      </button>
      {status && <div style={{ marginTop: 10, color: status.startsWith('Error') ? '#c53030' : '#16a34a', fontSize: 13 }}>{status}</div>}
    </div>
  );
}
