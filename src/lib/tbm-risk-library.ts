export interface RiskLibraryItem {
  id: string; category: string; subcategory: string; hazard_description: string;
  accident_type: string; frequency: number; severity: number; risk_level: number;
  preventive_measure: string; is_critical: boolean; source_id: string; source_row: number | null;
}
export interface RiskLibrarySource { id: string; name: string; sheet: string; range: string }
export function filterRiskLibrary(items: RiskLibraryItem[], filters: {
  source: string; category: string; subcategory: string; critical: boolean; query: string;
}) {
  const words = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    if (filters.source && item.source_id !== filters.source) return false;
    if (filters.category && item.category !== filters.category) return false;
    if (filters.subcategory && item.subcategory !== filters.subcategory) return false;
    if (filters.critical && !item.is_critical) return false;
    const text = [item.category,item.subcategory,item.hazard_description,item.accident_type,item.preventive_measure].join(' ').toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}
export function riskLibraryDraft(items: RiskLibraryItem[], selected: Set<string>) {
  // Source text remains Korean; the existing TBM translation pipeline translates the final draft.
  return items.filter(item => selected.has(item.id)).map(item =>
    `[${item.category} / ${item.subcategory}]\n위험요인: ${item.hazard_description}\n관리계획: ${item.preventive_measure}`
  ).join('\n\n');
}
