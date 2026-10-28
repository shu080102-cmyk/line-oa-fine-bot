import fs from 'fs'; import path from 'path'; import { randomUUID } from 'crypto';
import { config } from '../config';
import { Fine, YMD } from '../domain/types';
interface Data {
  albums: { date: YMD; person: string; userId: string; at: string }[];
  leave: { date: YMD; person: string }[];
  fines: Fine[];
  settled: YMD[];
  users: Record<string, string>;
  /** 生客表目前使用的分頁名；空＝用 env DEAL_SHEET_TAB */
  dealSheetTab?: string;
  /** 罰款群 groupId 覆寫；空＝用 env LINE_FINE_GROUP_ID */
  fineGroupId?: string;
}
const empty = (): Data => ({ albums: [], leave: [], fines: [], settled: [], users: {} });
export class Store {
  private d: Data;
  constructor(private file = config.dataFile) { this.d = fs.existsSync(file) ? { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) } : empty(); }
  private save() { fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.d, null, 2)); }
  bindUser(userId: string, person: string) { this.d.users[userId] = person; this.save(); }
  personOf(userId: string) { return this.d.users[userId]; }
  addAlbum(date: YMD, person: string, userId: string) { this.d.albums.push({ date, person, userId, at: new Date().toISOString() }); this.save(); }
  albumCounts(date: YMD) { const m = new Map<string, number>(); for (const a of this.d.albums) if (a.date === date) m.set(a.person, (m.get(a.person) ?? 0) + 1); return m; }
  clearAlbum(date: YMD, person: string) { const n = this.d.albums.length; this.d.albums = this.d.albums.filter(a => !(a.date === date && a.person === person)); this.save(); return n - this.d.albums.length; }
  addLeave(date: YMD, person: string) { this.d.leave.push({ date, person }); this.save(); }
  leaveSet(date: YMD) { return new Set(this.d.leave.filter(l => l.date === date).map(l => l.person)); }
  addFine(f: Omit<Fine, 'id'>) { const x = { ...f, id: randomUUID() }; this.d.fines.push(x); this.save(); return x; }
  fines(date?: YMD) { return date ? this.d.fines.filter(f => f.date === date) : this.d.fines; }
  isSettled(d: YMD) { return this.d.settled.includes(d); }
  markSettled(d: YMD) { this.d.settled.push(d); this.save(); }
  getDealSheetTab() { return this.d.dealSheetTab; }
  setDealSheetTab(tab: string) { this.d.dealSheetTab = tab; this.save(); }
  getFineGroupId() { return this.d.fineGroupId; }
  setFineGroupId(id: string) { this.d.fineGroupId = id; this.save(); }
}
