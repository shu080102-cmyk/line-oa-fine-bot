import express from 'express';
import { middleware, webhook } from '@line/bot-sdk';
import cron from 'node-cron';
import { config, TZ, INITIAL_ROSTER } from './config';
import { requiredAlbums, validResponses } from './domain/fines';
import { addDays, toTaipeiYMD, deadlineOf, settlementDayFor } from './domain/time';
import { HELP, parseAdmin } from './line/admin';
import { lineClient, pushGroup } from './line/client';
import { remindChecklistFlex, UPLOAD_ACTION } from './line/messages';
import { reader } from './sheets';
import { Store } from './store';
import { runSettlement } from './jobs/settlement';
const store = new Store();
const app = express();
const reply = (token: string, text: string) => lineClient.replyMessage({ replyToken: token, messages: [{ type: 'text', text }] });
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
      // 一律不回覆；已回報過再按＝防誤觸，直接忽略
      const day = p.get('date') ?? yesterday;
      if (new Date() >= deadlineOf(settlementDayFor(day))) return;
      const person = store.personOf(uid);
      if (!person) return;
      if ((store.albumCounts(day).get(person) ?? 0) > 0) return;
      store.addAlbum(day, person, uid);
      return;
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
    if (c.kind === 'list') { const fs = store.fines(c.date); return reply(ev.replyToken!, fs.map(f => `${f.date} ${f.person} ${f.reason} ${f.amount}`).join('\n') || '無紀錄'); }
  }
}
app.get('/health', (_q, r) => { r.send('ok'); });
app.post('/webhook', middleware({ channelSecret: config.lineSecret || 'dummy' }), async (req, res) => {
  await Promise.all((req.body.events as webhook.Event[]).map(e => handle(e).catch(err => console.error(err))));
  res.sendStatus(200);
});
async function sendRemind() {
  const y = addDays(toTaipeiYMD(new Date()), -1);
  const [roster, responses, deals] = await Promise.all([reader.roster(), reader.formResponses(), reader.deals().catch(() => [])]);
  const leave = store.leaveSet(y);
  const valid = validResponses(responses, y);
  const off = new Set([...leave, ...valid.filter(r => r.status === 'off').map(r => r.person)]);
  const submitted = new Set(valid.filter(r => r.status === 'work').map(r => r.person));
  const req = requiredAlbums(deals, y);
  const albumDone = store.albumCounts(y);
  const people = (roster.length ? roster : INITIAL_ROSTER).map(person => {
    if (off.has(person)) return { person, leave: true };
    const need = req.get(person) ?? 0;
    const reported = albumDone.get(person) ?? 0;
    // 已按過「我已上傳」則 checklist 顯示已交張數感：need 用 max(0, need-reported) 不改 schema，改 formOk/album 文案在 messages
    return { person, formOk: submitted.has(person), albumNeed: need, albumReported: reported };
  });
  await pushGroup(remindChecklistFlex(y, people, '13:00'));
}
// 12:00 / 12:30 / 12:50 提醒；13:00 只結算（不提醒）
for (const expr of ['0 12 * * 1-5', '30 12 * * 1-5', '50 12 * * 1-5']) {
  cron.schedule(expr, () => { sendRemind().catch(e => console.error('remind failed', e)); }, { timezone: TZ });
}
cron.schedule(config.cron, () => { runSettlement(store, reader).catch(console.error); }, { timezone: TZ });
app.listen(config.port, () => console.log(`listening :${config.port} (sheets=${config.sheetsMode})`));
