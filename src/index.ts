import express from 'express';
import { middleware, webhook } from '@line/bot-sdk';
import cron from 'node-cron';
import { config, TZ, INITIAL_ROSTER, DEAL_SHEET } from './config';
import { albumNeeds, validResponses } from './domain/fines';
import { addDays, toTaipeiYMD, deadlineOf, settlementDayFor } from './domain/time';
import { HELP, parseAdmin, albumCheckText, SET_DEAL_TAB_ACTION } from './line/admin';
import { lineClient, pushGroup, pushAdmin } from './line/client';
import { toMD, remindChecklistFlex, dealTabPickerFlex, UPLOAD_ACTION } from './line/messages';
import { reader, listDealTabs, setDealTabGetter, currentDealTab } from './sheets';
import { Store } from './store';
import { runSettlement } from './jobs/settlement';

const store = new Store();
setDealTabGetter(() => store.getDealSheetTab() || DEAL_SHEET.tab);

const app = express();
const reply = (token: string, text: string) => lineClient.replyMessage({ replyToken: token, messages: [{ type: 'text', text }] });
const replyMsgs = (token: string, messages: Parameters<typeof lineClient.replyMessage>[0]['messages']) =>
  lineClient.replyMessage({ replyToken: token, messages });

async function handle(ev: webhook.Event) {
  const uid = ev.source?.userId ?? '';
  const src = ev.source as { type?: string; groupId?: string; roomId?: string; userId?: string } | undefined;
  if (src?.groupId) {
    console.log('[LINE] groupId=', src.groupId, 'type=', ev.type, 'userId=', uid);
  } else if (src?.roomId) {
    console.log('[LINE] roomId=', src.roomId, 'type=', ev.type, 'userId=', uid);
  } else {
    console.log('[LINE] event', ev.type, 'sourceType=', src?.type, 'userId=', uid);
  }
  if (ev.type === 'join' && src?.groupId) {
    console.log('[LINE] JOINED_GROUP', src.groupId);
  }
  if (ev.type === 'memberJoined' && src?.groupId) {
    console.log('[LINE] MEMBER_JOINED_IN_GROUP', src.groupId);
  }
  const yesterday = addDays(toTaipeiYMD(new Date()), -1);
  if (ev.type === 'postback') {
    const p = new URLSearchParams(ev.postback.data);
    if (p.get('action') === UPLOAD_ACTION) {
      // 一律不回覆。只有按鈕上的那個人（已綁定且吻合）可記；已回報／別人亂按＝丟棄
      const day = p.get('date') ?? yesterday;
      const target = p.get('person');
      if (!target) return;
      if (new Date() >= deadlineOf(settlementDayFor(day))) return;
      const person = store.personOf(uid);
      if (!person || person !== target) return;
      if ((store.albumCounts(day).get(person) ?? 0) > 0) return;
      store.addAlbum(day, person, uid);
      return;
    }
    if (p.get('action') === SET_DEAL_TAB_ACTION) {
      if (!config.adminIds.includes(uid)) return;
      const tab = p.get('tab');
      if (!tab) return;
      store.setDealSheetTab(tab);
      return reply(ev.replyToken!, `生客分頁已切到：${tab}`);
    }
  }
  if (ev.type === 'message' && ev.message.type === 'text' && ev.source?.type === 'user') {
    const text = ev.message.text.trim();
    const bind = text.match(/^綁定 (\S+)$/);
    if (bind) { store.bindUser(uid, bind[1]); return reply(ev.replyToken!, `已綁定：${bind[1]}`); }
    if (!config.adminIds.includes(uid)) return reply(ev.replyToken!, `你的 userId：${uid}`);
    const c = parseAdmin(text);
    if (c.kind === 'help' || c.kind === 'unknown') return reply(ev.replyToken!, HELP);
    if (c.kind === 'leave') { const d = c.date ?? yesterday; store.addLeave(d, c.person); return reply(ev.replyToken!, `已登記 ${c.person} ${d} 請假`); }
    if (c.kind === 'fine') { const d = c.date ?? yesterday; store.addFine({ date: d, person: c.person, reason: 'manual', amount: c.amount, note: c.note, createdAt: new Date().toISOString() }); return reply(ev.replyToken!, `已記 ${c.person} ${d} 罰款 ${c.amount}${c.note ? '（' + c.note + '）' : ''}`); }
    if (c.kind === 'not_uploaded') {
      const d = c.date ?? yesterday;
      const n = store.clearAlbum(d, c.person);
      // 未結算：清掉回報即可，14:00 結算會自動罰；已結算：補記相簿罰（避免重複）
      let fined = false;
      if (store.isSettled(d) && !store.fines(d).some(f => f.person === c.person && f.reason === 'album')) {
        store.addFine({ date: d, person: c.person, reason: 'album', amount: config.fineAlbum, note: '檢查：有按未傳', createdAt: new Date().toISOString() });
        fined = true;
      }
      return reply(ev.replyToken!, `已撤回 ${c.person} ${d} 相簿回報（${n} 筆）` + (fined ? `，已記相簿罰 ${config.fineAlbum}` : store.isSettled(d) ? '，該日已有相簿罰' : `，14:00 結算會罰 ${config.fineAlbum}`));
    }
    if (c.kind === 'list') { const fs = store.fines(c.date); return reply(ev.replyToken!, fs.map(f => `${f.date} ${f.person} ${f.reason} ${f.amount}`).join('\n') || '無紀錄'); }
    if (c.kind === 'tab_set') {
      store.setDealSheetTab(c.tab);
      return reply(ev.replyToken!, `生客分頁已切到：${c.tab}`);
    }
    if (c.kind === 'tab_list') {
      try {
        const tabs = await listDealTabs();
        const cur = currentDealTab();
        return replyMsgs(ev.replyToken!, [dealTabPickerFlex(cur, tabs)]);
      } catch (e) {
        console.error('listDealTabs failed', e);
        return reply(ev.replyToken!, `目前分頁：${currentDealTab()}\n列分頁失敗，可直接：分頁 「MW2026-11」的副本`);
      }
    }
  }
}
app.get('/health', (_q, r) => { r.send('ok'); });
app.post('/webhook', middleware({ channelSecret: config.lineSecret || 'dummy' }), async (req, res) => {
  await Promise.all((req.body.events as webhook.Event[]).map(e => handle(e).catch(err => console.error(err))));
  res.sendStatus(200);
});
async function sendRemind(adminOnly = false) {
  const y = addDays(toTaipeiYMD(new Date()), -1);
  const [roster, responses, deals] = await Promise.all([reader.roster(), reader.formResponses(), reader.deals().catch(() => [])]);
  const leave = store.leaveSet(y);
  const valid = validResponses(responses, y);
  const off = new Set([...leave, ...valid.filter(r => r.status === 'off').map(r => r.person)]);
  const submitted = new Set(valid.filter(r => r.status === 'work').map(r => r.person));
  const rosterList = roster.length ? roster : INITIAL_ROSTER;
  const req = albumNeeds(rosterList, off, deals, y);
  const albumDone = store.albumCounts(y);
  // 全員仍列在清單（表單 ✔/✘＋相簿）；只有應交相簿者底下才有名字按鈕
  const people = rosterList.map(person => {
    if (off.has(person)) return { person, leave: true };
    const need = req.get(person) ?? 0;
    const reported = albumDone.get(person) ?? 0;
    return { person, formOk: submitted.has(person), albumNeed: need, albumReported: reported };
  });
  if (adminOnly) return pushAdmin([{ type: 'text', text: albumCheckText(toMD(y), req, albumDone, off) }]);
  await pushGroup(remindChecklistFlex(y, people, '14:00'));
}
// 12:00 / 13:00 提醒；14:00 只結算（不提醒）
for (const expr of ['0 12 * * 1-5', '0 13 * * 1-5']) {
  cron.schedule(expr, () => { sendRemind().catch(e => console.error('remind failed', e)); }, { timezone: TZ });
}
// 13:30 私訊管理員相簿檢查清單（不推群）
cron.schedule('30 13 * * 1-5', () => { sendRemind(true).catch(e => console.error('admin check failed', e)); }, { timezone: TZ });
cron.schedule(config.cron, () => { runSettlement(store, reader).catch(console.error); }, { timezone: TZ });
app.listen(config.port, () => console.log(`listening :${config.port} (sheets=${config.sheetsMode} dealTab=${currentDealTab()})`));
