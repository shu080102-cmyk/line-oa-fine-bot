# LINE 罰款／提醒 Bot（Phase 1 MVP）

## 規則
- 業務日＝昨天；截止＝今天 14:00（台北）。截止前送出算昨天。週一 14:00 結算週五～週日（逐日計）。週末不跑。
- 未填表單 500、未傳相簿 500，分開記可同時成立。過 14:00 一律成立，不得補交免罰。
- 表單狀態含「休假」或管理員登記請假 → 當天免罰。名單來源：「員工設定」B 欄。
- 相簿應傳數＝生客明細中該員當日「生」列數；「我已上傳」為自報。
- 12:00、13:00 各提醒一次；14:00 結算自動推群組。

## 執行
```bash
cp .env.example .env   # 填值
npm install
npm test
npm run build && npm start   # 或 npm run dev
```
Webhook：`POST https://<公開網址>/webhook`（本機可用 `ngrok http 3000`，之後換雲端），在 LINE Developers 設定並開啟 Use webhook。

## 環境變數
| 變數 | 說明 |
|---|---|
| LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN | Messaging API 憑證 |
| LINE_GROUP_ID | 群組 ID（bot 進群後從 webhook log 取得） |
| ADMIN_USER_IDS | 管理員 userId，逗號分隔（私訊 bot 任意字會回你的 userId） |
| FORM_SPREADSHEET_ID / DEAL_SPREADSHEET_ID | 兩張表 |
| FINE_FORM / FINE_ALBUM | 罰款金額（預設 500） |
| SHEETS_MODE | `stub`（預設）或 `google` |
| GOOGLE_APPLICATION_CREDENTIALS | service account JSON 路徑（google 模式） |
| SETTLEMENT_CRON | 預設 `0 14 * * 1-5`（台北） |
| DATA_FILE | 本地 JSON 儲存 |

## 指令
員工（私訊）：`綁定 小布` — 把 LINE 帳號綁暱稱（「我已上傳」需要）。

管理員（私訊）：
```
請假 小布            # 登記昨天請假
請假 小布 10/27
罰款 CC 300          # 手動罰款（昨天）
罰款 CC 300 10/26 遲到
罰款清單 [10/27]
說明
```

## 還缺
1. LINE channel secret / access token、群組 ID、管理員 userId。
2. Google service account（或其他授權）並分享兩張表。
3. 生客明細欄位已鎖定（分頁「MW2026-10」的副本，第 5 列起：C 日期 M/D、D 人員、I 生/熟；J 節忽略）。每月換分頁請改 `DEAL_SHEET_TAB`；年份取分頁名 MWYYYY，或設 `DEAL_SHEET_YEAR`。
   注意：我們這邊的 Google Sheets 連接器只供開發查看，執行中的 bot 仍需 service account。
4. 提醒推送時間（暫定平日 09:00，`src/index.ts`）。

## 結構
`src/domain`（純函式：時間、狀態、罰款）、`src/sheets`（介面＋stub＋google）、`src/store`（JSON）、`src/line`（client、Flex、管理指令）、`src/jobs/settlement.ts`。

## 相簿檢查（管理員私訊）
- 平日 13:00 制裁者私訊 ADMIN_USER_IDS：「相簿檢查 | M/D」應交／已按上傳／尚未按。
- 檢查人核對實際相簿後，私訊 `未傳 暱稱 [10/27]`：撤回該人當日上傳回報；未結算則 14:00 自動罰，已結算則補記相簿罰 500（不重複）。
