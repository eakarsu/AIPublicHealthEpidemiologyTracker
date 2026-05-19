import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sidebar from './components/Sidebar';
import FeaturePage from './pages/FeaturePage';
import AICenter from './pages/AICenter';
import AIHistory from './pages/AIHistory';
import AlertSubscriptions from './pages/AlertSubscriptions';
import CaseClustering from './pages/CaseClustering';
import OutbreakIntervention from './pages/OutbreakIntervention';
import CustomViewsPage from './pages/CustomViewsPage';

// === Batch 07 Gaps & Frontend Mounts ===
import CfNowcastCaseTrajectory from './pages/CfNowcastCaseTrajectory';
import CfVariantTrackingForecasting from './pages/CfVariantTrackingForecasting';
import CfEquityawareResourceAllocation from './pages/CfEquityawareResourceAllocation';
import CfSocialDeterminantsRag from './pages/CfSocialDeterminantsRag';
import CfMultilanguageHealthMessaging from './pages/CfMultilanguageHealthMessaging';
import CfZoonoticSpilloverRiskModel from './pages/CfZoonoticSpilloverRiskModel';
import GapNoOutbreakpredictionSpatialtemporalModeli from './pages/GapNoOutbreakpredictionSpatialtemporalModeli';
import GapNoEquitygapanalysisDisparitiesByDemograp from './pages/GapNoEquitygapanalysisDisparitiesByDemograp';
import GapNoInterventionrecommendationEvidencebased from './pages/GapNoInterventionrecommendationEvidencebased';
import GapNoCaseclusteringAnomalyDetection from './pages/GapNoCaseclusteringAnomalyDetection';
import GapNoVaccinationcoverageforecast from './pages/GapNoVaccinationcoverageforecast';
import GapNoResourceallocationAi from './pages/GapNoResourceallocationAi';
import GapNoRealtimeOutbreakMapdashboardRoute from './pages/GapNoRealtimeOutbreakMapdashboardRoute';
import GapNoCaseLinelistDeduplicationWorkflow from './pages/GapNoCaseLinelistDeduplicationWorkflow';
import GapNoSyndromicSurveillanceIngestionEdOtcP from './pages/GapNoSyndromicSurveillanceIngestionEdOtcP';
import GapNoCdcstateHealthdepartmentApiIntegration from './pages/GapNoCdcstateHealthdepartmentApiIntegration';
import GapNoContactTracingWorkflowBeyondDataStor from './pages/GapNoContactTracingWorkflowBeyondDataStor';
import GapNoNotificationssmsPushForAlerts from './pages/GapNoNotificationssmsPushForAlerts';
import GapNoReportingexportCsvpdf from './pages/GapNoReportingexportCsvpdf';
import GapNoRbacForClinicalVsAdminRoles from './pages/GapNoRbacForClinicalVsAdminRoles';
// === End Batch 07 ===


const API = '/api';

