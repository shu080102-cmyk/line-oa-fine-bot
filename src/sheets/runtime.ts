import { DEAL_SHEET } from '../config';

let tabGetter: () => string = () => DEAL_SHEET.tab;

/** 由 index 掛上 store 覆寫，讓 deals() 讀到目前選定的分頁 */
export function setDealTabGetter(fn: () => string) {
  tabGetter = fn;
}

export function currentDealTab(): string {
  return tabGetter() || DEAL_SHEET.tab;
}
