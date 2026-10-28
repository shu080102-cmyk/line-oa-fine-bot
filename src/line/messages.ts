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

/** 早上／盤點：今日應交清單（版面比照成交小幫手，發送帳＝制裁者 OA） */
export function remindChecklistFlex(day: YMD, people: PersonDayStatus[], deadline = '14:00'): messagingApi.Message[] {
  const md = toMD(day);
  const rows: FlexComponent[] = people.map(p => {
    if (p.leave) {
      return {
        type: 'box', layout: 'vertical', margin: 'md', contents: [
          { type: 'text', text: p.person, weight: 'bold', size: 'sm' },
          { type: 'text', text: '休假 ⏭', size: 'sm', color: '#888888', margin: 'xs' },
        ],
      };
    }
    const form = p.formOk ? '表單 ✔' : '表單 ✘';
    const need = p.albumNeed ?? 0;
    const reported = p.albumReported ?? 0;
    let album: string;
    if (need <= 0) album = '無需相簿';
    else if (reported > 0) album = `相簿 ✔（應交${need}張）`;
    else album = `相簿 ${need}張`;
    return {
      type: 'box', layout: 'vertical', margin: 'md', contents: [
        { type: 'text', text: p.person, weight: 'bold', size: 'sm' },
        { type: 'text', text: `${form}　${album}`, size: 'sm', color: '#555555', margin: 'xs', wrap: true },
      ],
    };
  });

  // 只有應交相簿且尚未回報的人有按鈕；label/displayText＝暱稱，別人按了 handler 會丟棄
  const pendingAlbum = people.filter(
    p => !p.leave && (p.albumNeed ?? 0) > 0 && (p.albumReported ?? 0) <= 0,
  );

  const mkBubble = (footerPeople: PersonDayStatus[], withHeader: boolean): FlexBubble => {
    const footerContents: FlexComponent[] = footerPeople.map(p => ({
      type: 'button',
      style: 'primary',
      color: '#2E7D32',
      action: {
        type: 'postback',
        label: p.person.slice(0, 20),
        data: `action=${UPLOAD_ACTION}&date=${day}&person=${encodeURIComponent(p.person)}`,
        displayText: p.person,
      },
    }));
    if (footerPeople.length) {
      footerContents.push({ type: 'text', text: '應交相簿的人點自己的名字', size: 'xs', color: '#888888', align: 'center' });
    } else if (withHeader) {
      footerContents.push({ type: 'text', text: '今日無需相簿回報', size: 'xs', color: '#888888', align: 'center' });
    }
    const bodyContents: FlexComponent[] = withHeader
      ? [
          {
            type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '📋', flex: 0, size: 'lg' },
              { type: 'text', text: `今日應交清單 | ${md}`, weight: 'bold', size: 'md', color: '#1B5E20', margin: 'sm', wrap: true },
            ],
          },
          {
            type: 'box', layout: 'horizontal', margin: 'md', contents: [
              { type: 'text', text: '⏰', flex: 0, size: 'sm' },
              { type: 'text', text: `截止 ${deadline}`, size: 'sm', color: '#666666', margin: 'sm' },
            ],
          },
          sep(),
          ...rows,
        ]
      : [
          { type: 'text', text: '應交相簿（續）', weight: 'bold', size: 'sm', color: '#1B5E20' },
        ];
    const bubble: FlexBubble = {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', contents: bodyContents },
    };
    if (footerContents.length) {
      bubble.footer = { type: 'box', layout: 'vertical', spacing: 'sm', contents: footerContents };
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

export function settlementsFromFines(days: YMD[], fines: Fine[]): messagingApi.Message[] {
  if (!days.length) return [];
  return days.map(day => {
    const dayFines = fines.filter(f => f.date === day);
    const formMissing = [...new Set(dayFines.filter(f => f.reason === 'form').map(f => f.person))];
    const albumMissing = dayFines.filter(f => f.reason === 'album').map(f => {
      const m = f.note?.match(/需\s*(\d+)/);
      return { person: f.person, need: m ? Number(m[1]) : 1 };
    });
    return settlementTextMessage(day, formMissing, albumMissing.map(a => a.person));
  });
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
