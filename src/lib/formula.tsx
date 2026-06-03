import type { FormulaRecommendation, MetricFormula, MonthRuleTemplate, MonthlyChangeRecord, NewConfigItem, PriceComparison } from '../types';

export function textValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function buildRecordKey(month: string, metricId: string, recordType: string) {
  return `${month}::${recordType}::${metricId}`;
}

export function createRecordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getMetricTitle(metric: MetricFormula) {
  return [metric.category, metric.detail].filter(Boolean).join(' / ') || metric.metricId;
}

export function metricMatchesSearch(metric: MetricFormula, search: string) {
  if (!search.trim()) return true;
  const haystack = [
    metric.metricId,
    metric.board,
    metric.category,
    metric.detail,
    metric.originalFormula,
    metric.formulaDescription,
    metric.formulaAdvice2026,
    metric.priceChangeConclusion,
    metric.unitAttention,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

export function getRecordForMetric(records: MonthlyChangeRecord[], month: string, metricId: string, recordType = 'formula') {
  return records.find((record) => record.month === month && record.metricId === metricId && record.recordType === recordType);
}

export function getRelatedPriceComparison(metric: MetricFormula, comparisons: PriceComparison[]) {
  return comparisons.find((item) => {
    const combined = `${item.metric2025} ${item.metric2026} ${item.formulaRelation} ${item.configAdvice}`;
    return (
      (!!metric.match2025 && combined.includes(metric.match2025)) ||
      (!!metric.match2026 && combined.includes(metric.match2026)) ||
      (!!metric.category && combined.includes(metric.category))
    );
  });
}

export function getRelatedRecommendations(metric: MetricFormula, recommendations: FormulaRecommendation[]) {
  return recommendations.filter((item) => item.relatedMetrics.includes(metric.metricId) || item.advice.includes(metric.metricId));
}

export function getRelatedMonthRules(metric: MetricFormula, rules: MonthRuleTemplate[]) {
  return rules.filter((rule) => rule.applicableMetrics.includes(metric.metricId) || metric.originalFormula.includes('/12') || metric.originalFormula.includes('IF['));
}

export function riskRank(riskLevel: string) {
  if (riskLevel === '高') return 0;
  if (riskLevel === '中') return 1;
  if (riskLevel === '低') return 2;
  return 3;
}

export function extractMetricIds(text: string) {
  return Array.from(new Set(text.match(/M\d{7}/g) ?? []));
}

export function getNewConfigSyntheticId(item: NewConfigItem) {
  return `NEW-${item.sequence}-${item.metricName2026}`;
}

export function detectFormulaWarnings(metric: MetricFormula) {
  const formula = metric.originalFormula;
  const warnings = [];
  if (metric.riskLevel === '高') warnings.push('高风险项，优先复核');
  if (formula.includes('/10000') || metric.currentUnitJudgement.includes('万元') || metric.unitAttention.includes('万元')) warnings.push('涉及万元口径');
  if (formula.includes('IF[') && !formula.includes('<=') && !formula.includes('=0')) warnings.push('IF 分支需关注等于 0');
  if (formula.includes('/12') || metric.formulaAdvice2026.includes('/12')) warnings.push('涉及月度折算');
  if (metric.priceChangeConclusion.includes('→') || metric.formulaAdvice2026.includes('调')) warnings.push('涉及 25→26 单价切换');
  return Array.from(new Set(warnings));
}
