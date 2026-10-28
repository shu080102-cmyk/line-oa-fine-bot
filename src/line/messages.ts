import { messagingApi } from '@line/bot-sdk';
import { Fine, YMD } from '../domain/types';

import { SET_DEAL_TAB_ACTION } from './admin';
export const UPLOAD_ACTION = 'album_uploaded';
export { SET_DEAL_TAB_ACTION };

/** YYYY-MM-DD → M/D */
export function toMD(day: YMD): string {
  const [, m, d] = day.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export interface PersonDayStatus {
  person: string;
  /** 休假／請假 */
  leave?: boolean;
  formOk?: boolean;
  /** 應交相簿張數；0＝無需相簿 */
  albumNeed?: number;
  /** 已按「我已上傳」次數 */
  albumReported?: number;
}

type FlexBubble = messagingApi.FlexBubble;
type FlexComponent = messagingApi.FlexComponent;

function sep(): FlexComponent {
  return { type: 'separator', margin: 'md', color: '#E0E0E0' };
}

function bullet(text: string, color = '#333333'): FlexComponent {
  return {
    type: 'box', layout: 'horizontal', margin: 'sm', contents: [
      { type: 'text', text: '•', size: 'sm', color: '#E53935', flex: 0 },
      { type: 'text', text, size: 'sm', color, wrap: true, margin: 'sm' },
    ],
  };
}

/** 今日應交清單（制裁者 OA）：綠色 header＋截止 pill、每人一列、footer 只放待回報相簿者 */
export function remindChecklistFlex(day: YMD, people: PersonDayStatus[], deadline = '14:00'): messagingApi.Message[] {
  const md = toMD(day);
  const GREEN = '#06C755';
  const OK = '#1E9E4A';
  const NG = '#E53935';
  const MUTED = '#AAAAAA';

  const chip = (text: string, color: string): FlexComponent => ({
    type: 'text', text, size: 'xs', color, align: 'end', flex: 0, margin: 'md',
  });

  const rows: FlexComponent[] = [];
  people.forEach((p, i) => {
    if (i > 0) rows.push({ type: 'separator', margin: 'md', color: '#F0F0F0' });
    if (p.leave) {
      rows.push({
        type: 'box', layout: 'horizontal', margin: 'md', alignItems: 'center', contents: [
          { type: 'text', text: p.person, size: 'sm', color: MUTED, flex: 1 },
          chip('休假', MUTED),
        ],
      });
      return;
    }
    const need = p.albumNeed ?? 0;
    const reported = p.albumReported ?? 0;
    const album: FlexComponent =
      need <= 0 ? chip('無需相簿', MUTED)
      : reported > 0 ? chip('相簿 ✔', OK)
      : chip(`相簿 ✘ ${need}張`, NG);
    rows.push({
      type: 'box', layout: 'horizontal', margin: 'md', alignItems: 'center', contents: [
        { type: 'text', text: p.person, size: 'md', weight: 'bold', color: '#222222', flex: 1, wrap: true },
        chip(p.formOk ? '表單 ✔' : '表單 ✘', p.formOk ? OK : NG),
        album,
      ],
    });
  });

  // 只有應交相簿且尚未回報的人有按鈕；label/displayText＝暱稱，別人按了 handler 會丟棄
  const pendingAlbum = people.filter(
    p => !p.leave && (p.albumNeed ?? 0) > 0 && (p.albumReported ?? 0) <= 0,
  );

  const header = (sub: string): messagingApi.FlexBox => ({
    type: 'box', layout: 'vertical', backgroundColor: GREEN, paddingAll: '20px', paddingBottom: '16px',
    contents: [
      { type: 'text', text: '制裁者', size: 'xxs', color: '#E8FFF0', weight: 'bold' },
      {
        type: 'box', layout: 'horizontal', margin: 'sm', alignItems: 'center', contents: [
          { type: 'text', text: sub, size: 'xl', weight: 'bold', color: '#FFFFFF', flex: 1 },
          { type: 'text', text: md, size: 'lg', weight: 'bold', color: '#FFFFFF', flex: 0 },
        ],
      },
      {
        type: 'box', layout: 'horizontal', margin: 'md', contents: [
          {
            type: 'box', layout: 'vertical', flex: 0, backgroundColor: '#FFFFFF', cornerRadius: '12px',
            paddingStart: '10px', paddingEnd: '10px', paddingTop: '3px', paddingBottom: '3px',
            contents: [{ type: 'text', text: `⏰ 截止 ${deadline}`, size: 'xs', color: '#05A346', weight: 'bold' }],
          },
        ],
      },
    ],
  });

  const mkBubble = (footerPeople: PersonDayStatus[], withHeader: boolean): FlexBubble => {
    const footerContents: FlexComponent[] = [];
    if (footerPeople.length) {
      footerContents.push({ type: 'text', text: '已上傳相簿 → 按自己的名字', size: 'sm', weight: 'bold', color: '#05A346', align: 'center' });
      footerPeople.forEach(p => footerContents.push({
        type: 'button',
        style: 'primary',
        color: GREEN,
        height: 'sm',
        action: {
          type: 'postback',
          label: `${p.person}　我已上傳`.slice(0, 20),
          data: `action=${UPLOAD_ACTION}&date=${day}&person=${encodeURIComponent(p.person)}`,
          displayText: p.person,
        },
      }));
      footerContents.push({ type: 'text', text: '只按自己的名字，按別人的不算', size: 'xs', color: '#999999', align: 'center', margin: 'sm' });
    } else if (withHeader) {
      footerContents.push({ type: 'text', text: '今日無需相簿回報 🎉', size: 'xs', color: '#999999', align: 'center' });
    }
    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      header: header(withHeader ? '今日應交清單' : '應交相簿（續）'),
      body: {
        type: 'box', layout: 'vertical', paddingAll: '20px', paddingTop: '12px',
        contents: withHeader && rows.length
          ? rows
          : [{ type: 'text', text: '請以下同仁回報相簿', size: 'sm', color: '#666666' }],
      },
      styles: { footer: { separator: true, separatorColor: '#F0F0F0' } },
    };
    if (footerContents.length) {
      bubble.footer = { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px', contents: footerContents };
    }
    return bubble;
  };

  // LINE 單一 bubble footer 按鈕不宜太多：每卡最多 8 人
  const chunk = 8;
  const bubbles: FlexBubble[] = [];
  if (!pendingAlbum.length) {
    bubbles.push(mkBubble([], true));
  } else {
    for (let i = 0; i < pendingAlbum.length; i += chunk) {
      bubbles.push(mkBubble(pendingAlbum.slice(i, i + chunk), i === 0));
    }
  }

  const flexContents =
    bubbles.length === 1
      ? bubbles[0]
      : { type: 'carousel' as const, contents: bubbles };

  return [
    { type: 'text', text: '以下是今日應交清單，請大家確認上傳。' },
    { type: 'flex', altText: `今日應交清單 | ${md}`, contents: flexContents },
  ];
}

/** 14:00 結算卡片 */
export function settlementFlex(day: YMD, formMissing: string[], albumMissing: { person: string; need: number }[]): messagingApi.Message {
  const md = toMD(day);
  if (!formMissing.length && !albumMissing.length) {
    return {
      type: 'flex',
      altText: `14:00 結算 | ${md}：全員達標`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box', layout: 'vertical', contents: [
            { type: 'text', text: `✅ 「14:00 結算 | ${md}」`, weight: 'bold', size: 'md', color: '#2E7D32', wrap: true },
            { type: 'text', text: '全員達標，無罰款', size: 'sm', margin: 'md', color: '#555555' },
          ],
        },
      },
    };
  }

  const bodyContents: FlexComponent[] = [
    {
      type: 'box', layout: 'horizontal', contents: [
        { type: 'text', text: '⚠️', flex: 0, size: 'lg' },
        { type: 'text', text: `「14:00 結算 | ${md}」`, weight: 'bold', size: 'md', color: '#C62828', margin: 'sm', wrap: true },
      ],
    },
    { type: 'separator', margin: 'md', color: '#E53935' },
  ];

  bodyContents.push({
    type: 'box', layout: 'horizontal', margin: 'md', contents: [
      { type: 'text', text: '❌', flex: 0, size: 'sm' },
      { type: 'text', text: '未填表單', weight: 'bold', size: 'sm', margin: 'sm' },
    ],
  });
  if (formMissing.length) {
    for (const p of formMissing) bodyContents.push(bullet(p));
  } else {
    bodyContents.push({ type: 'text', text: '（無）', size: 'xs', color: '#999999', margin: 'sm' });
  }

  bodyContents.push(sep());
  bodyContents.push({
    type: 'box', layout: 'horizontal', margin: 'md', contents: [
      { type: 'text', text: '🖼', flex: 0, size: 'sm' },
      { type: 'text', text: '未傳相簿', weight: 'bold', size: 'sm', margin: 'sm' },
    ],
  });
  if (albumMissing.length) {
    for (const a of albumMissing) bodyContents.push(bullet(`${a.person} 應交${a.need}張`));
  } else {
    bodyContents.push({ type: 'text', text: '（無）', size: 'xs', color: '#999999', margin: 'sm' });
  }

  const bubble: FlexBubble = {
    type: 'bubble',
    styles: { footer: { backgroundColor: '#FFEBEE' } },
    body: { type: 'box', layout: 'vertical', contents: bodyContents },
    footer: {
      type: 'box', layout: 'horizontal', contents: [
        { type: 'text', text: 'ℹ️', flex: 0, size: 'sm' },
        { type: 'text', text: '以上作為今日罰款依據', size: 'xs', color: '#C62828', margin: 'sm', wrap: true },
      ],
    },
  };

  return { type: 'flex', altText: `14:00 結算 | ${md}`, contents: bubble };
}

