import { messagingApi } from '@line/bot-sdk';
import { Fine, YMD } from '../domain/types';
export const UPLOAD_ACTION = 'album_uploaded';
export function remindFlex(day: YMD, deadline: string): messagingApi.Message {
  return { type: 'flex', altText: `提醒：${day} 表單與相簿`, contents: { type: 'bubble',
    body: { type: 'box', layout: 'vertical', contents: [
      { type: 'text', text: `📋 ${day} 業務日提醒`, weight: 'bold', size: 'lg' },
      { type: 'text', text: `請於 ${deadline} 前填表單、上傳生客相簿到群組相簿。`, wrap: true },
    ] },
    footer: { type: 'box', layout: 'vertical', contents: [
      { type: 'button', style: 'primary', action: { type: 'postback', label: '我已上傳', data: `action=${UPLOAD_ACTION}&date=${day}`, displayText: '我已上傳' } },
    ] } } };
}
const reasonLabel = { form: '未填表單', album: '未傳相簿', manual: '手動' } as const;
export function settlementText(days: YMD[], fines: Fine[]): messagingApi.Message {
  if (!fines.length) return { type: 'text', text: `✅ ${days.join('、')} 結算：全員達標，無罰款` };
  const lines = fines.map(f => `${f.date} ${f.person}｜${reasonLabel[f.reason]} ${f.amount}`);
  const total = fines.reduce((s, f) => s + f.amount, 0);
  return { type: 'text', text: `⚠️ ${days.join('、')} 結算\n${lines.join('\n')}\n合計 ${total} 元` };
}
