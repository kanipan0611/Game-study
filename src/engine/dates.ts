import type { DayLog } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 週の開始（月曜）の日付キー */
export function weekKey(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return dateKey(x);
}

const active = (l: DayLog | undefined) => !!l && (l.answered > 0 || l.reviews > 0 || l.seconds >= 300);

/** 連続学習日数（今日 or 昨日まで連続していればカウント） */
export function streakOf(days: Record<string, DayLog>, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!active(days[dateKey(d)])) d.setDate(d.getDate() - 1);
  let n = 0;
  while (active(days[dateKey(d)])) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export const isActiveDay = active;
