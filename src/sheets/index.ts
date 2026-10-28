import { config } from '../config';
import { googleReader, listDealTabs as listDealTabsGoogle } from './google';
import { stubReader, listDealTabsStub } from './stub';
export const reader = config.sheetsMode === 'google' ? googleReader : stubReader;
export async function listDealTabs(): Promise<string[]> {
  return config.sheetsMode === 'google' ? listDealTabsGoogle() : listDealTabsStub();
}
export { currentDealTab, setDealTabGetter } from './runtime';
export * from './types';
