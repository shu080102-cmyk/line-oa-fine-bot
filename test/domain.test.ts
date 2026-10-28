import { settlementTextBody } from '../src/line/messages';
import { describe, it, expect } from 'vitest';
import { businessDaysToSettle, attributeSubmission } from '../src/domain/time';
import { calcDayFines } from '../src/domain/fines';
import { parseStatus } from '../src/domain/status';
import { parseAdmin } from '../src/line/admin';
import { parseFormTimestamp } from '../src/sheets/google';
const T = (s: string) => new Date(s + '+08:00');
const amt = { form: 500, album: 500 };
describe('business day', () => {
  it('weekday → yesterday', () => expect(businessDaysToSettle('2026-10-28')).toEqual(['2026-10-27']));
  it('monday → fri..sun', () => expect(businessDaysToSettle('2026-11-02')).toEqual(['2026-10-30','2026-10-31','2026-11-01']));
  it('weekend → none', () => expect(businessDaysToSettle('2026-10-31')).toEqual([]));
  it('submission 12:59 next day counts for yesterday', () => expect(attributeSubmission(T('2026-10-28T12:59:00'))).toContain('2026-10-27'));
  it('submission 13:00 next day now counts for yesterday', () => expect(attributeSubmission(T('2026-10-28T13:00:00'))).toContain('2026-10-27'));
  it('submission 14:00 does not', () => expect(attributeSubmission(T('2026-10-28T14:00:00'))).not.toContain('2026-10-27'));
  it('monday morning counts for fri', () => expect(attributeSubmission(T('2026-11-02T10:00:00'))).toContain('2026-10-30'));
});
describe('fines', () => {
  const base = { day: '2026-10-27', roster: ['小布','小玫','小紅'], deals: [], leave: new Set<string>(), albumReports: new Map<string, number>() };
  it('missing form fined; 休假 and leave exempt from form only', () => {
    const f = calcDayFines({ ...base, leave: new Set(['小紅']), responses: [{ timestamp: T('2026-10-27T20:00:00'), person: '小玫', status: 'off', rawStatus: '' }] }, amt);
    expect(f.filter(x => x.reason === 'form').map(x => x.person)).toEqual(['小布']);
    expect(f.filter(x => x.reason === 'album')).toEqual([]); // 無生不罰相簿
  });
  it('late submit still fined', () => {
    const f = calcDayFines({ ...base, roster: ['小布'], deals: [{ date: '2026-10-27', person: '小布', isNewCustomer: true }], responses: [{ timestamp: T('2026-10-28T14:05:00'), person: '小布', status: 'work', rawStatus: '' }] }, amt);
    expect(f.map(x => x.reason)).toEqual(['form','album']);
  });
  it('album reported once = ok even with 2 生; weekend: album yes, form no', () => {
    const deals = [{ date: '2026-10-27', person: '小布', isNewCustomer: true }, { date: '2026-10-27', person: '小布', isNewCustomer: true }];
    expect(calcDayFines({ ...base, roster: ['小布'], responses: [], deals, albumReports: new Map([['小布', 1]]) }, amt).map(x => x.reason)).toEqual(['form']);
    expect(calcDayFines({ ...base, day: '2026-10-25', roster: ['小布'], deals: [{ date: '2026-10-25', person: '小布', isNewCustomer: true }], responses: [], albumReports: new Map() }, amt).map(x => x.reason)).toEqual(['album']);
    expect(calcDayFines({ ...base, day: '2026-10-25', roster: ['小布'], deals: [{ date: '2026-10-25', person: '小布', isNewCustomer: true }], responses: [], albumReports: new Map([['小布', 1]]) }, amt)).toEqual([]);
    expect(calcDayFines({ ...base, day: '2026-10-25', roster: ['小布'], deals: [{ date: '2026-10-25', person: '小布', isNewCustomer: true }], responses: [], leave: new Set(['小布']), albumReports: new Map() }, amt).map(x => x.reason)).toEqual(['album']);
  });
  it('form + album stack', () => {
    const deals = [{ date: '2026-10-27', person: '小布', isNewCustomer: true }, { date: '2026-10-27', person: '小布', isNewCustomer: true }];
    const f = calcDayFines({ ...base, roster: ['小布'], responses: [], deals, albumReports: new Map() }, amt);
    expect(f.map(x => x.reason).sort()).toEqual(['album','form']);
  });
});
describe('parsers', () => {
  it('status', () => { expect(parseStatus('⌛｜上班打卡｜🕘')).toBe('work'); expect(parseStatus('🏖️｜休假｜🏖️')).toBe('off'); });
  it('admin', () => {
    expect(parseAdmin('請假 小布 10/27', 2026)).toEqual({ kind: 'leave', person: '小布', date: '2026-10-27' });
    expect(parseAdmin('罰款 CC 300 10/26 遲到', 2026)).toMatchObject({ kind: 'fine', person: 'CC', amount: 300, date: '2026-10-26', note: '遲到' });
    expect(parseAdmin('說明').kind).toBe('help');
  });
  it('form timestamp', () => expect(parseFormTimestamp('2026/10/28 下午 12:59:00').toISOString()).toBe('2026-10-28T04:59:00.000Z'));
});

describe('album only with 生', () => {
  it('no 生 → no album fine even on weekend/leave', () => {
    expect(calcDayFines({ day: '2026-10-25', roster: ['小布'], responses: [], deals: [], leave: new Set(['小布']), albumReports: new Map() }, amt)).toEqual([]);
  });
});
describe('settlement text', () => {
  it('lists fines', () => expect(settlementTextBody('2026-10-27', ['小布'], ['尼莫'])).toBe('【制裁者｜結算 10/27】\n截止：今日 14:00\n• 小布 缺表單 $500\n• 尼莫 缺相簿 $500\n合計 2 筆｜$1,000'));
  it('all pass', () => expect(settlementTextBody('2026-10-27', [], [])).toBe('【制裁者｜結算 10/27】全員達標'));
});
