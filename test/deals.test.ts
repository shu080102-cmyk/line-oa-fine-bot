import { it, expect } from 'vitest';
import { parseDealRows, yearFromTab } from '../src/sheets/deals';
import { requiredAlbums } from '../src/domain/fines';
it('counts 生 rows per person/date, ignores 熟 and 節', () => {
  const rows = [['10/9','小布','x','g',1,'JK',' 生 ','2+1'],['10/9','小布','','','','','生','2'],['10/9','小布','','','','','熟'],['10/9','小玫','','','','','生'],['10/1','小布','','','','','生'],['','','']];
  const deals = parseDealRows(rows, yearFromTab('「MW2026-10」的副本'));
  const m = requiredAlbums(deals, '2026-10-09');
  expect(m.get('小布')).toBe(2); expect(m.get('小玫')).toBe(1); expect(m.size).toBe(2);
});
it('year override', () => expect(yearFromTab('x', 2027)).toBe(2027));
