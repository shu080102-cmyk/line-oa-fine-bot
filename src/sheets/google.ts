import { google } from 'googleapis';
import { config, DEAL_SHEET, FORM_SHEET } from '../config';
import { parseDealRows, yearFromTab } from './deals';
import { parseStatus } from '../domain/status';
import { currentDealTab } from './runtime';
import { SheetsReader } from './types';
// TODO: 需 service account（GOOGLE_APPLICATION_CREDENTIALS）並將兩張表分享給該帳號
function sheets() { return google.sheets({ version: 'v4', auth: new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] }) }); }
/** Google 表單時間戳記，如「2026/10/27 下午 1:05:00」→ Date（台北） */
export function parseFormTimestamp(s: string): Date {
  const m = s.match(/(\d+)\/(\d+)\/(\d+)\s*(上午|下午)?\s*(\d+):(\d+):?(\d+)?/);
  if (!m) return new Date(NaN);
  let h = Number(m[5]); if (m[4] === '下午' && h < 12) h += 12; if (m[4] === '上午' && h === 12) h = 0;
  const iso = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T${String(h).padStart(2,'0')}:${m[6]}:${(m[7]??'0').padStart(2,'0')}+08:00`;
  return new Date(iso);
}
export const googleReader: SheetsReader = {
  async roster() {
    const r = await sheets().spreadsheets.values.get({ spreadsheetId: config.formSheetId, range: `'${FORM_SHEET.rosterTab}'!${FORM_SHEET.rosterColEmail}2:${FORM_SHEET.rosterColNickname}` });
    return (r.data.values ?? []).map(v => String(v[1] ?? '').trim()).filter(Boolean);
  },
  async formResponses() {
    const r = await sheets().spreadsheets.values.get({ spreadsheetId: config.formSheetId, range: `'${FORM_SHEET.responsesTab}'!A2:E` });
    // A=時間戳記 B=email C=人員 E=狀態
    return (r.data.values ?? []).map(v => ({ timestamp: parseFormTimestamp(String(v[0] ?? '')), person: String(v[2] ?? '').trim(), rawStatus: String(v[4] ?? ''), status: parseStatus(String(v[4] ?? '')) })).filter(x => x.person && !isNaN(+x.timestamp));
  },
  async deals() {
    const tab = currentDealTab();
    const r = await sheets().spreadsheets.values.get({ spreadsheetId: config.dealSheetId, range: `'${tab}'!${DEAL_SHEET.colDate}${DEAL_SHEET.firstDataRow}:${DEAL_SHEET.colType}` });
    return parseDealRows(r.data.values ?? [], yearFromTab(tab, DEAL_SHEET.year));
  },
};

/** 列出生客試算表全部分頁名（給管理指令用選的） */
export async function listDealTabs(): Promise<string[]> {
  const r = await sheets().spreadsheets.get({ spreadsheetId: config.dealSheetId, fields: 'sheets.properties.title' });
  return (r.data.sheets ?? []).map(s => String(s.properties?.title ?? '')).filter(Boolean);
}

