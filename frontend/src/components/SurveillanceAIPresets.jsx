import { useState } from 'react';
const ref = key => /(?:_id|_ids)$/.test(key);
const present = value => value !== undefined && value !== null && String(value).trim() !== '';
export function surveillanceExample(feature, verb, records, selected, current, variant) {
  const record = selected || records[variant % records.length] || {};
  const missing = [];
  const values = Object.fromEntries(verb.fields.map(key => {
    if (ref(key)) {
      const available = records.map(row => row[key] ?? (key === 'primary_cluster_id' ? row.cluster_id : undefined)).filter(present);
      const chosen = available.some(value => String(value) === String(current[key])) ? current[key] : record[key] ?? (key === 'primary_cluster_id' ? record.cluster_id : undefined);
      if (!present(chosen)) missing.push(key.replace(/_/g, ' '));
      return [key, present(chosen) ? String(chosen) : current[key] || ''];
    }
    if (present(record[key])) return [key, typeof record[key] === 'object' ? JSON.stringify(record[key]) : String(record[key])];
    const type=feature.fieldTypes?.[key];
    if (type?.type === 'select' && type.options?.length) return [key, type.options[variant % type.options.length]];
    if (type === 'checkbox' || /^(?:anomaly_detected|vector_shared)$/.test(key)) return [key, 'false'];
    if (/series|_data$|_counts$|_distribution$|_scores$|_signals$|_values$/.test(key)) return [key, JSON.stringify([{day:1,value:10},{day:2,value:12},{day:3,value:11}])];
    if (/date|week_ending|^(?:analysis|collection)_time$/.test(key)) return [key, new Date(Date.now() - (variant+1)*86400000).toISOString().slice(0,10)];
    if (/^p_value$|rate|probability|fraction|likelihood|effectiveness|immunity|r_effective|r_zero/.test(key)) return [key, String([0.2,0.4,0.6][variant])];
    if (/count|volume|population|capacity|days|lag|score|strength|depth|concentration|frequency|interval|coverage|radius|flow|time_window|generation_time/.test(key)) return [key, String([10,25,50][variant])];
    if (/^pathogen$/.test(key)) return [key, ['Influenza A','SARS-CoV-2','RSV'][variant]];
    if (/^audience/.test(key)) return [key, ['Public health analysts','Response planning team','Review committee'][variant]];
    if (/data|series|counts|distribution|scores|signals|values/.test(key)) return [key, JSON.stringify([{day:1,value:10},{day:2,value:12},{day:3,value:11}])];
    return [key, `Fictional planning example for ${feature.label}: review ${key.replace(/_/g,' ')} for ${['initial assessment','team planning','detailed review'][variant]}. Identify missing evidence and assumptions; confirm actual observations before applying recommendations.`];
  }));
  return { values, missing };
}
export default function SurveillanceAIPresets({ feature, verb, sourceRecords, selectedRecord, values, onFill, disabled }) {
  const [notice,setNotice]=useState('');
  return <section className="native-ai-controls"><div><strong>Fill all AI fields</strong><p>Examples include optional context and preserve valid source references.</p></div><div className="native-ai-control-buttons">{['Initial assessment','Team planning','Detailed review'].map((label,index)=><button type="button" key={label} disabled={disabled} onClick={()=>{const result=surveillanceExample(feature,verb,sourceRecords,selectedRecord,values,index);onFill(result.values);setNotice(result.missing.length?'Select actual '+result.missing.join(', ')+' before using record references.':'All fields filled. Review the supplied context before running.');}}>{label}</button>)}</div>{notice&&<p role="status">{notice}</p>}</section>;
}
