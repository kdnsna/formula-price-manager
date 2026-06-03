import type {
  AnnualMigrationTask,
  FormulaAnalysis,
  FormulaRuleVersion,
  MetricFormula,
  MonthlySuggestion,
  PriceComparison,
  WorkbookData,
} from '../types';
import { detectFormulaWarnings, getMetricTitle } from './formula';

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function monthNumber(month: string) {
  const value = Number(month.split('-')[1]);
  return Number.isFinite(value) && value >= 1 && value <= 12 ? value : 1;
}

function yearNumber(month: string) {
  const value = Number(month.split('-')[0]);
  return Number.isFinite(value) ? value : 2026;
}

function classifyMonthlyRule(formula: string) {
  if (formula.includes('/12') && formula.includes('IF[')) return 'IF分支 + 月度摊销';
  if (formula.includes('/12')) return '月度摊销';
  if (formula.includes('IF[')) return 'IF分支';
  if (/_p\d+[a-z]?/.test(formula)) return '基础字段取数';
  return '固定或人工确认';
}

export function analyzeFormula(metric: MetricFormula): FormulaAnalysis {
  const formula = metric.originalFormula || '';
  const metricRefs = unique(formula.match(/M\d{7}/g) ?? []);
  const sourceFieldRefs = unique(formula.match(/_p\d+[a-z]?/g) ?? []);
  const coefficients = unique((formula.match(/(?<![A-Za-z_])\d+(?:\.\d+)?(?![A-Za-z])/g) ?? []).filter((value) => value !== '12' && value !== '10000'));
  const hasIfBranch = formula.includes('IF[');
  const hasUnitConversion = formula.includes('/10000') || metric.currentUnitJudgement.includes('万元') || metric.unitAttention.includes('万元');
  const hasMonthlyAmortization = formula.includes('/12');
  const monthlyRuleType = classifyMonthlyRule(formula);
  const manualCheckReasons = buildManualCheckReasons(metric, {
    hasIfBranch,
    hasUnitConversion,
    hasMonthlyAmortization,
    sourceFieldRefs,
  });
  const formulaMeaning = buildFormulaMeaning(metric, {
    metricRefs,
    sourceFieldRefs,
    coefficients,
    hasIfBranch,
    hasUnitConversion,
    hasMonthlyAmortization,
    monthlyRuleType,
  });
  const tokens = [
    ...metricRefs.map((value) => ({ kind: 'metric' as const, value })),
    ...sourceFieldRefs.map((value) => ({ kind: 'sourceField' as const, value })),
    ...coefficients.map((value) => ({ kind: 'number' as const, value })),
    ...(hasIfBranch ? [{ kind: 'ifBranch' as const, value: 'IF[...]' }] : []),
    ...(hasUnitConversion ? [{ kind: 'unitConversion' as const, value: '/10000或万元口径' }] : []),
  ];
  return {
    formulaMeaning,
    formulaTokens: tokens,
    monthlyRuleType,
    manualCheckReasons,
    metricRefs,
    sourceFieldRefs,
    coefficients,
    hasIfBranch,
    hasUnitConversion,
    hasMonthlyAmortization,
  };
}

function buildFormulaMeaning(
  metric: MetricFormula,
  analysis: Pick<FormulaAnalysis, 'metricRefs' | 'sourceFieldRefs' | 'coefficients' | 'hasIfBranch' | 'hasUnitConversion' | 'hasMonthlyAmortization' | 'monthlyRuleType'>,
) {
  const pieces = [];
  const name = getMetricTitle(metric);
  if (metric.formulaType.includes('基础')) {
    pieces.push(`“${name}”是基础指标，主要从源字段或上游数据取数。`);
  } else {
    pieces.push(`“${name}”是积分/派生公式，基于上游指标或源字段生成计价结果。`);
  }
  if (analysis.metricRefs.length) pieces.push(`引用上游派生指标 ${analysis.metricRefs.join('、')}。`);
  if (analysis.sourceFieldRefs.length) pieces.push(`引用基础字段 ${analysis.sourceFieldRefs.join('、')}。`);
  if (analysis.hasUnitConversion) pieces.push('公式涉及万元口径或 /10000 换算，需确认源字段单位。');
  if (analysis.hasMonthlyAmortization) pieces.push('公式含 /12 月度折算，月度滚动时只调整月份序号相关部分。');
  if (analysis.hasIfBranch) pieces.push('公式含 IF 分支，需复核正增长、负增长和等于 0 的处理口径。');
  if (analysis.coefficients.length) pieces.push(`可见系数：${analysis.coefficients.slice(0, 6).join('、')}。`);
  pieces.push(`月度规则类型：${analysis.monthlyRuleType}。`);
  return pieces.join('');
}

function buildManualCheckReasons(
  metric: MetricFormula,
  facts: { hasIfBranch: boolean; hasUnitConversion: boolean; hasMonthlyAmortization: boolean; sourceFieldRefs: string[] },
) {
  const reasons = [];
  if (metric.riskLevel === '高') reasons.push('高风险指标，生成建议后必须人工复核');
  if (facts.hasUnitConversion) reasons.push('涉及万元口径，需确认源字段是否已为万元');
  if (facts.hasIfBranch && !metric.originalFormula.includes('<=') && !metric.originalFormula.includes('=0')) reasons.push('IF 分支未显式覆盖等于 0');
  if (facts.hasMonthlyAmortization) reasons.push('含月度摊销，需确认目标月份 n 与 n-1');
  if (facts.sourceFieldRefs.length && !metric.formulaDescription) reasons.push('源字段含义缺少文字解释');
  if (metric.priceChangeConclusion.includes('→')) reasons.push('存在年度单价或列属性变化，不应在普通月度滚动中改单价');
  if (metric.unitAttention) reasons.push(metric.unitAttention);
  return unique(reasons);
}

