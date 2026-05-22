import SurveillanceFeaturePage from './SurveillanceFeaturePage';

const feature = {
  slug: 'genomic-sequencing',
  label: 'Genomic Sequencing',
  icon: '🧬',
  description: 'Track pathogen genomic sequences, variants, lineages, and evolutionary dynamics',
  fields: [
    'sample_id', 'pathogen', 'lineage', 'variant_name', 'collection_date', 'region', 'country',
    'accession_number', 'genome_coverage', 'sequencing_depth', 'quality_score', 'mutations',
    'spike_mutations', 'nextstrain_clade', 'gisaid_clade', 'sequencing_platform', 'lab_id',
    'is_novel_variant', 'clinical_outcome', 'status', 'notes',
  ],
  columns: ['sample_id', 'pathogen', 'lineage', 'variant_name', 'region', 'collection_date', 'status'],
  fieldTypes: {
    collection_date: 'date',
    genome_coverage: 'number',
    sequencing_depth: 'number',
    quality_score: 'number',
    is_novel_variant: 'checkbox',
    mutations: 'textarea',
    spike_mutations: 'textarea',
    notes: 'textarea',
    clinical_outcome: { type: 'select', options: ['Mild', 'Moderate', 'Severe', 'Critical', 'Unknown'] },
    status: { type: 'select', options: ['active', 'inactive', 'deleted'] },
  },
  aiVerbs: [
    { name: 'classify-variant-risk', label: 'Classify Variant Risk', fields: ['variant_name', 'mutations', 'lineage', 'region'] },
    { name: 'predict-immune-escape', label: 'Predict Immune Escape', fields: ['spike_mutations', 'variant_name', 'vaccine_background'] },
    { name: 'summarize-lineage-spread', label: 'Summarize Lineage Spread', fields: ['lineage', 'region', 'time_period', 'sequence_count'] },
    { name: 'detect-novel-mutations', label: 'Detect Novel Mutations', fields: ['mutations', 'pathogen', 'known_variants'] },
    { name: 'recommend-sequencing-priority', label: 'Recommend Sequencing Priority', fields: ['region', 'outbreak_status', 'current_capacity'] },
    { name: 'compare-variants', label: 'Compare Variants', fields: ['variant_a', 'variant_b', 'comparison_criteria'] },
    { name: 'predict-transmission-advantage', label: 'Predict Transmission Advantage', fields: ['lineage', 'growth_rate', 'frequency_data'] },
    { name: 'generate-phylogenetic-narrative', label: 'Generate Phylogenetic Narrative', fields: ['pathogen', 'lineages', 'region', 'time_period'] },
    { name: 'score-sequence-quality', label: 'Score Sequence Quality', fields: ['genome_coverage', 'sequencing_depth', 'quality_score'] },
    { name: 'assess-vaccine-mismatch', label: 'Assess Vaccine Mismatch', fields: ['variant_name', 'spike_mutations', 'vaccine_strain'] },
    { name: 'predict-clinical-severity', label: 'Predict Clinical Severity', fields: ['variant_name', 'mutations', 'population_immunity'] },
    { name: 'summarize-regional-diversity', label: 'Summarize Regional Diversity', fields: ['region', 'lineage_distribution', 'time_period'] },
    { name: 'detect-recombination-event', label: 'Detect Recombination Event', fields: ['sample_id', 'mutations', 'parent_lineages'] },
    { name: 'recommend-surveillance-targets', label: 'Recommend Surveillance Targets', fields: ['pathogen', 'current_variants', 'region'] },
    { name: 'generate-variant-report', label: 'Generate Variant Report', fields: ['region', 'dominant_variants', 'time_period', 'audience'] },
    { name: 'assess-gisaid-submission-readiness', label: 'Assess GISAID Submission Readiness', fields: ['sample_id', 'genome_coverage', 'metadata_completeness'] },
  ],
};

export default function SurvGenomicSequencing() {
  return <SurveillanceFeaturePage feature={feature} />;
}
