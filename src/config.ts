import 'dotenv/config';
const e = process.env;
export const config = {
  port: Number(e.PORT ?? 3000),
  lineSecret: e.LINE_CHANNEL_SECRET ?? '',
  lineToken: e.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  /** 員工群：提醒清單 */
  groupId: e.LINE_GROUP_ID ?? '',
  /** 罰款／結算群（漫威俱樂部）；空＝退回 groupId */
  fineGroupId: e.LINE_FINE_GROUP_ID ?? '',
  adminIds: (e.ADMIN_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  formSheetId: e.FORM_SPREADSHEET_ID ?? '1KFurA8rtYVr5KQaIeL5311vNUWwg1I17m_5WFzCLttg',
  dealSheetId: e.DEAL_SPREADSHEET_ID ?? '1p6egJnIlZuoizDNsAHMnG24wS9UiRkNTKGs9Oxb76zw',
  fineForm: Number(e.FINE_FORM ?? 500),
  fineAlbum: Number(e.FINE_ALBUM ?? 500),
  sheetsMode: (e.SHEETS_MODE ?? 'stub') as 'stub' | 'google',
  cron: e.SETTLEMENT_CRON ?? '0 14 * * 1-5',
  dataFile: e.DATA_FILE ?? './data/store.json',
};
export const TZ = 'Asia/Taipei';
/** 表單試算表欄位（已由實際表確認） */
export const FORM_SHEET = {
  responsesTab: '表單回覆 1', responsesSheetId: 386424710,
  colTimestamp: 'A', colEmail: 'B', colPerson: 'C', colStatus: 'E',
  rosterTab: '員工設定', rosterSheetId: 342119611, rosterColEmail: 'A', rosterColNickname: 'B',
};
/** 生客明細欄位（已鎖定）：B 序號 C 日期(M/D) D 人員 E 地點 F 客人 G 金額 H 來源 I 生/熟 J 節(忽略) */
export const DEAL_SHEET = {
  sheetId: 128115477,
  tab: process.env.DEAL_SHEET_TAB ?? '「MW2026-10」的副本',
  firstDataRow: 5, colDate: 'C', colPerson: 'D', colType: 'I',
  year: process.env.DEAL_SHEET_YEAR ? Number(process.env.DEAL_SHEET_YEAR) : undefined,
};
export const INITIAL_ROSTER = ['小布','小玫','小紅','小菁','小N','尼莫','安潔','佑佑','沐沐','咚咚','芝芝','芷媽','妍妍','娜娜','茵茵','涵涵','菲柔','糖依','靜蕾','櫻桃','露露','CC','DD'];