/** @deprecated 保留給舊呼叫；改用 settlementFlex */
export function settlementText(days: YMD[], fines: Fine[]): messagingApi.Message {
  const day = days[0] ?? '';
  const formMissing = [...new Set(fines.filter(f => f.reason === 'form').map(f => f.person))];
  const albumMissing = fines.filter(f => f.reason === 'album').map(f => {
    const m = f.note?.match(/需\s*(\d+)/);
    return { person: f.person, need: m ? Number(m[1]) : 1 };
  });
  if (days.length <= 1) return settlementFlex(day, formMissing, albumMissing);
  // 多日（週一）：逐日各一則，這裡回傳第一日；jobs 應改為多則 push
  return settlementFlex(day, formMissing, albumMissing);
}

/** 14:00 結算：每人每筆罰一則純文字（不用 Flex） */
export function fineText(f: Pick<Fine, 'person' | 'reason' | 'amount'>): string {
  const what = f.reason === 'form' ? '14:00前未交表單' : '14:00前未上傳成交相簿';
  return `${f.person}\n${what}\n罰款${f.amount}`;
}

export function settlementsFromFines(days: YMD[], fines: Fine[]): messagingApi.Message[] {
  if (!days.length) return [];
  if (!fines.length) return [{ type: 'text', text: `${days.map(toMD).join('、')} 結算：全員達標，無罰款` }];
  return fines.map(f => ({ type: 'text' as const, text: fineText(f) }));
}

