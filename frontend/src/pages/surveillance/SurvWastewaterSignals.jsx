import SurveillanceFeaturePage from './SurveillanceFeaturePage';

const feature = {
  slug: 'wastewater-signals',
  label: 'Wastewater Signals',
  icon: '🧪',
  description: 'Monitor pathogen concentrations in wastewater for early outbreak detection',
  fields: [
    'site_id', 'treatment_plant', 'region', 'sample_date', 'pathogen', 'concentration',
    'concentration_unit', 'flow_rate', 'population_served', 'pmmov_value', 'normalized_value',
    'sample_quality_score', 'collection_method', 'lab_id', 'status', 'notes',
  ],
  columns: ['site_id', 'treatment_plant', 'region', 'pathogen', 'concentration', 'sample_date', 'status'],
  fieldTypes: {
    sample_date: 'date',
    concentration: 'number',
    flow_rate: 'number',
    population_served: 'number',
    pmmov_value: 'number',
    normalized_value: 'number',
    sample_quality_score: 'number',
    notes: 'textarea',
    status: { type: 'select', options: ['active', 'inactive', 'deleted'] },
  },
  aiVerbs: [
    { name: 'detect-signal-anomaly', label: 'Detect Signal Anomaly', fields: ['signal_id', 'region', 'pathogen', 'recent_values'] },
    { name: 'classify-pathogen-pattern', label: 'Classify Pathogen Pattern', fields: ['pathogen', 'time_series', 'region'] },
    { name: 'predict-clinical-cases-lag', label: 'Predict Clinical Cases (Lag)', fields: ['pathogen', 'concentration', 'region', 'lag_days'] },
    { name: 'recommend-sampling-frequency', label: 'Recommend Sampling Frequency', fields: ['site_id', 'current_frequency', 'signal_volatility', 'outbreak_risk'] },
    { name: 'score-signal-quality', label: 'Score Signal Quality', fields: ['signal_id', 'pmmov_value', 'concentration', 'collection_method', 'lab_id'] },
    { name: 'generate-trend-narrative', label: 'Generate Trend Narrative', fields: ['region', 'pathogen', 'time_series', 'audience'] },
    { name: 'summarize-treatment-plant', label: 'Summarize Treatment Plant', fields: ['treatment_plant', 'signals'] },
    { name: 'validate-normalization', label: 'Validate Normalization', fields: ['raw_concentration', 'pmmov_value', 'flow_rate', 'normalization_method'] },
    { name: 'suggest-pmmov-correction', label: 'Suggest PMMoV Correction', fields: ['pmmov_values', 'site_id', 'season'] },
    { name: 'detect-sample-degradation', label: 'Detect Sample Degradation', fields: ['sample_id', 'collection_time', 'analysis_time', 'storage_temp'] },
    { name: 'classify-shedding-rate', label: 'Classify Shedding Rate', fields: ['pathogen', 'concentration', 'population_served', 'clinical_cases'] },
    { name: 'predict-outbreak-pressure', label: 'Predict Outbreak Pressure', fields: ['region', 'pathogen', 'signal_trend', 'clinical_lag'] },
    { name: 'recommend-confirmatory-testing', label: 'Recommend Confirmatory Testing', fields: ['pathogen', 'signal_strength', 'anomaly_detected', 'region'] },
    { name: 'generate-public-bulletin', label: 'Generate Public Bulletin', fields: ['region', 'pathogen', 'signal_summary', 'alert_level'] },
    { name: 'score-catchment-coverage', label: 'Score Catchment Coverage', fields: ['site_id', 'population_served', 'total_region_population'] },
    { name: 'summarize-multi-pathogen-trend', label: 'Multi-Pathogen Trend Summary', fields: ['region', 'pathogen_signals', 'time_period'] },
  ],
};

export default function SurvWastewaterSignals() {
  return <SurveillanceFeaturePage feature={feature} />;
}
