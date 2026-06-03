import type { ChangeStatus, ViewKey } from '../types';

export const STORAGE_KEY = 'pricing-formula-manager:v1';

export const CHANGE_STATUSES: ChangeStatus[] = ['待确认', '待配置', '已修改', '已复核', '暂缓'];

export const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: 'ledger', label: '变更台账' },
  { key: 'formulaLibrary', label: '公式库' },
  { key: 'newConfig', label: '新增新配' },
  { key: 'ruleTemplates', label: '规则模板' },
  { key: 'io', label: '导入导出' },
];

export const EXPECTED_COUNTS = {
  formulas: 54,
  priceComparisons: 53,
  newConfigItems: 20,
  recommendations: 9,
  monthRules: 4,
};

export const DEFAULT_MONTH = '2026-01';