const FEATURES = [
  { key: 'outbreaks', label: 'Disease Outbreaks', icon: '🦠', color: 'red', apiPath: '/outbreaks', aiEndpoint: 'ai-analyze', aiBulk: 'ai/predict-spread', aiBulkLabel: 'Predict Spread',
    fields: ['disease_name', 'location', 'cases_count', 'deaths_count', 'status', 'severity', 'reported_date', 'description'],
    columns: ['disease_name', 'location', 'cases_count', 'deaths_count', 'status', 'severity', 'reported_date'],
    fieldTypes: { cases_count: 'number', deaths_count: 'number', reported_date: 'date', status: { type: 'select', options: ['Active','Contained','Monitoring'] }, severity: { type: 'select', options: ['Low','Medium','High','Critical'] }, description: 'textarea' }
  },
  { key: 'vaccinations', label: 'Vaccination Campaigns', icon: '💉', color: 'green', apiPath: '/vaccinations', aiEndpoint: 'ai-analyze', aiBulk: 'ai/optimize-distribution', aiBulkLabel: 'Optimize Distribution',
    fields: ['vaccine_name', 'target_disease', 'region', 'doses_administered', 'target_population', 'coverage_pct', 'start_date', 'status', 'provider'],
    columns: ['vaccine_name', 'target_disease', 'region', 'coverage_pct', 'status', 'start_date'],
    fieldTypes: { doses_administered: 'number', target_population: 'number', coverage_pct: 'number', start_date: 'date', status: { type: 'select', options: ['Active','Completed','Planned'] } }
  },
  { key: 'contact-tracing', label: 'Contact Tracing', icon: '🔗', color: 'blue', apiPath: '/contact-tracing', aiEndpoint: 'ai-analyze', aiBulk: 'ai/network-analysis', aiBulkLabel: 'Network Analysis',
    fields: ['case_id', 'contact_name', 'relationship', 'exposure_date', 'exposure_location', 'risk_level', 'status', 'symptoms', 'phone'],
    columns: ['case_id', 'contact_name', 'relationship', 'risk_level', 'status', 'exposure_date'],
    fieldTypes: { exposure_date: 'date', risk_level: { type: 'select', options: ['Low','Medium','High'] }, status: { type: 'select', options: ['Monitoring','Quarantined','Testing','Symptomatic','Hospitalized','Cleared'] }, symptoms: 'textarea' }
  },
  { key: 'surveillance', label: 'Syndromic Surveillance', icon: '📊', color: 'purple', apiPath: '/surveillance', aiEndpoint: 'ai-analyze', aiBulk: 'ai/early-warning', aiBulkLabel: 'Early Warning Detection',
    fields: ['syndrome', 'facility', 'region', 'case_count', 'baseline_count', 'alert_level', 'report_date', 'symptoms_description', 'age_group'],
    columns: ['syndrome', 'facility', 'region', 'case_count', 'alert_level', 'report_date'],
    fieldTypes: { case_count: 'number', baseline_count: 'number', report_date: 'date', alert_level: { type: 'select', options: ['Normal','Warning','Alert'] }, symptoms_description: 'textarea', age_group: { type: 'select', options: ['Pediatric 0-17','Adults 18-64','Young Adults 18-25','Elderly 65+','All Ages'] } }
  },
  { key: 'water-quality', label: 'Water Quality', icon: '💧', color: 'teal', apiPath: '/water-quality', aiEndpoint: 'ai-analyze', aiBulk: 'ai/contamination-risk', aiBulkLabel: 'Contamination Risk Prediction',
    fields: ['source_name', 'location', 'ph_level', 'turbidity', 'contaminant', 'contaminant_level', 'safe_limit', 'status', 'sample_date'],
    columns: ['source_name', 'location', 'contaminant', 'contaminant_level', 'status', 'sample_date'],
    fieldTypes: { ph_level: 'number', turbidity: 'number', contaminant_level: 'number', safe_limit: 'number', sample_date: 'date', status: { type: 'select', options: ['Safe','Warning','Unsafe'] } }
  },
  { key: 'air-quality', label: 'Air Quality', icon: '🌬️', color: 'yellow', apiPath: '/air-quality', aiEndpoint: 'ai-analyze', aiBulk: 'ai/health-impact', aiBulkLabel: 'Health Impact Assessment',
    fields: ['station_name', 'location', 'aqi_value', 'pm25', 'pm10', 'ozone', 'co_level', 'category', 'reading_date'],
    columns: ['station_name', 'location', 'aqi_value', 'pm25', 'category', 'reading_date'],
    fieldTypes: { aqi_value: 'number', pm25: 'number', pm10: 'number', ozone: 'number', co_level: 'number', reading_date: 'date', category: { type: 'select', options: ['Good','Moderate','Unhealthy for Sensitive','Unhealthy','Very Unhealthy','Hazardous'] } }
  },
  { key: 'hospital-capacity', label: 'Hospital Capacity', icon: '🏥', color: 'blue', apiPath: '/hospital-capacity', aiEndpoint: 'ai-analyze', aiBulk: 'ai/demand-forecast', aiBulkLabel: 'Demand Forecast',
    fields: ['hospital_name', 'region', 'total_beds', 'occupied_beds', 'icu_total', 'icu_occupied', 'ventilators_total', 'ventilators_in_use', 'status', 'report_date'],
    columns: ['hospital_name', 'region', 'total_beds', 'occupied_beds', 'icu_occupied', 'status'],
    fieldTypes: { total_beds: 'number', occupied_beds: 'number', icu_total: 'number', icu_occupied: 'number', ventilators_total: 'number', ventilators_in_use: 'number', report_date: 'date', status: { type: 'select', options: ['Normal','Warning','Near Capacity','Critical'] } }
  },
  { key: 'mortality', label: 'Mortality Statistics', icon: '📈', color: 'red', apiPath: '/mortality', aiEndpoint: 'ai-analyze', aiBulk: 'ai/trend-analysis', aiBulkLabel: 'Trend Analysis',
    fields: ['region', 'cause_of_death', 'age_group', 'gender', 'count', 'population', 'rate_per_100k', 'report_date', 'trend'],
    columns: ['region', 'cause_of_death', 'age_group', 'count', 'rate_per_100k', 'trend'],
    fieldTypes: { count: 'number', population: 'number', rate_per_100k: 'number', report_date: 'date', gender: { type: 'select', options: ['Male','Female','Both'] }, trend: { type: 'select', options: ['Increasing','Stable','Declining'] } }
  },
  { key: 'disease-reports', label: 'Disease Reports', icon: '📋', color: 'yellow', apiPath: '/disease-reports', aiEndpoint: 'ai-analyze', aiBulk: 'ai/classification', aiBulkLabel: 'AI Classification',
    fields: ['disease_name', 'icd_code', 'reporting_facility', 'patient_age', 'patient_gender', 'diagnosis_date', 'report_date', 'severity', 'lab_confirmed', 'notes'],
    columns: ['disease_name', 'icd_code', 'reporting_facility', 'severity', 'lab_confirmed', 'report_date'],
    fieldTypes: { patient_age: 'number', diagnosis_date: 'date', report_date: 'date', severity: { type: 'select', options: ['Mild','Moderate','Severe','Critical'] }, lab_confirmed: { type: 'select', options: ['true','false'] }, patient_gender: { type: 'select', options: ['Male','Female'] }, notes: 'textarea' }
  },
  { key: 'amr', label: 'Antimicrobial Resistance', icon: '🧬', color: 'purple', apiPath: '/amr', aiEndpoint: 'ai-analyze', aiBulk: 'ai/resistance-trends', aiBulkLabel: 'Resistance Trends',
    fields: ['organism', 'antibiotic', 'resistance_pattern', 'facility', 'specimen_type', 'mic_value', 'interpretation', 'test_date', 'patient_age'],
    columns: ['organism', 'antibiotic', 'resistance_pattern', 'interpretation', 'facility', 'test_date'],
    fieldTypes: { test_date: 'date', patient_age: 'number', resistance_pattern: { type: 'select', options: ['Resistant','Intermediate','Sensitive'] }, interpretation: { type: 'select', options: ['R','I','S'] } }
  },
  { key: 'vector-diseases', label: 'Vector-Borne Diseases', icon: '🦟', color: 'green', apiPath: '/vector-diseases', aiEndpoint: 'ai-analyze', aiBulk: 'ai/habitat-risk', aiBulkLabel: 'Habitat Risk Analysis',
    fields: ['disease_name', 'vector_type', 'location', 'cases_count', 'season', 'habitat_risk', 'control_measures', 'report_date', 'status'],
    columns: ['disease_name', 'vector_type', 'location', 'cases_count', 'habitat_risk', 'status'],
    fieldTypes: { cases_count: 'number', report_date: 'date', habitat_risk: { type: 'select', options: ['Low','Medium','High'] }, status: { type: 'select', options: ['Active','Monitoring','Contained'] }, control_measures: 'textarea' }
  },
  { key: 'health-equity', label: 'Health Equity', icon: '⚖️', color: 'teal', apiPath: '/health-equity', aiEndpoint: 'ai-analyze', aiBulk: 'ai/disparity-analysis', aiBulkLabel: 'Disparity Analysis',
    fields: ['indicator', 'region', 'demographic_group', 'value', 'benchmark', 'disparity_ratio', 'data_source', 'report_date', 'notes'],
    columns: ['indicator', 'region', 'demographic_group', 'disparity_ratio', 'data_source', 'report_date'],
    fieldTypes: { value: 'number', benchmark: 'number', disparity_ratio: 'number', report_date: 'date', notes: 'textarea' }
  },
];

