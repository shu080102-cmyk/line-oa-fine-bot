import { INITIAL_ROSTER, DEAL_SHEET } from '../config';
import { SheetsReader } from './types';
export const stubReader: SheetsReader = { roster: async () => INITIAL_ROSTER, formResponses: async () => [], deals: async () => [] };
export async function listDealTabsStub(): Promise<string[]> {
  return [DEAL_SHEET.tab, '「MW2026-11」的副本', '「MW2026-12」的副本'];
}
