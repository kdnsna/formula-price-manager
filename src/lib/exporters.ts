import * as XLSX from '@e965/xlsx';
import type { AnnualMigrationTask, AppState, MetricFormula, MonthlyChangeRecord, MonthlySuggestion } from '../types';
import { getFormulaUnitPriceSummary } from './formula';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function exportJson(state: AppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `计价公式管理台导出-${timestamp()}.json`);
}

function recordToChinese(record: MonthlyChangeRecord) {
  return {
    月份: record.month,
    指标编号: record.metricId,
    指标名称: record.metricName,
    状态: record.status,
    备注: record.note,
    变更前公式: record.beforeFormula,
    变更后公式: record.afterFormula,
    来源依据: record.source,
    记录类型: record.recordType === 'formula' ? '公式' : '新增新配',
    创建时间: record.createdAt,
    更新时间: record.updatedAt,
  };
}

function suggestionToChinese(suggestion: MonthlySuggestion) {
  return {
    来源月份: suggestion.sourceMonth,
    目标月份: suggestion.targetMonth,
    指标编号: suggestion.metricId,
    指标名称: suggestion.metricName,
    原公式: suggestion.originalFormula,
    建议公式: suggestion.suggestedFormula,
    修改点摘要: suggestion.changeSummary,
    公式含义: suggestion.formulaMeaning,
    需人工确认: suggestion.manualCheckReasons.join('；'),
    风险提示: suggestion.riskWarnings.join('；'),
    状态: suggestion.status,
    生成时间: suggestion.createdAt,
    采纳时间: suggestion.acceptedAt ?? '',
  };
}

function meaningToChinese(metric: MetricFormula) {
  return {
    指标编号: metric.metricId,
    指标名称: `${metric.category} / ${metric.detail}`,
    板块: metric.board,
    公式性质: metric.formulaType,
    原公式: metric.originalFormula,
    单价拆解: getFormulaUnitPriceSummary(metric),
    公式含义: metric.formulaMeaning ?? metric.formulaDescription,
    月度规则类型: metric.monthlyRuleType ?? '',
    需人工确认: (metric.manualCheckReasons ?? []).join('；'),
    单位判断: metric.currentUnitJudgement,
    单位与口径关注: metric.unitAttention,
  };
}

function reviewChecklistToChinese(suggestion: MonthlySuggestion) {
  return {
    目标月份: suggestion.targetMonth,
    指标编号: suggestion.metricId,
    指标名称: suggestion.metricName,
    复核状态: suggestion.status,
    检查事项: [...suggestion.manualCheckReasons, ...suggestion.riskWarnings].join('；') || '检查建议公式与目标月份是否一致',
    建议公式: suggestion.suggestedFormula,
  };
}

function annualTaskToChinese(task: AnnualMigrationTask) {
  return {
    年度: task.year,
    指标编号: task.metricId,
    指标名称: task.metricName,
    变化类型: task.changeType,
    优先级: task.priority,
    处理建议: task.advice,
    来源: task.source,
    状态: task.status,
  };
}

export function exportExcel(state: AppState) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.records.map(recordToChinese)), '月度变更记录');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.monthlySuggestions.map(suggestionToChinese)), '下月公式建议');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.formulas.map(meaningToChinese)), '公式含义说明');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.monthlySuggestions.map(reviewChecklistToChinese)), '月度复核清单');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.annualMigrationTasks.map(annualTaskToChinese)), '年度迁移任务');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.formulas.map((item) => item.raw)), '公式切换总表');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.priceComparisons.map((item) => item.raw)), '25-26单价对比');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.newConfigItems.map((item) => item.raw)), '2026新增需新配');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.recommendations.map((item) => item.raw)), '公式修改建议');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.monthRules.map((item) => item.raw)), '月份参数模板');
  XLSX.writeFile(wb, `计价公式变更台账-${timestamp()}.xlsx`);
}
