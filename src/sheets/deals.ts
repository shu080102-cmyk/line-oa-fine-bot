import { DealRow } from '../domain/types';
/** 年份：明確設定 > 分頁名 MWYYYY-MM > 今年 */
export function yearFromTab(tab: string, override?: number): number {
  if (override) return override;
  const m = tab.match(/MW(\d{4})-\d{1,2}/); return m ? Number(m[1]) : new Date().getFullYear();
}
/** rows：從 C 欄起的 [C日期, D人員, ..., I生熟]，即索引 0=C,1=D,6=I */
export function parseDealRows(rows: unknown[][], year: number): DealRow[] {
  const out: DealRow[] = [];
  for (const v of rows) {
    const m = String(v[0] ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})$/);
    const person = String(v[1] ?? '').trim();
    if (!m || !person) continue;
    out.push({ date: `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`, person, isNewCustomer: String(v[6] ?? '').trim() === '生' });
  }
  return out;
}
