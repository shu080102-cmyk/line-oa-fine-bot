export type AdminCmd =
  | { kind: 'leave'; person: string; date?: string }
  | { kind: 'fine'; person: string; amount: number; note?: string; date?: string }
  | { kind: 'list'; date?: string }
  | { kind: 'help' } | { kind: 'unknown'; text: string };
const DATE = '(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}\\/\\d{1,2})';
export function normDate(s: string | undefined, year: number): string | undefined {
  if (!s) return; if (s.includes('-')) return s; const [m, d] = s.split('/'); return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}
/** 指令：
 *  請假 小布 [10/27]
 *  罰款 小布 500 [備註...] [10/27]  （日期需放在備註前：罰款 小布 500 10/27 遲到）
 *  罰款清單 [10/27]
 *  說明 / help */
export function parseAdmin(text: string, year = new Date().getFullYear()): AdminCmd {
  const t = text.trim().replace(/\s+/g, ' ');
  let m;
  if (/^(說明|help|幫助)$/i.test(t)) return { kind: 'help' };
  if ((m = t.match(new RegExp(`^罰款清單(?: ${DATE})?$`)))) return { kind: 'list', date: normDate(m[1], year) };
  if ((m = t.match(new RegExp(`^請假 (\\S+)(?: ${DATE})?$`)))) return { kind: 'leave', person: m[1], date: normDate(m[2], year) };
  if ((m = t.match(new RegExp(`^罰款 (\\S+) (\\d+)(?: ${DATE})?(?: (.+))?$`)))) return { kind: 'fine', person: m[1], amount: Number(m[2]), date: normDate(m[3], year), note: m[4] };
  return { kind: 'unknown', text: t };
}
export const HELP = `管理員指令：\n請假 小布 [10/27]\n罰款 小布 500 [10/27] [備註]\n罰款清單 [10/27]\n說明\n（日期省略＝業務日昨天）`;