/** 14:00 結算：純文字訊息（不用 Flex） */
export function settlementTextBody(day: YMD, formMissing: string[], albumMissing: string[], fine = 500): string {
  const md = toMD(day);
  const head = `【制裁者｜結算 ${md}】`;
  const lines: string[] = [];
  for (const p of formMissing) lines.push(`• ${p} 缺表單 $${fine}`);
  for (const p of [...new Set(albumMissing)]) lines.push(`• ${p} 缺相簿 $${fine}`);
  if (!lines.length) return `${head}全員達標`;
  return [head, '截止：今日 14:00', ...lines, `合計 ${lines.length} 筆｜$${(lines.length * fine).toLocaleString('en-US')}`].join('\n');
}

export function settlementTextMessage(day: YMD, formMissing: string[], albumMissing: string[]): messagingApi.Message {
  return { type: 'text', text: settlementTextBody(day, formMissing, albumMissing) };
}


/** 管理員：選生客試算表分頁 */
export function dealTabPickerFlex(current: string, tabs: string[]): messagingApi.Message {
  const buttons: FlexComponent[] = tabs.slice(0, 12).map(tab => ({
    type: 'button',
    style: tab === current ? 'primary' : 'secondary',
    color: tab === current ? '#2E7D32' : undefined,
    action: {
      type: 'postback',
      label: tab.slice(0, 20),
      data: `action=${SET_DEAL_TAB_ACTION}&tab=${encodeURIComponent(tab)}`,
      displayText: `分頁 ${tab}`,
    },
  }));
  return {
    type: 'flex',
    altText: `選生客分頁（目前：${current}）`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', contents: [
          { type: 'text', text: '生客表分頁', weight: 'bold', size: 'md', color: '#1B5E20' },
          { type: 'text', text: `目前：${current}`, size: 'sm', color: '#555555', margin: 'md', wrap: true },
          { type: 'text', text: '點下面一個換成當月分頁', size: 'xs', color: '#888888', margin: 'sm', wrap: true },
        ],
      },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: buttons.length ? buttons : [
        { type: 'text', text: '找不到分頁', size: 'sm', color: '#999999' },
      ] },
    },
  };
}
