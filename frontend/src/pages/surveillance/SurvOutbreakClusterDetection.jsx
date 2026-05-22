import SurveillanceFeaturePage from './SurveillanceFeaturePage';

const feature = {
  slug: 'outbreak-cluster-detection',
  label: 'Outbreak Cluster Detection',
  icon: '🔍',
  description: 'Detect spatiotemporal outbreak clusters using scan statistics and spatial analysis',
  fields: [
    'cluster_id', 'pathogen', 'region', 'sub_region', 'latitude', 'longitude', 'radius_km',
    'case_count', 'expected_count', 'scan_statistic', 'p_value', 'cluster_start', 'cluster_end',
    'cluster_type', 'source_hypothesis', 'investigation_status', 'confidence_score', 'priority_score',
    'control_measures', 'status', 'notes',
  ],
  columns: ['cluster_id', 'pathogen', 'region', 'case_count', 'investigation_status', 'cluster_start', 'priority_score'],
  fieldTypes: {
    cluster_start: 'date',
    cluster_end: 'date',
    latitude: 'number',
    longitude: 'number',
    radius_km: 'number',
    case_count: 'number',
    expected_count: 'number',
    scan_statistic: 'number',
    p_value: 'number',
    confidence_score: 'number',
    priority_score: 'number',
    source_hypothesis: 'textarea',
    control_measures: 'textarea',
    notes: 'textarea',
    investigation_status: { type: 'select', options: ['pending', 'active', 'concluded', 'closed'] },
    cluster_type: { type: 'select', options: ['spatial', 'temporal', 'spatiotemporal', 'network'] },
    status: { type: 'select', options: ['active', 'inactive', 'deleted'] },
  },
  aiVerbs: [
    { name: 'assess-cluster-significance', label: 'Assess Cluster Significance', fields: ['cluster_id', 'p_value', 'scan_statistic', 'case_count'] },
    { name: 'identify-source-hypothesis', label: 'Identify Source Hypothesis', fields: ['pathogen', 'cluster_id', 'geographic_data', 'case_timeline'] },
    { name: 'recommend-investigation-steps', label: 'Recommend Investigation Steps', fields: ['cluster_id', 'pathogen', 'investigation_status'] },
    { name: 'prioritize-clusters', label: 'Prioritize Clusters', fields: ['clusters', 'resource_constraints'] },
    { name: 'predict-cluster-growth', label: 'Predict Cluster Growth', fields: ['cluster_id', 'case_trend', 'control_measures'] },
    { name: 'generate-cluster-narrative', label: 'Generate Cluster Narrative', fields: ['cluster_id', 'pathogen', 'region', 'timeline'] },
    { name: 'assess-control-measure-effectiveness', label: 'Assess Control Measure Effectiveness', fields: ['cluster_id', 'control_measures', 'case_trend'] },
    { name: 'detect-secondary-clusters', label: 'Detect Secondary Clusters', fields: ['primary_cluster_id', 'geographic_radius', 'time_window'] },
    { name: 'classify-exposure-type', label: 'Classify Exposure Type', fields: ['pathogen', 'case_distribution', 'common_exposures'] },
    { name: 'recommend-contact-tracing-scope', label: 'Recommend Contact Tracing Scope', fields: ['cluster_id', 'case_count', 'transmission_mode'] },
    { name: 'summarize-cluster-epidemiology', label: 'Summarize Cluster Epidemiology', fields: ['cluster_id', 'demographic_data', 'exposure_data'] },
    { name: 'predict-final-cluster-size', label: 'Predict Final Cluster Size', fields: ['cluster_id', 'current_count', 'growth_rate'] },
    { name: 'assess-reporting-completeness', label: 'Assess Reporting Completeness', fields: ['cluster_id', 'expected_count', 'actual_count'] },
    { name: 'generate-who-report', label: 'Generate WHO Report', fields: ['cluster_id', 'pathogen', 'case_summary', 'control_status'] },
    { name: 'compare-historical-clusters', label: 'Compare Historical Clusters', fields: ['cluster_id', 'pathogen', 'historical_clusters'] },
    { name: 'score-environmental-risk', label: 'Score Environmental Risk', fields: ['region', 'pathogen', 'environmental_factors'] },
  ],
};

export default function SurvOutbreakClusterDetection() {
  return <SurveillanceFeaturePage feature={feature} />;
}
