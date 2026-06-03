import seedData from '../data/seedData.json';
import { STORAGE_KEY } from './constants';
import { createAnnualMigrationTasks, createDefaultRuleVersion, enrichWorkbookData } from './ruleEngine';
import type { AppState, WorkbookData } from '../types';

export function createInitialState(): AppState {
  const data = enrichWorkbookData(seedData as WorkbookData);
  return {
    schemaVersion: 2,
    data,
    records: [],
    ruleVersions: [createDefaultRuleVersion(data)],
    monthlySuggestions: [],
    annualMigrationTasks: createAnnualMigrationTasks(data, 2026),
  };
}

export function createStateFromWorkbook(data: WorkbookData, existing?: AppState): AppState {
  const enriched = enrichWorkbookData(data);
  const year = Number(data.sourceName.match(/20\d{2}/)?.[0] ?? 2026);
  const version = {
    ...createDefaultRuleVersion(enriched),
    id: `rule-version-${year}-${Date.now()}`,
    year,
    name: `${year} 计价规则`,
    isActive: true,
  };
  return {
    schemaVersion: 2,
    data: enriched,
    records: existing?.records ?? [],
    ruleVersions: [...(existing?.ruleVersions ?? []).map((item) => ({ ...item, isActive: false })), version],
    monthlySuggestions: existing?.monthlySuggestions ?? [],
    annualMigrationTasks: createAnnualMigrationTasks(enriched, year),
  };
}

function migrateState(parsed: Partial<AppState> & { data?: WorkbookData; records?: unknown[] }): AppState {
  if (!parsed.data || !Array.isArray(parsed.records)) return createInitialState();
  const enriched = enrichWorkbookData(parsed.data);
  return {
    schemaVersion: 2,
    data: enriched,
    records: parsed.records as AppState['records'],
    ruleVersions: parsed.ruleVersions?.length ? parsed.ruleVersions : [createDefaultRuleVersion(enriched)],
    monthlySuggestions: parsed.monthlySuggestions ?? [],
    annualMigrationTasks: parsed.annualMigrationTasks?.length ? parsed.annualMigrationTasks : createAnnualMigrationTasks(enriched, 2026),
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState> & { data?: WorkbookData; records?: unknown[] };
    return migrateState(parsed);
  } catch {
    return createInitialState();
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}
