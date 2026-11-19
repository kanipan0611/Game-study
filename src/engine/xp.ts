import type { FieldId, GameState, Question, QuestionRecord } from '../types';
import { retention } from './srs';

// ============================================================
// 経験値ルール（XP稼ぎ防止の設計）
//  - 初回正解のみ基本XP（難易度×級で増減）
//  - 復習で「期限到来済みの問題」に正解し箱が上がった時のみ復習XP
//    （同じ箱で二度は付与しない → 同じ問題の連打で稼げない）
//  - 期限前の再挑戦・閲覧モードは XP 0
//  - ボス・ステージ・シナリオは初回クリアのみ
//  - 計算特訓・教材記録は1日の上限あり
// ============================================================

export const XP = {
  firstClear: { 1: 10, 2: 15, 3: 25 } as Record<1 | 2 | 3, number>,
  grade2Mult: 1.5,
  reviewBase: 8,
  reviewPerBox: 3,
  overcome: 10, // 一度間違えた問題を復習で克服
  comboBonus: 2, // コンボ3以上で付与（XP対象の解答時のみ）
  stageClear: 50,
  bossClear: { 3: 150, 2: 250 } as Record<2 | 3, number>,
  scenarioClear: 100,
  calcDrill: 6,
  calcDailyCap: 120,
  bookRecord: 3,
  bookDailyCap: 30,
  dailyQuest: 30,
  weeklyQuest: 120,
  mockPerPoint: 2,
};

export interface AnswerXp {
  xp: number;
  reason: string[];
}

export function xpForAnswer(
  q: Question,
  prev: QuestionRecord | undefined,
  next: QuestionRecord,
  correct: boolean,
  boxUp: boolean,
  combo: number,
): AnswerXp {
  const reason: string[] = [];
  if (!correct) return { xp: 0, reason };
  let xp = 0;
  const mult = q.grade === 2 ? XP.grade2Mult : 1;
  if (!prev?.firstClearXp) {
    xp += Math.round(XP.firstClear[q.difficulty] * mult);
    reason.push('初回正解');
    if (prev && prev.attempts > 0) {
      xp += XP.overcome;
      reason.push('苦手克服');
    }
  } else if (boxUp && next.box > (prev.lastXpBox ?? -1)) {
    xp += XP.reviewBase + XP.reviewPerBox * next.box;
    reason.push(`復習 定着Lv${next.box}`);
    if (prev.wrongStreak > 0 || prev.box === 0) {
      xp += XP.overcome;
      reason.push('苦手克服');
    }
  }
  if (xp > 0 && combo >= 3) {
    xp += XP.comboBonus * Math.min(5, Math.floor(combo / 3));
    reason.push(`${combo}コンボ`);
  }
  return { xp, reason };
}

// ------------------------------------------------------------
// レベル曲線
// ------------------------------------------------------------
export const xpToReach = (level: number) => Math.round(60 * Math.pow(level - 1, 1.65));

export function levelInfo(xp: number) {
  let lv = 1;
  while (xpToReach(lv + 1) <= xp) lv++;
  const cur = xpToReach(lv);
  const next = xpToReach(lv + 1);
  return { level: lv, cur, next, progress: (xp - cur) / (next - cur) };
}

export const TITLES: { level: number; title: string }[] = [
  { level: 1, title: '見習い冒険者' },
  { level: 5, title: '家計の守り手' },
  { level: 10, title: '係数使い' },
  { level: 15, title: 'FP3級の勇者' },
  { level: 20, title: '税と保険の賢者' },
  { level: 28, title: 'FP2級の英雄' },
  { level: 36, title: 'アカデミーの伝説' },
];
export const titleFor = (lv: number) => [...TITLES].reverse().find((t) => lv >= t.level)!.title;

// ------------------------------------------------------------
// 実力評価：ゲーム上のレベルと実際の学力の乖離を防ぐ
// ------------------------------------------------------------
export interface FieldMastery {
  field: FieldId;
  /** 定着度（0〜1）：全問題に対する SRS 箱の平均 */
  retention: number;
  /** 正答率（解答済みのみ） */
  accuracy: number;
  answered: number;
  total: number;
  dueCount: number;
}

export function fieldMastery(field: FieldId, questions: Question[], s: GameState, now: number, grade?: 2 | 3): FieldMastery {
  const qs = questions.filter((q) => q.field === field && (!grade || q.grade === grade));
  let ret = 0;
  let att = 0;
  let cor = 0;
  let answered = 0;
  let due = 0;
  for (const q of qs) {
    const r = s.records[q.id];
    ret += retention(r);
    if (r && r.attempts > 0) {
      answered++;
      att += r.attempts;
      cor += r.correct;
      if (r.due <= now) due++;
    }
  }
  return {
    field,
    retention: qs.length ? ret / qs.length : 0,
    accuracy: att ? cor / att : 0,
    answered,
    total: qs.length,
    dueCount: due,
  };
}

/**
 * 推定実力（0〜100）。定着度 60％ ＋ 直近模試 40％。
 * 模試未受験なら定着度のみで、"暫定" と表示する。
 */
export function estimatedScore(s: GameState, questions: Question[], grade: 2 | 3, now: number) {
  const fields: FieldId[] = ['life', 'risk', 'finance', 'tax', 'estate', 'inherit'];
  const ret = fields.reduce((a, f) => a + fieldMastery(f, questions, s, now, grade).retention, 0) / fields.length;
  const mocks = s.mockHistory.filter((m) => m.grade === grade && m.part === 'gakka').slice(-3);
  const mockRate = mocks.length ? mocks.reduce((a, m) => a + m.score / m.max, 0) / mocks.length : null;
  const score = mockRate === null ? ret * 100 : (ret * 0.6 + mockRate * 0.4) * 100;
  return { score: Math.round(score), retention: ret, mockRate, provisional: mockRate === null };
}
