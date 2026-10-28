import { FormStatus } from './types';
/** 狀態欄含 emoji，如「⌛｜上班打卡｜🕘」「🏖️｜休假｜🏖️」；兩者皆有時以休假優先（免罰） */
export function parseStatus(raw: string): FormStatus {
  if (raw.includes('休假')) return 'off';
  if (raw.includes('上班打卡')) return 'work';
  return 'unknown';
}
