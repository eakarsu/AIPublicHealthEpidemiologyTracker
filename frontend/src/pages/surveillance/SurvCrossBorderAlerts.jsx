import SurveillanceFeaturePage from './SurveillanceFeaturePage';

const feature = {
  slug: 'cross-border-alerts',
  label: 'Cross-Border Alerts',
  icon: '🚨',
  description: 'Track and manage cross-border disease importation risks and bilateral health cooperation',
  fields: [
    'alert_id', 'alert_title', 'origin_country', 'destination_country', 'corridor', 'pathogen',
    'threat_type', 'imported_cases', 'local_cases', 'detection_date', 'alert_date',
    'threat_imminence_score', 'cooperation_readiness_score', 'poe_readiness', 'traveler_advisory_issued',
    'joint_investigation_status', 'bilateral_communication_status', 'vector_shared',
    'risk_by_corridor', 'importation_likelihood', 'screening_measures', 'alert_level', 'status', 'notes',
  ],
  columns: ['alert_id', 'origin_country', 'destination_country', 'pathogen', 'alert_level', 'alert_date', 'threat_imminence_score'],
  fieldTypes: {
    detection_date: 'date',
    alert_date: 'date',
    imported_cases: 'number',
    local_cases: 'number',
    threat_imminence_score: 'number',
    cooperation_readiness_score: 'number',
    importation_likelihood: 'number',
    traveler_advisory_issued: 'checkbox',
    vector_shared: 'checkbox',
    alert_title: 'textarea',
    screening_measures: 'textarea',
    notes: 'textarea',
    alert_level: { type: 'select', options: ['informational', 'watch', 'warning', 'alert', 'emergency'] },
    threat_type: { type: 'select', options: ['infectious_disease', 'vector_borne', 'foodborne', 'chemical', 'radiological'] },
    joint_investigation_status: { type: 'select', options: ['not_started', 'planned', 'active', 'concluded', 'cancelled'] },
    bilateral_communication_status: { type: 'select', options: ['pending', 'initiated', 'ongoing', 'completed', 'stalled'] },
    poe_readiness: { type: 'select', options: ['not_ready', 'partial', 'ready', 'enhanced'] },
    status: { type: 'select', options: ['active', 'inactive', 'deleted'] },
  },
  aiVerbs: [
    { name: 'assess-importation-risk', label: 'Assess Importation Risk', fields: ['origin_country', 'pathogen', 'travel_volume', 'incidence_rate'] },
    { name: 'recommend-poe-screening', label: 'Recommend POE Screening', fields: ['alert_id', 'pathogen', 'poe_readiness', 'importation_likelihood'] },
    { name: 'classify-threat-level', label: 'Classify Threat Level', fields: ['alert_id', 'imported_cases', 'local_cases', 'r_effective'] },
    { name: 'generate-alert-bulletin', label: 'Generate Alert Bulletin', fields: ['alert_id', 'pathogen', 'corridor', 'audience'] },
    { name: 'recommend-bilateral-actions', label: 'Recommend Bilateral Actions', fields: ['origin_country', 'destination_country', 'pathogen', 'cooperation_status'] },
    { name: 'predict-local-transmission-risk', label: 'Predict Local Transmission Risk', fields: ['imported_cases', 'pathogen', 'population_density', 'immunity_level'] },
    { name: 'assess-traveler-advisory-need', label: 'Assess Traveler Advisory Need', fields: ['alert_id', 'threat_level', 'travel_volume'] },
    { name: 'summarize-corridor-epidemiology', label: 'Summarize Corridor Epidemiology', fields: ['corridor', 'pathogen', 'time_period'] },
    { name: 'recommend-vector-control', label: 'Recommend Vector Control', fields: ['pathogen', 'vector_shared', 'corridor', 'season'] },
    { name: 'classify-cooperation-readiness', label: 'Classify Cooperation Readiness', fields: ['origin_country', 'destination_country', 'ihr_capacity'] },
    { name: 'predict-spread-timeline', label: 'Predict Spread Timeline', fields: ['pathogen', 'r_effective', 'travel_volume', 'poe_measures'] },
    { name: 'generate-joint-investigation-plan', label: 'Generate Joint Investigation Plan', fields: ['alert_id', 'countries_involved', 'pathogen'] },
    { name: 'assess-economic-impact', label: 'Assess Economic Impact', fields: ['alert_id', 'corridor', 'trade_volume', 'travel_restrictions'] },
    { name: 'recommend-communication-strategy', label: 'Recommend Communication Strategy', fields: ['alert_id', 'audience_countries', 'alert_level'] },
    { name: 'classify-outbreak-origin', label: 'Classify Outbreak Origin', fields: ['origin_country', 'case_timeline', 'travel_history'] },
    { name: 'summarize-regional-risk', label: 'Summarize Regional Risk', fields: ['region', 'active_alerts', 'pathogen_threats'] },
  ],
};

export default function SurvCrossBorderAlerts() {
  return <SurveillanceFeaturePage feature={feature} />;
}
