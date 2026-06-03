export type RiskLevel = '高' | '中' | '低' | '无' | string;

export type ChangeStatus = '待确认' | '待配置' | '已修改' | '已复核' | '暂缓';

export type ViewKey = 'monthlyAssistant' | 'ledger' | 'formulaLibrary' | 'newConfig' | 'ruleVersions' | 'ruleTemplates' | 'io';

export type SuggestionStatus = '待生成' | '待复核' | '已采纳' | '已忽略';

export type AnnualTaskStatus = '待处理' | '已确认' | '已配置' | '暂缓';

export type FormulaTokenKind = 'metric' | 'sourceField' | 'number' | 'ifBranch' | 'unitConversion' | 'operator';

export interface FormulaToken {
  kind: FormulaTokenKind;
  value: string;
}

export interface FormulaAnalysis {
  formulaMeaning: string;
  formulaTokens: FormulaToken[];
  monthlyRuleType: string;
  manualCheckReasons: string[];
  metricRefs: string[];
  sourceFieldRefs: string[];
  coefficients: string[];
  hasIfBranch: boolean;
  hasUnitConversion: boolean;
  hasMonthlyAmortization: boolean;
}

export interface MetricFormula {
  sequence: number | string;
  board: string;
  category: string;
  detail: string;
  metricId: string;
  originalFormula: string;
  formulaDescription: string;
  formulaType: string;
  currentUnitJudgement: string;
  match2025: string;
  unit2025: string;
  stock2025: string | number;
  positive2025: string | number;
  negative2025: string | number;
  match2026: string;
  unit2026: string;
  stock2026: string | number;
  positive2026: string | number;
  negative2026: string | number;
  priceChangeConclusion: string;
  needsFormulaAdjustment: string;
  formulaAdvice2026: string;
  unitAttention: string;
  riskLevel: RiskLevel;
  sourceNote: string;
  formulaMeaning?: string;
  formulaTokens?: FormulaToken[];
  monthlyRuleType?: string;
  manualCheckReasons?: string[];
  raw: Record<string, unknown>;
}

export interface PriceComparison {
  sequence: number | string;
  category: string;
  metric2025: string;
  unit2025: string;
  stock2025: string | number;
  positive2025: string | number;
  negative2025: string | number;
  metric2026: string;
  unit2026: string;
  stock2026: string | number;
  positive2026: string | number;
  negative2026: string | number;
  changeType: string;
  changeDescription: string;
  formulaRelation: string;
  configAdvice: string;
  raw: Record<string, unknown>;
}

export interface NewConfigItem {
  sequence: number | string;
  category2026: string;
  metricName2026: string;
  unit: string;
  stock2026: string | number;
  positive2026: string | number;
  negative2026: string | number;
  reason: string;
  coverage: string;
  actionAdvice: string;
  priority: string;
  source: string;
  raw: Record<string, unknown>;
}

export interface FormulaRecommendation {
  sequence: number | string;
  topic: string;
  relatedMetrics: string;
  riskLevel: RiskLevel;
  advice: string;
  adjustment2026: string;
  raw: Record<string, unknown>;
}

export interface PriceTableRow {
  sequence: number | string;
  category: string;
  metricName: string;
  unit: string;
  stock: string | number;
  positive: string | number;
  negative: string | number;
  source: string;
  raw: Record<string, unknown>;
}

export interface MonthRuleTemplate {
  purpose: string;
  januaryFormula: string;
  monthNFormula: string;
  applicableMetrics: string;
  note: string;
  raw: Record<string, unknown>;
}

export interface MonthlyChangeRecord {
  id: string;
  month: string;
  metricId: string;
  metricName: string;
  status: ChangeStatus;
  note: string;
  beforeFormula: string;
  afterFormula: string;
  source: string;
  recordType: 'formula' | 'new-config';
  createdAt: string;
  updatedAt: string;
}

export interface FormulaRuleVersion {
  id: string;
  year: number;
  name: string;
  sourceName: string;
  importedAt: string;
  isActive: boolean;
  formulaCount: number;
  priceRowCount: number;
  notes: string;
}

export interface MonthlySuggestion {
  id: string;
  sourceMonth: string;
  targetMonth: string;
  metricId: string;
  metricName: string;
  originalFormula: string;
  suggestedFormula: string;
  changeSummary: string;
  formulaMeaning: string;
  manualCheckReasons: string[];
  riskWarnings: string[];
  status: SuggestionStatus;
  createdAt: string;
  acceptedAt?: string;
}

export interface AnnualMigrationTask {
  id: string;
  year: number;
  metricId: string;
  metricName: string;
  changeType: string;
  priority: string;
  advice: string;
  source: string;
  status: AnnualTaskStatus;
}

export interface WorkbookData {
  formulas: MetricFormula[];
  priceComparisons: PriceComparison[];
  newConfigItems: NewConfigItem[];
  recommendations: FormulaRecommendation[];
  priceTable2025: PriceTableRow[];
  priceTable2026: PriceTableRow[];
  monthRules: MonthRuleTemplate[];
  importedAt: string;
  sourceName: string;
}

export interface AppState {
  schemaVersion: 2;
  data: WorkbookData;
  records: MonthlyChangeRecord[];
  ruleVersions: FormulaRuleVersion[];
  monthlySuggestions: MonthlySuggestion[];
  annualMigrationTasks: AnnualMigrationTask[];
}
