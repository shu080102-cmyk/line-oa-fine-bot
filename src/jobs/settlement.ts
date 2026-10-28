import { config } from '../config';
import { calcDayFines } from '../domain/fines';
import { businessDaysToSettle, toTaipeiYMD } from '../domain/time';
import { Fine } from '../domain/types';
import { pushFineGroup } from '../line/client';
import { settlementsFromFines } from '../line/messages';
import { SheetsReader } from '../sheets';
import { Store } from '../store';
export async function runSettlement(store: Store, reader: SheetsReader, now = new Date()) {
  const days = businessDaysToSettle(toTaipeiYMD(now)).filter(d => !store.isSettled(d));
  if (!days.length) return [];
  const [roster, responses, deals] = await Promise.all([reader.roster(), reader.formResponses(), reader.deals().catch(e => { console.warn('deals unavailable:', e.message); return []; })]);
  const all: Fine[] = [];
  for (const day of days) {
    for (const f of calcDayFines({ day, roster, responses, deals, leave: store.leaveSet(day), albumReports: store.albumCounts(day) }, { form: config.fineForm, album: config.fineAlbum }, now)) all.push(store.addFine(f));
    store.markSettled(day);
  }
  await pushFineGroup(settlementsFromFines(days, all));
  return all;
}
