import { DealRow, FormResponse } from '../domain/types';
export interface SheetsReader { roster(): Promise<string[]>; formResponses(): Promise<FormResponse[]>; deals(): Promise<DealRow[]> }
