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
  return { type: 'separator', margin: 'sm', color: '#D5DCE3' };
}

function bullet(text: string, color = '#333333'): FlexComponent {
  return {
    type: 'box', layout: 'horizontal', margin: 'sm', contents: [
      { type: 'text', text: '•', size: 'sm', color: '#E53935', flex: 0 },
      { type: 'text', text, size: 'sm', color, wrap: true, margin: 'sm' },
    ],
  };
}

/** 今日應交清單（制裁者 OA）：灰色版型＋頭圖 plate、表格 姓名/表單/相簿、footer 只放待回報相簿者 */
export function remindChecklistFlex(
  day: YMD, people: PersonDayStatus[], deadline = '14:00', opts: { headerImageUrl?: string } = {},
): messagingApi.Message[] {
  const md = toMD(day);
  const OK = '#2C8E6C';
  const NG = '#CB3747';
  const MUTED = '#9AA4AE';
  const INK = '#1F2A36';
  const HEAD_BG = '#DDE3E9';
  const BODY_BG = '#F3F5F7';
  const BTN = '#C8D1DB';

  const t = (text: string, color: string, size = 'sm', bold = true): messagingApi.FlexText =>
    ({ type: 'text', text, size, color, weight: bold ? 'bold' : 'regular', align: 'center' } as messagingApi.FlexText);

  const rows: FlexComponent[] = [{
    type: 'box', layout: 'horizontal', paddingBottom: '6px', contents: [
      { type: 'text', text: '姓名', size: 'xs', color: MUTED, flex: 3, weight: 'bold' },
      { type: 'text', text: '表單', size: 'xs', color: MUTED, flex: 2, align: 'center', weight: 'bold' },
      { type: 'text', text: '相簿', size: 'xs', color: MUTED, flex: 3, align: 'center', weight: 'bold' },
    ],
  }, sep()];
  people.forEach(p => {
    let form: FlexComponent, album: FlexComponent;
    if (p.leave) {
      form = t('—', MUTED); album = t('休假', MUTED, 'sm', false);
    } else {
      const need = p.albumNeed ?? 0;
      const reported = p.albumReported ?? 0;
      form = p.formOk ? t('✓', OK, 'md') : t('✕', NG, 'md');
      album = need <= 0 ? t('無需相簿', MUTED, 'xs', false)
        : reported > 0 ? t('✓', OK, 'md')
        : t(`✕ ${need}張`, NG, 'sm');
    }
    rows.push({
      type: 'box', layout: 'horizontal', paddingTop: '8px', paddingBottom: '8px', alignItems: 'center', contents: [
        { type: 'text', text: p.person, size: 'md', weight: 'bold', color: p.leave ? MUTED : INK, flex: 3, wrap: true },
        { type: 'box', layout: 'vertical', flex: 2, contents: [form] },
        { type: 'box', layout: 'vertical', flex: 3, contents: [album] },
      ],
    });
    rows.push({ type: 'separator', color: '#E3E8ED' });
  });

  const pendingAlbum = people.filter(
    p => !p.leave && (p.albumNeed ?? 0) > 0 && (p.albumReported ?? 0) <= 0,
  );

  const header = (title: string, full: boolean): messagingApi.FlexBox => {
    const left: FlexComponent[] = [
      { type: 'text', text: '制裁者', size: 'xs', weight: 'bold', color: '#5B6773' },
      { type: 'box', layout: 'vertical', margin: 'sm', width: '36px', height: '3px', backgroundColor: '#222222', contents: [] },
      { type: 'text', text: title, size: full ? 'xl' : 'lg', weight: 'bold', color: INK, margin: 'md' },
      { type: 'text', text: md, size: 'md', weight: 'bold', color: '#4A5662', margin: 'md' },
      {
        type: 'box', layout: 'vertical', flex: 0, margin: 'md', backgroundColor: '#E4E8ED', cornerRadius: '10px',
        paddingStart: '14px', paddingEnd: '14px', paddingTop: '8px', paddingBottom: '8px',
        contents: [{ type: 'text', text: `截止 ${deadline}`, size: 'xl', weight: 'bold', color: INK }],
      },
    ];
    const contents: FlexComponent[] = [{ type: 'box', layout: 'vertical', flex: 3, justifyContent: 'center', contents: left }];
    if (opts.headerImageUrl) {
      contents.push({ type: 'image', url: opts.headerImageUrl, flex: 2, size: 'full', aspectMode: 'cover', aspectRatio: '1:1', gravity: 'center' });
    }
    return {
      type: 'box', layout: 'horizontal', backgroundColor: HEAD_BG, paddingAll: '16px', alignItems: 'center', contents,
    };
  };

  const mkBubble = (footerPeople: PersonDayStatus[], withHeader: boolean): FlexBubble => {
    const footerContents: FlexComponent[] = [];
    if (footerPeople.length) {
      footerContents.push({ type: 'text', text: '已上傳相簿 → 按自己的名字', size: 'sm', weight: 'bold', color: INK, align: 'center' });
      footerPeople.forEach(p => footerContents.push({
        type: 'box', layout: 'horizontal', backgroundColor: BTN, cornerRadius: '10px', paddingAll: '12px', alignItems: 'center',
        action: {
          type: 'postback',
          label: `${p.person} 我已上傳`.slice(0, 20),
          data: `action=${UPLOAD_ACTION}&date=${day}&person=${encodeURIComponent(p.person)}`,
          displayText: p.person,
        },
        contents: [
          { type: 'text', text: p.person, size: 'md', weight: 'bold', color: INK, flex: 2 },
          { type: 'text', text: '|', size: 'md', color: '#8A96A3', flex: 0 },
          { type: 'text', text: '我已上傳 →', size: 'md', weight: 'bold', color: INK, flex: 3, align: 'end' },
        ],
      }));
      footerContents.push({ type: 'text', text: '只按自己的名字，按別人的不算', size: 'xs', color: '#8A96A3', align: 'center', margin: 'sm' });
    } else if (withHeader) {
      footerContents.push({ type: 'text', text: '今日無需相簿回報', size: 'xs', color: '#8A96A3', align: 'center' });
    }
    const bubble: FlexBubble = {
      type: 'bubble',
      size: 'mega',
      header: header(withHeader ? '今日應交清單' : '應交相簿（續）', withHeader),
      body: {
        type: 'box', layout: 'vertical', paddingAll: '14px', backgroundColor: BODY_BG,
        contents: withHeader ? rows : [{ type: 'text', text: '請以下同仁回報相簿', size: 'sm', color: '#5B6773' }],
      },
      styles: { header: { backgroundColor: HEAD_BG }, body: { backgroundColor: BODY_BG }, footer: { backgroundColor: BODY_BG, separator: true, separatorColor: '#DDE3E9' } },
    };
    if (footerContents.length) {
      bubble.footer = { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px', backgroundColor: BODY_BG, contents: footerContents };
    }
    return bubble;
  };

  const chunk = 8;
  const bubbles: FlexBubble[] = [];
  if (!pendingAlbum.length) {
    bubbles.push(mkBubble([], true));
  } else {
    for (let i = 0; i < pendingAlbum.length; i += chunk) {
      bubbles.push(mkBubble(pendingAlbum.slice(i, i + chunk), i === 0));
    }
  }
  const flexContents = bubbles.length === 1 ? bubbles[0] : { type: 'carousel' as const, contents: bubbles };
  return [
    { type: 'text', text: '以下是今日應交清單，請大家確認上傳。' },
    { type: 'flex', altText: `今日應交清單 | ${md} 截止 ${deadline}`, contents: flexContents },
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
