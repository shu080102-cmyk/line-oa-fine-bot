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
      const day = p.get('date') ?? yesterday;
      if (new Date() >= deadlineOf(settlementDayFor(day))) return reply(ev.replyToken!, `${day} 已過截止，回報不計（不可補交免罰）`);
      const person = store.personOf(uid);
      if (!person) return reply(ev.replyToken!, '尚未綁定暱稱，請私訊制裁者：綁定 你的暱稱');
      store.addAlbum(day, person, uid);
      return reply(ev.replyToken!, `${person} ${day} 已記錄上傳 ${store.albumCounts(day).get(person)} 次`);
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
// TODO: 提醒時間待定（暫訂 09:00 平日）
cron.schedule('0 9 * * 1-5', async () => {
  const y = addDays(toTaipeiYMD(new Date()), -1);
  try {
    const [roster, responses, deals] = await Promise.all([reader.roster(), reader.formResponses(), reader.deals().catch(() => [])]);
    const leave = store.leaveSet(y);
    const valid = validResponses(responses, y);
    const off = new Set([...leave, ...valid.filter(r => r.status === 'off').map(r => r.person)]);
    const submitted = new Set(valid.filter(r => r.status === 'work').map(r => r.person));
    const req = requiredAlbums(deals, y);
    const people = (roster.length ? roster : INITIAL_ROSTER).map(person => {
      if (off.has(person)) return { person, leave: true };
      return { person, formOk: submitted.has(person), albumNeed: req.get(person) ?? 0 };
    });
    await pushGroup(remindChecklistFlex(y, people, '13:00'));
  } catch (e) { console.error('remind failed', e); }
}, { timezone: TZ });
cron.schedule(config.cron, () => { runSettlement(store, reader).catch(console.error); }, { timezone: TZ });
app.listen(config.port, () => console.log(`listening :${config.port} (sheets=${config.sheetsMode})`));
