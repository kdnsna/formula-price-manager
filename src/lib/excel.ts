import * as XLSX from '@e965/xlsx';
import type {
  FormulaRecommendation,
  MetricFormula,
  MonthRuleTemplate,
  NewConfigItem,
  PriceComparison,
  PriceTableRow,
  WorkbookData,
} from '../types';

type Row = Record<string, unknown>;

function v(row: Row, key: string) {
  const value = row[key];
  if (value === null || value === undefined) return '';
  return value;
}

function rowsFromSheet(workbook: XLSX.WorkBook, sheetName: string): Row[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' }).filter((row) =>
    Object.values(row).some((value) => String(value).trim() !== ''),
  );
}

function parseMetricFormula(row: Row): MetricFormula {
  return {
    sequence: v(row, '序号') as string | number,
    board: String(v(row, '板块')),
    category: String(v(row, '指标小类')),
    detail: String(v(row, '指标小类细目')),
    metricId: String(v(row, '派生指标编号')),
    originalFormula: String(v(row, '原公式')),
    formulaDescription: String(v(row, '指标公式描述')),
    formulaType: String(v(row, '公式性质')),
    currentUnitJudgement: String(v(row, '当前单位判断')),
    match2025: String(v(row, '2025匹配指标')),
    unit2025: String(v(row, '2025计价单位/口径')),
    stock2025: v(row, '2025存量/总量') as string | number,
    positive2025: v(row, '2025正增长') as string | number,
    negative2025: v(row, '2025负增长') as string | number,
    match2026: String(v(row, '2026匹配指标')),
    unit2026: String(v(row, '2026计价单位')),
    stock2026: v(row, '2026存量/总量') as string | number,
    positive2026: v(row, '2026正增长') as string | number,
    negative2026: v(row, '2026负增长') as string | number,
    priceChangeConclusion: String(v(row, '25→26单价变化结论')),
    needsFormulaAdjustment: String(v(row, '是否需要调整公式单价')),
    formulaAdvice2026: String(v(row, '2026公式/配置建议')),
    unitAttention: String(v(row, '单位与口径关注')),
    riskLevel: String(v(row, '风险等级')),
    sourceNote: String(v(row, '来源与备注')),
    raw: row,
  };
}

function parsePriceComparison(row: Row): PriceComparison {
  return {
    sequence: v(row, '序号') as string | number,
    category: String(v(row, '类别')),
    metric2025: String(v(row, '2025指标名称')),
    unit2025: String(v(row, '2025单位')),
    stock2025: v(row, '2025存量/总量') as string | number,
    positive2025: v(row, '2025正增长') as string | number,
    negative2025: v(row, '2025负增长') as string | number,
    metric2026: String(v(row, '2026指标名称')),
    unit2026: String(v(row, '2026单位')),
    stock2026: v(row, '2026存量/总量') as string | number,
    positive2026: v(row, '2026正增长') as string | number,
    negative2026: v(row, '2026负增长') as string | number,
    changeType: String(v(row, '变化类型')),
    changeDescription: String(v(row, '变化说明')),
    formulaRelation: String(v(row, '现有公式关联')),
    configAdvice: String(v(row, '配置建议')),
    raw: row,
  };
}

function parseNewConfigItem(row: Row): NewConfigItem {
  return {
    sequence: v(row, '序号') as string | number,
    category2026: String(v(row, '2026类别')),
    metricName2026: String(v(row, '2026指标名称')),
    unit: String(v(row, '计价单位')),
    stock2026: v(row, '2026存量/总量') as string | number,
    positive2026: v(row, '2026正增长') as string | number,
    negative2026: v(row, '2026负增长') as string | number,
    reason: String(v(row, '新配原因')),
    coverage: String(v(row, '现有公式覆盖情况')),
    actionAdvice: String(v(row, '建议配置动作')),
    priority: String(v(row, '优先级')),
    source: String(v(row, '来源')),
    raw: row,
  };
}

function parseRecommendation(row: Row): FormulaRecommendation {
  return {
    sequence: v(row, '序号') as string | number,
    topic: String(v(row, '事项')),
    relatedMetrics: String(v(row, '涉及指标/派生指标')),
    riskLevel: String(v(row, '风险等级')),
    advice: String(v(row, '处理建议')),
    adjustment2026: String(v(row, '对应2026调整')),
    raw: row,
  };
}

function parsePriceTableRow(row: Row): PriceTableRow {
  return {
    sequence: v(row, '序号') as string | number,
    category: String(v(row, '类别')),
    metricName: String(v(row, '指标名称')),
    unit: String(v(row, '计价单位')),
    stock: v(row, '存量/总量') as string | number,
    positive: v(row, '正增长') as string | number,
    negative: v(row, '负增长') as string | number,
    source: String(v(row, '来源')),
    raw: row,
  };
}

function parseMonthRule(row: Row): MonthRuleTemplate {
  return {
    purpose: String(v(row, '用途')),
    januaryFormula: String(v(row, '一月写法')),
    monthNFormula: String(v(row, '第n月通用写法')),
    applicableMetrics: String(v(row, '适用指标')),
    note: String(v(row, '备注')),
    raw: row,
  };
}

export function parseWorkbook(workbook: XLSX.WorkBook, sourceName: string): WorkbookData {
  return {
    formulas: rowsFromSheet(workbook, '公式切换总表').map(parseMetricFormula).filter((row) => row.metricId),
    priceComparisons: rowsFromSheet(workbook, '25-26单价对比').map(parsePriceComparison),
    newConfigItems: rowsFromSheet(workbook, '2026新增需新配').map(parseNewConfigItem),
    recommendations: rowsFromSheet(workbook, '公式修改建议').map(parseRecommendation),
    priceTable2025: rowsFromSheet(workbook, '2025单价表').map(parsePriceTableRow),
    priceTable2026: rowsFromSheet(workbook, '2026单价表').map(parsePriceTableRow),
    monthRules: rowsFromSheet(workbook, '月份参数模板').map(parseMonthRule),
    importedAt: new Date().toISOString(),
    sourceName,
  };
}

export async function parseWorkbookFile(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return parseWorkbook(workbook, file.name);
}
