import seedData from '../data/seedData.json';
import { STORAGE_KEY } from './constants';
import type { AppState, WorkbookData } from '../types';

export function createInitialState(): AppState {
  return {
    data: seedData as WorkbookData,
    records: [],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.data || !Array.isArray(parsed.records)) return createInitialState();
    return parsed;
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
