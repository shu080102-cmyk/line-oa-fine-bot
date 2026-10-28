export type AdminCmd =
  | { kind: 'leave'; person: string; date?: string }
  | { kind: 'fine'; person: string; amount: number; note?: string; date?: string }
  | { kind: 'list'; date?: string }
  | { kind: 'tab_list' }
  | { kind: 'tab_set'; tab: string }
  | { kind: 'help' } | { kind: 'unknown'; text: string };
const DATE = '(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2})';
export function normDate(s: string | undefined, year: number): string | undefined {
  if (!s) return; if (s.includes('-')) return s; const [m, d] = s.split('/'); return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}
/** 指令：
 *  請假 小布 [10/27]
 *  罰款 小布 500 [備註...] [10/27]
 *  罰款清單 [10/27]
 *  分頁            → 列出可選生客分頁（按鈕選）
 *  分頁 「MW2026-11」的副本 → 直接指定
 *  說明 / help */
export function parseAdmin(text: string, year = new Date().getFullYear()): AdminCmd {
  const t = text.trim().replace(/\s+/g, ' ');
  let m;
  if (/^(說明|help|幫助)$/i.test(t)) return { kind: 'help' };
  if (t === '分頁') return { kind: 'tab_list' };
  if ((m = t.match(/^分頁 (.+)$/))) return { kind: 'tab_set', tab: m[1].trim() };
  if ((m = t.match(new RegExp(`^罰款清單(?: ${DATE})?$`)))) return { kind: 'list', date: normDate(m[1], year) };
  if ((m = t.match(new RegExp(`^請假 (\\S+)(?: ${DATE})?$`)))) return { kind: 'leave', person: m[1], date: normDate(m[2], year) };
  if ((m = t.match(new RegExp(`^罰款 (\\S+) (\\d+)(?: ${DATE})?(?: (.+))?$`)))) return { kind: 'fine', person: m[1], amount: Number(m[2]), date: normDate(m[3], year), note: m[4] };
  return { kind: 'unknown', text: t };
}
export const HELP = `管理員指令：
請假 小布 [10/27]
罰款 小布 500 [10/27] [備註]
罰款清單 [10/27]
分頁
分頁 「MW2026-11」的副本
說明
（日期省略＝業務日昨天；分頁＝選生客表當月分頁名）`;

export const SET_DEAL_TAB_ACTION = 'set_deal_tab';
