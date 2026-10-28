import { YMD } from './types';
const OFFSET = 8 * 3600_000; // Asia/Taipei 固定 UTC+8，無夏令
export function toTaipeiYMD(d: Date): YMD { return new Date(d.getTime() + OFFSET).toISOString().slice(0, 10); }
export function addDays(ymd: YMD, n: number): YMD { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function weekday(ymd: YMD): number { return new Date(ymd + 'T00:00:00Z').getUTCDay(); }
/** 某日 13:00 台北時間的 Date */
export function deadlineOf(runDay: YMD): Date { return new Date(new Date(runDay + 'T13:00:00Z').getTime() - OFFSET); }
/** 結算日要檢查的業務日：平日=昨天；週一=週五～週日。週末不結算回傳 [] */
export function businessDaysToSettle(runDay: YMD): YMD[] {
  const w = weekday(runDay);
  if (w === 0 || w === 6) return [];
  if (w === 1) return [addDays(runDay, -3), addDays(runDay, -2), addDays(runDay, -1)];
  return [addDays(runDay, -1)];
}
/** 業務日 D 的截止 = 對應結算日 13:00（週五～日 → 下週一） */
export function settlementDayFor(day: YMD): YMD {
  const w = weekday(day);
  if (w === 5) return addDays(day, 3); if (w === 6) return addDays(day, 2); return addDays(day, 1);
}
/** 一筆表單提交歸屬哪個業務日：提交時間在 D 的截止前，且 >= D 當天 00:00 */
export function attributeSubmission(ts: Date): YMD[] {
  const today = toTaipeiYMD(ts);
  const out: YMD[] = [today];
  // 前一（或前幾個）業務日若截止未過也算
  for (let i = 1; i <= 3; i++) { const d = addDays(today, -i); if (ts < deadlineOf(settlementDayFor(d))) out.push(d); }
  return out;
}
