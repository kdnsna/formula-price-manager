import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from '@e965/xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = '/Users/kdnsna/Desktop/全员全产品计价公式切换梳理_25至26单价对比.xlsx';
const output = path.resolve(__dirname, '../src/data/seedData.json');

function rows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' }).filter((row) => Object.values(row).some((value) => String(value).trim() !== ''));
}

function v(row, key) {
  return row[key] ?? '';
}

function metric(row) {
  return {
    sequence: v(row, '序号'),
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
    stock2025: v(row, '2025存量/总量'),
    positive2025: v(row, '2025正增长'),
    negative2025: v(row, '2025负增长'),
    match2026: String(v(row, '2026匹配指标')),
    unit2026: String(v(row, '2026计价单位')),
    stock2026: v(row, '2026存量/总量'),
    positive2026: v(row, '2026正增长'),
    negative2026: v(row, '2026负增长'),
    priceChangeConclusion: String(v(row, '25→26单价变化结论')),
    needsFormulaAdjustment: String(v(row, '是否需要调整公式单价')),
    formulaAdvice2026: String(v(row, '2026公式/配置建议')),
    unitAttention: String(v(row, '单位与口径关注')),
    riskLevel: String(v(row, '风险等级')),
    sourceNote: String(v(row, '来源与备注')),
    raw: row,
  };
}

function priceComparison(row) {
  return {
    sequence: v(row, '序号'),
    category: String(v(row, '类别')),
    metric2025: String(v(row, '2025指标名称')),
    unit2025: String(v(row, '2025单位')),
    stock2025: v(row, '2025存量/总量'),
    positive2025: v(row, '2025正增长'),
    negative2025: v(row, '2025负增长'),
    metric2026: String(v(row, '2026指标名称')),
    unit2026: String(v(row, '2026单位')),
    stock2026: v(row, '2026存量/总量'),
    positive2026: v(row, '2026正增长'),
    negative2026: v(row, '2026负增长'),
    changeType: String(v(row, '变化类型')),
    changeDescription: String(v(row, '变化说明')),
    formulaRelation: String(v(row, '现有公式关联')),
    configAdvice: String(v(row, '配置建议')),
    raw: row,
  };
}

function newConfig(row) {
  return {
    sequence: v(row, '序号'),
    category2026: String(v(row, '2026类别')),
    metricName2026: String(v(row, '2026指标名称')),
    unit: String(v(row, '计价单位')),
    stock2026: v(row, '2026存量/总量'),
    positive2026: v(row, '2026正增长'),
    negative2026: v(row, '2026负增长'),
    reason: String(v(row, '新配原因')),
    coverage: String(v(row, '现有公式覆盖情况')),
    actionAdvice: String(v(row, '建议配置动作')),
    priority: String(v(row, '优先级')),
    source: String(v(row, '来源')),
    raw: row,
  };
}

function recommendation(row) {
  return {
    sequence: v(row, '序号'),
    topic: String(v(row, '事项')),
    relatedMetrics: String(v(row, '涉及指标/派生指标')),
    riskLevel: String(v(row, '风险等级')),
    advice: String(v(row, '处理建议')),
    adjustment2026: String(v(row, '对应2026调整')),
    raw: row,
  };
}

function priceTable(row) {
  return {
    sequence: v(row, '序号'),
    category: String(v(row, '类别')),
    metricName: String(v(row, '指标名称')),
    unit: String(v(row, '计价单位')),
    stock: v(row, '存量/总量'),
    positive: v(row, '正增长'),
    negative: v(row, '负增长'),
    source: String(v(row, '来源')),
    raw: row,
  };
}

function monthRule(row) {
  return {
    purpose: String(v(row, '用途')),
    januaryFormula: String(v(row, '一月写法')),
    monthNFormula: String(v(row, '第n月通用写法')),
    applicableMetrics: String(v(row, '适用指标')),
    note: String(v(row, '备注')),
    raw: row,
  };
}

const workbook = XLSX.read(fs.readFileSync(source), { type: 'buffer' });
const data = {
  formulas: rows(workbook, '公式切换总表').map(metric).filter((row) => row.metricId),
  priceComparisons: rows(workbook, '25-26单价对比').map(priceComparison),
  newConfigItems: rows(workbook, '2026新增需新配').map(newConfig),
  recommendations: rows(workbook, '公式修改建议').map(recommendation),
  priceTable2025: rows(workbook, '2025单价表').map(priceTable),
  priceTable2026: rows(workbook, '2026单价表').map(priceTable),
  monthRules: rows(workbook, '月份参数模板').map(monthRule),
  importedAt: new Date().toISOString(),
  sourceName: path.basename(source),
};

fs.writeFileSync(output, JSON.stringify(data, null, 2), 'utf8');
console.log('generated', output, {
  formulas: data.formulas.length,
  priceComparisons: data.priceComparisons.length,
  newConfigItems: data.newConfigItems.length,
  recommendations: data.recommendations.length,
  monthRules: data.monthRules.length,
});
