import * as XLSX from '@e965/xlsx';
import type { AppState, MonthlyChangeRecord } from '../types';

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

export function exportExcel(state: AppState) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.records.map(recordToChinese)), '月度变更记录');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.formulas.map((item) => item.raw)), '公式切换总表');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.priceComparisons.map((item) => item.raw)), '25-26单价对比');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.newConfigItems.map((item) => item.raw)), '2026新增需新配');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.recommendations.map((item) => item.raw)), '公式修改建议');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state.data.monthRules.map((item) => item.raw)), '月份参数模板');
  XLSX.writeFile(wb, `计价公式变更台账-${timestamp()}.xlsx`);
}
