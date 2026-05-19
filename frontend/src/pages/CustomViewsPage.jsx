import CaseTrendLineChart from '../components/CaseTrendLineChart';
import TransmissionHeatmap from '../components/TransmissionHeatmap';
import OutbreakReportPDF from '../components/OutbreakReportPDF';
import SurveillanceRulesEditor from '../components/SurveillanceRulesEditor';

export default function CustomViewsPage() {
  return (
    <div data-testid="custom-views-page" style={{ padding: 20 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, color: '#0a1f44' }}>Epi Views</h1>
        <p style={{ margin: '4px 0 0', color: '#475569' }}>Custom epidemiology visualizations, reports, and surveillance rule management.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <CaseTrendLineChart />
        <TransmissionHeatmap />
        <OutbreakReportPDF />
        <SurveillanceRulesEditor />
      </div>
    </div>
  );
}