export { API, FEATURES };

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogin = (tokenVal, userData) => {
    localStorage.setItem('token', tokenVal);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(tokenVal);
    setUser(userData);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" />} />
          // === Batch 07 Gaps & Frontend Mounts ===
          <Route path='/cf-nowcast-case-trajectory' element={<CfNowcastCaseTrajectory />} />
          <Route path='/cf-variant-tracking-forecasting' element={<CfVariantTrackingForecasting />} />
          <Route path='/cf-equityaware-resource-allocation' element={<CfEquityawareResourceAllocation />} />
          <Route path='/cf-social-determinants-rag' element={<CfSocialDeterminantsRag />} />
          <Route path='/cf-multilanguage-health-messaging' element={<CfMultilanguageHealthMessaging />} />
          <Route path='/cf-zoonotic-spillover-risk-model' element={<CfZoonoticSpilloverRiskModel />} />
          <Route path='/gap-no-outbreakprediction-spatialtemporal-modeli' element={<GapNoOutbreakpredictionSpatialtemporalModeli />} />
          <Route path='/gap-no-equitygapanalysis-disparities-by-demograp' element={<GapNoEquitygapanalysisDisparitiesByDemograp />} />
          <Route path='/gap-no-interventionrecommendation-evidencebased' element={<GapNoInterventionrecommendationEvidencebased />} />
          <Route path='/gap-no-caseclustering-anomaly-detection' element={<GapNoCaseclusteringAnomalyDetection />} />
          <Route path='/gap-no-vaccinationcoverageforecast' element={<GapNoVaccinationcoverageforecast />} />
          <Route path='/gap-no-resourceallocation-ai' element={<GapNoResourceallocationAi />} />
          <Route path='/gap-no-realtime-outbreak-mapdashboard-route' element={<GapNoRealtimeOutbreakMapdashboardRoute />} />
          <Route path='/gap-no-case-linelist-deduplication-workflow' element={<GapNoCaseLinelistDeduplicationWorkflow />} />
          <Route path='/gap-no-syndromic-surveillance-ingestion-ed-otc-p' element={<GapNoSyndromicSurveillanceIngestionEdOtcP />} />
          <Route path='/gap-no-cdcstate-healthdepartment-api-integration' element={<GapNoCdcstateHealthdepartmentApiIntegration />} />
          <Route path='/gap-no-contact-tracing-workflow-beyond-data-stor' element={<GapNoContactTracingWorkflowBeyondDataStor />} />
          <Route path='/gap-no-notificationssms-push-for-alerts' element={<GapNoNotificationssmsPushForAlerts />} />
          <Route path='/gap-no-reportingexport-csvpdf' element={<GapNoReportingexportCsvpdf />} />
          <Route path='/gap-no-rbac-for-clinical-vs-admin-roles' element={<GapNoRbacForClinicalVsAdminRoles />} />
          // === End Batch 07 ===
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar features={FEATURES} user={user} onLogout={handleLogout} currentPath={location.pathname} />
      <div className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard features={FEATURES} />} />
          <Route path="/ai-center" element={<AICenter />} />
          <Route path="/ai-history" element={<AIHistory />} />
          <Route path="/alert-subscriptions" element={<AlertSubscriptions />} />
          <Route path="/case-clustering" element={<CaseClustering />} />
          <Route path="/outbreak-intervention" element={<OutbreakIntervention />} />
          <Route path="/custom-views" element={<CustomViewsPage />} />
          {FEATURES.map(f => (
            <Route key={f.key} path={`/${f.key}`} element={<FeaturePage feature={f} />} />
          ))}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
