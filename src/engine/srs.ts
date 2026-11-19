import type { QuestionRecord } from '../types';

// 間隔反復（ライトナー方式）。箱が上がるほど次の出題までの間隔が伸びる。
// 箱0：要復習（10分後）、箱5：定着（30日後に確認）
export const DAY = 24 * 60 * 60 * 1000;
export const INTERVALS = [10 * 60 * 1000, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];
export const MASTERED_BOX = 4;

export const emptyRecord = (): QuestionRecord => ({
  attempts: 0,
  correct: 0,
  box: 0,
  due: 0,
  lastAnswered: 0,
  firstClearXp: false,
  lastXpBox: -1,
  wrongStreak: 0,
});

/** その問題が「復習期限が来ている」か */
export const isDue = (r: QuestionRecord | undefined, now: number) => !!r && r.attempts > 0 && r.due <= now;

/**
 * 解答結果を反映した新しいレコードを返す。
 * dueReview: 期限到来済みの問題か（期限前に正解しても箱は上がらない＝詰め込み防止）
 */
export function applyAnswer(prev: QuestionRecord | undefined, correct: boolean, now: number) {
  const r = { ...(prev ?? emptyRecord()) };
  const wasDue = r.attempts === 0 || r.due <= now;
  r.attempts += 1;
  r.lastAnswered = now;
  let boxUp = false;
  if (correct) {
    r.correct += 1;
    r.wrongStreak = 0;
    if (wasDue) {
      r.box = Math.min(5, r.box + 1);
      r.due = now + INTERVALS[r.box];
      boxUp = true;
    }
  } else {
    r.wrongStreak += 1;
    r.box = 0;
    r.due = now + INTERVALS[0];
  }
  return { record: r, wasDue, boxUp };
}

/** 理解度（0〜1）：箱の高さを定着度とみなす */
export const retention = (r: QuestionRecord | undefined) => (r ? Math.min(1, r.box / MASTERED_BOX) : 0);
