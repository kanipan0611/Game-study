import type { FieldId, GameState, Question, StageKind } from '../types';

// ステージの出題範囲と解放条件。
//  基礎(3級) → 80%を1回以上正解で「制覇」 → 3級ボス解放
//  3級ボス撃破 → 応用(2級)ステージ解放
//  応用 80% 正解 → 2級ボス解放
// ロック中のステージも「閲覧モード」で問題と解説を読める（XP・記録なし）。

export const CLEAR_RATE = 0.8;

export function stagePool(field: FieldId, kind: StageKind, qs: Question[], s: GameState): Question[] {
  const inField = qs.filter((q) => q.field === field);
  switch (kind) {
    case 'basic':
      return inField.filter((q) => q.grade === 3 && q.format !== 'numeric');
    case 'applied':
      return inField.filter((q) => q.grade === 2 && q.format !== 'numeric');
    case 'calc':
      return inField.filter((q) => q.format === 'numeric' && (q.grade === 3 || appliedUnlocked(field, s)));
    case 'review':
    case 'boss':
      return inField.filter((q) => q.grade === 3 || appliedUnlocked(field, s));
  }
}

const clearedRate = (pool: Question[], s: GameState) =>
  pool.length ? pool.filter((q) => (s.records[q.id]?.box ?? 0) >= 1 || (s.records[q.id]?.correct ?? 0) > 0).length / pool.length : 0;

export const basicProgress = (field: FieldId, qs: Question[], s: GameState) => clearedRate(stagePool(field, 'basic', qs, s), s);
export const appliedProgress = (field: FieldId, qs: Question[], s: GameState) => clearedRate(stagePool(field, 'applied', qs, s), s);
export const calcProgress = (field: FieldId, qs: Question[], s: GameState) => clearedRate(stagePool(field, 'calc', qs, s), s);

export const appliedUnlocked = (field: FieldId, s: GameState) => !!s.bossCleared[`${field}-3`];
export const bossUnlocked = (field: FieldId, grade: 2 | 3, qs: Question[], s: GameState) =>
  grade === 3 ? basicProgress(field, qs, s) >= CLEAR_RATE : appliedUnlocked(field, s) && appliedProgress(field, qs, s) >= CLEAR_RATE;

export function stageUnlocked(field: FieldId, kind: StageKind, qs: Question[], s: GameState) {
  if (kind === 'applied') return appliedUnlocked(field, s);
  if (kind === 'boss') return bossUnlocked(field, 3, qs, s);
  return true;
}

export function shuffle<T>(xs: T[], rand = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * セッションの出題順：未解答 → 復習期限到来 → 苦手（箱が低い）順。
 * 1セッション8問 ≒ 5〜7分。1日2〜3セッションで15〜20分。
 */
export function buildSession(pool: Question[], s: GameState, size = 8, now = Date.now()) {
  const score = (q: Question) => {
    const r = s.records[q.id];
    if (!r || r.attempts === 0) return 0;
    if (r.due <= now) return 1 + r.box / 10;
    return 3 + r.box;
  };
  return shuffle(pool)
    .sort((a, b) => score(a) - score(b))
    .slice(0, size);
}

/** 復習クエスト対象（期限が来た問題）を苦手順に */
export function dueQuestions(qs: Question[], s: GameState, now = Date.now()) {
  return qs
    .filter((q) => {
      const r = s.records[q.id];
      return r && r.attempts > 0 && r.due <= now;
    })
    .sort((a, b) => (s.records[a.id].box - s.records[b.id].box) || (s.records[a.id].due - s.records[b.id].due));
}

/** トピック（スキルツリーのノード）の習得状況 */
export function topicStatus(topic: string, qs: Question[], s: GameState) {
  const pool = qs.filter((q) => q.topic === topic);
  if (!pool.length) return { pool: 0, learned: 0, mastered: 0, state: 'empty' as const };
  const learned = pool.filter((q) => (s.records[q.id]?.correct ?? 0) > 0).length;
  const mastered = pool.filter((q) => (s.records[q.id]?.box ?? 0) >= 3).length;
  const state = mastered === pool.length ? 'mastered' : learned === pool.length ? 'learned' : learned > 0 ? 'learning' : 'new';
  return { pool: pool.length, learned, mastered, state } as const;
}

export const STAGE_LABEL: Record<StageKind, string> = {
  basic: '基礎ステージ（3級）',
  applied: '応用ステージ（2級）',
  calc: '計算問題ステージ',
  review: '総合演習',
  boss: 'ボス戦',
};
