import { DealRow, Fine, FormResponse, YMD } from './types';
import { attributeSubmission, deadlineOf, settlementDayFor } from './time';
export interface DayInput {
  day: YMD; roster: string[]; responses: FormResponse[]; deals: DealRow[];
  leave: Set<string>;            // 管理員登記請假
  albumReports: Map<string, number>; // person -> 「我已上傳」次數（截止前）
  worked?: (person: string) => boolean; // TODO: 出勤來源；預設=有上班打卡或有生客
}
export interface Amounts { form: number; album: number }
export function requiredAlbums(deals: DealRow[], day: YMD): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of deals) if (d.date === day && d.isNewCustomer) m.set(d.person, (m.get(d.person) ?? 0) + 1);
  return m;
}
/** 截止前有效、歸屬此業務日的表單 */
export function validResponses(rs: FormResponse[], day: YMD): FormResponse[] {
  const dl = deadlineOf(settlementDayFor(day));
  return rs.filter(r => r.timestamp < dl && attributeSubmission(r.timestamp).includes(day));
}
export function calcDayFines(i: DayInput, amt: Amounts, now = new Date()): Omit<Fine, 'id'>[] {
  const valid = validResponses(i.responses, i.day);
  const off = new Set([...i.leave, ...valid.filter(r => r.status === 'off').map(r => r.person)]);
  const submitted = new Set(valid.filter(r => r.status === 'work').map(r => r.person));
  const req = requiredAlbums(i.deals, i.day);
  const worked = i.worked ?? (() => true); // 在職名單上且未休假/請假 = 視為上班
  const out: Omit<Fine, 'id'>[] = []; const at = now.toISOString();
  for (const p of i.roster) {
    if (off.has(p)) continue;
    if (worked(p) && !submitted.has(p)) out.push({ date: i.day, person: p, reason: 'form', amount: amt.form, createdAt: at });
    const need = req.get(p) ?? 0;
    if (need > (i.albumReports.get(p) ?? 0)) out.push({ date: i.day, person: p, reason: 'album', amount: amt.album, createdAt: at, note: `需 ${need}，回報 ${i.albumReports.get(p) ?? 0}` });
  }
  return out;
}
