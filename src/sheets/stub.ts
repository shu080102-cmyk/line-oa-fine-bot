import { INITIAL_ROSTER } from '../config';
import { SheetsReader } from './types';
export const stubReader: SheetsReader = { roster: async () => INITIAL_ROSTER, formResponses: async () => [], deals: async () => [] };
