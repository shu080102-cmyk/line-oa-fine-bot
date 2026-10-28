export type YMD = string; // 'YYYY-MM-DD' (Taipei)
export type FormStatus = 'work' | 'off' | 'unknown';
export interface FormResponse { timestamp: Date; person: string; status: FormStatus; rawStatus: string }
export interface DealRow { date: YMD; person: string; isNewCustomer: boolean }
export type FineReason = 'form' | 'album' | 'manual';
export interface Fine { id: string; date: YMD; person: string; reason: FineReason; amount: number; note?: string; createdAt: string }
