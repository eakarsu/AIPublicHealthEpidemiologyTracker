import SurveillanceFeaturePage from './SurveillanceFeaturePage';

const feature = {
  slug: 'syndromic-surveillance',
  label: 'Syndromic Surveillance',
  icon: '📡',
  description: 'Monitor emergency department visit patterns and chief complaint syndromes',
  fields: [
    'facility_id', 'facility_name', 'facility_type', 'region', 'report_date', 'syndrome_category',
    'chief_complaint_text', 'icd10_codes', 'age_group', 'sex', 'visit_count', 'total_ed_visits',
    'percent_syndrome', 'signal_strength_score', 'data_timeliness_score', 'status', 'notes',
  ],
  columns: ['facility_name', 'region', 'syndrome_category', 'visit_count', 'signal_strength_score', 'report_date', 'status'],
  fieldTypes: {
    report_date: 'date',
    visit_count: 'number',
    total_ed_visits: 'number',
    percent_syndrome: 'number',
    signal_strength_score: 'number',
    data_timeliness_score: 'number',
    chief_complaint_text: 'textarea',
    icd10_codes: 'textarea',
    notes: 'textarea',
    sex: { type: 'select', options: ['Male', 'Female', 'Unknown', 'All'] },
    age_group: { type: 'select', options: ['0-4', '5-17', '18-44', '45-64', '65+', 'All Ages'] },
    facility_type: { type: 'select', options: ['Emergency Department', 'Urgent Care', 'Primary Care', 'Hospital', 'Clinic'] },
    status: { type: 'select', options: ['active', 'inactive', 'deleted'] },
  },
  aiVerbs: [
    { name: 'detect-syndrome-anomaly', label: 'Detect Syndrome Anomaly', fields: ['facility_id', 'syndrome_category', 'visit_count', 'baseline'] },
    { name: 'classify-symptom-cluster', label: 'Classify Symptom Cluster', fields: ['chief_complaints', 'region', 'time_period'] },
    { name: 'predict-disease-causing-syndrome', label: 'Predict Disease from Syndrome', fields: ['syndrome_category', 'age_group', 'season'] },
    { name: 'recommend-investigation', label: 'Recommend Investigation', fields: ['signal_strength_score', 'region', 'syndrome_category'] },
    { name: 'score-signal-strength', label: 'Score Signal Strength', fields: ['visit_count', 'total_ed_visits', 'baseline_count', 'region'] },
    { name: 'generate-alert-narrative', label: 'Generate Alert Narrative', fields: ['region', 'syndrome_category', 'signal_data', 'audience'] },
    { name: 'summarize-ed-visits', label: 'Summarize ED Visits', fields: ['facility_id', 'date_range', 'syndrome_categories'] },
    { name: 'validate-chief-complaint-coding', label: 'Validate Chief Complaint Coding', fields: ['chief_complaint_text', 'icd10_codes', 'syndrome_category'] },
    { name: 'suggest-syndrome-definition-refinement', label: 'Refine Syndrome Definition', fields: ['syndrome_category', 'current_definition', 'false_positive_rate'] },
    { name: 'detect-bias-by-facility', label: 'Detect Facility Bias', fields: ['facility_id', 'reporting_rate', 'region'] },
    { name: 'classify-age-group-pattern', label: 'Classify Age Group Pattern', fields: ['syndrome_category', 'age_distribution', 'time_period'] },
    { name: 'predict-seasonal-shift', label: 'Predict Seasonal Shift', fields: ['syndrome_category', 'historical_data', 'current_season'] },
    { name: 'recommend-data-source-addition', label: 'Recommend Data Source Addition', fields: ['current_sources', 'coverage_gaps', 'region'] },
    { name: 'generate-weekly-report', label: 'Generate Weekly Report', fields: ['region', 'week_ending', 'syndrome_summaries'] },
    { name: 'score-data-timeliness', label: 'Score Data Timeliness', fields: ['facility_id', 'report_date', 'expected_date'] },
    { name: 'summarize-spatial-pattern', label: 'Summarize Spatial Pattern', fields: ['region', 'syndrome_category', 'facility_data'] },
  ],
};

export default function SurvSyndromicSurveillance() {
  return <SurveillanceFeaturePage feature={feature} />;
}
