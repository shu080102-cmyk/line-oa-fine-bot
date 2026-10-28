import { config } from '../config';
import { googleReader } from './google';
import { stubReader } from './stub';
export const reader = config.sheetsMode === 'google' ? googleReader : stubReader;
export * from './types';