export function enrichMetric(metric: MetricFormula): MetricFormula {
  const analysis = analyzeFormula(metric);
  return {
    ...metric,
    formulaMeaning: analysis.formulaMeaning,
    formulaTokens: analysis.formulaTokens,
    monthlyRuleType: analysis.monthlyRuleType,
    manualCheckReasons: analysis.manualCheckReasons,
  };
}

export function enrichWorkbookData(data: WorkbookData): WorkbookData {
  return {
    ...data,
    formulas: data.formulas.map(enrichMetric),
  };
}

function generateMonthlyFormula(formula: string, targetMonth: string) {
  const n = monthNumber(targetMonth);
  const previous = Math.max(n - 1, 0);
  let suggested = formula;
  const changes: string[] = [];

  suggested = suggested.replace(/\/12\*0/g, () => {
    changes.push(`将 /12*0 滚动为 /12*${previous}`);
    return `/12*${previous}`;
  });
  suggested = suggested.replace(/\/12\*1/g, () => {
    changes.push(`将 /12*1 滚动为 /12*${n}`);
    return `/12*${n}`;
  });
  suggested = suggested.replace(/第1月|一月/g, () => {
    changes.push(`文字月份滚动为第${n}月`);
    return `第${n}月`;
  });

  if (!changes.length && formula.includes('/12')) {
    changes.push('含 /12 月度折算但未识别明确月份参数，建议人工确认');
  }
  if (!changes.length && /_p\d+[a-z]?/.test(formula)) {
    changes.push('含基础字段取数，需确认导出字段是否已切换为目标月份');
  }
  if (!changes.length) {
    changes.push('未识别可自动滚动的月份参数，本月可沿用或人工确认');
  }

  return { suggestedFormula: suggested, changes: unique(changes) };
}

export function generateMonthlySuggestions(data: WorkbookData, sourceMonth: string, targetMonth: string): MonthlySuggestion[] {
  const createdAt = new Date().toISOString();
  return data.formulas.map((metric) => {
    const analysis = analyzeFormula(metric);
    const monthly = generateMonthlyFormula(metric.originalFormula, targetMonth);
    const warnings = unique([...detectFormulaWarnings(metric), ...analysis.manualCheckReasons]);
    return {
      id: `${targetMonth}::${metric.metricId}`,
      sourceMonth,
      targetMonth,
      metricId: metric.metricId,
      metricName: getMetricTitle(metric),
      originalFormula: metric.originalFormula,
      suggestedFormula: monthly.suggestedFormula,
      changeSummary: monthly.changes.join('；'),
      formulaMeaning: analysis.formulaMeaning,
      manualCheckReasons: analysis.manualCheckReasons,
      riskWarnings: warnings,
      status: '待复核',
      createdAt,
    };
  });
}

export function createDefaultRuleVersion(data: WorkbookData): FormulaRuleVersion {
  return {
    id: 'rule-version-2026',
    year: 2026,
    name: '2026 计价规则',
    sourceName: data.sourceName,
    importedAt: data.importedAt,
    isActive: true,
    formulaCount: data.formulas.length,
    priceRowCount: data.priceTable2026.length,
    notes: '由当前公式切换总表和 2026 单价表生成的首个年度规则版本。',
  };
}

export function createAnnualMigrationTasks(data: WorkbookData, year = 2026): AnnualMigrationTask[] {
  const fromComparisons = data.priceComparisons
    .filter((item) => item.changeType !== '单价变化/列属性变化' || item.changeDescription !== '单价未变化')
    .map((item) => ({
      id: `${year}-price-${item.sequence}`,
      year,
      metricId: item.formulaRelation || `PRICE-${item.sequence}`,
      metricName: item.metric2026 || item.metric2025,
      changeType: item.changeType || '年度变化',
      priority: item.changeType.includes('新增') || item.changeType.includes('拆分') ? '高' : '中',
      advice: item.configAdvice || item.changeDescription,
      source: item.changeDescription,
      status: '待处理' as const,
    }));
  const fromNewConfig = data.newConfigItems.map((item) => ({
    id: `${year}-new-${item.sequence}`,
    year,
    metricId: `NEW-${item.sequence}`,
    metricName: item.metricName2026,
    changeType: item.reason.includes('拆分') ? '指标拆分' : '2026新增',
    priority: item.priority || '中',
    advice: item.actionAdvice,
    source: item.source,
    status: '待处理' as const,
  }));
  const fromRecommendations = data.recommendations.map((item) => ({
    id: `${year}-recommendation-${item.sequence}`,
    year,
    metricId: item.relatedMetrics,
    metricName: item.topic,
    changeType: '公式修改建议',
    priority: item.riskLevel || '中',
    advice: item.advice,
    source: item.adjustment2026,
    status: '待处理' as const,
  }));
  return [...fromComparisons, ...fromNewConfig, ...fromRecommendations];
}

export function nextMonth(month: string) {
  const year = yearNumber(month);
  const monthNo = monthNumber(month);
  const next = monthNo === 12 ? 1 : monthNo + 1;
  const nextYear = monthNo === 12 ? year + 1 : year;
  return `${nextYear}-${String(next).padStart(2, '0')}`;
}
