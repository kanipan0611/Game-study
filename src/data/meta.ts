import type { GameState } from '../types';
import { SCENARIOS } from './scenarios';

// ---------------- デイリー / ウィークリー クエスト ----------------
export interface QuestDef {
  id: string;
  name: string;
  target: number;
  emoji: string;
  /** 進捗を数えるイベント */
  event: QuestEvent;
}

export type QuestEvent =
  | 'answer'
  | 'correct'
  | 'review'
  | 'calc'
  | 'minutes'
  | 'book'
  | 'boss'
  | 'mock'
  | 'scenario'
  | 'studyDay'
  | 'grade2';

export const DAILY_POOL: QuestDef[] = [
  { id: 'd-answer10', name: '問題を10問解く', target: 10, emoji: '📝', event: 'answer' },
  { id: 'd-correct8', name: '8問正解する', target: 8, emoji: '✅', event: 'correct' },
  { id: 'd-review3', name: '復習クエストを3問こなす', target: 3, emoji: '🔁', event: 'review' },
  { id: 'd-calc3', name: '計算特訓を3問解く', target: 3, emoji: '🧮', event: 'calc' },
  { id: 'd-min15', name: '15分間学習する', target: 15, emoji: '⏱️', event: 'minutes' },
  { id: 'd-book2', name: '史上最強問題集の記録を2件つける', target: 2, emoji: '📚', event: 'book' },
];

export const WEEKLY_POOL: QuestDef[] = [
  { id: 'w-days5', name: '5日間学習する', target: 5, emoji: '📅', event: 'studyDay' },
  { id: 'w-review20', name: '復習を20問こなす', target: 20, emoji: '🔁', event: 'review' },
  { id: 'w-boss1', name: 'ボスを1体倒す（再戦可）', target: 1, emoji: '👑', event: 'boss' },
  { id: 'w-mock1', name: '模擬試験を1回受ける', target: 1, emoji: '🎓', event: 'mock' },
  { id: 'w-scenario2', name: '実務シミュレーションを2件解決', target: 2, emoji: '🤝', event: 'scenario' },
  { id: 'w-calc20', name: '計算特訓を20問', target: 20, emoji: '🧮', event: 'calc' },
];

// ---------------- 実績・称号 ----------------
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  check: (s: GameState, ctx: AchCtx) => boolean;
}
export interface AchCtx {
  streak: number;
  masteredCount: number;
  totalAnswered: number;
}

const bossCount = (s: GameState, g: 2 | 3) => Object.keys(s.bossCleared).filter((k) => k.endsWith(`-${g}`)).length;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-step', name: '冒険の始まり', desc: '最初の問題に解答する', emoji: '🗝️', check: (_s, c) => c.totalAnswered >= 1 },
  { id: 'answer-100', name: '百問の旅人', desc: '累計100問に解答', emoji: '🥾', check: (_s, c) => c.totalAnswered >= 100 },
  { id: 'answer-500', name: '千里の道', desc: '累計500問に解答', emoji: '🏃', check: (_s, c) => c.totalAnswered >= 500 },
  { id: 'combo-5', name: '連撃', desc: '5問連続正解', emoji: '⚡', check: (s) => s.bestCombo >= 5 },
  { id: 'combo-15', name: '怒涛の連撃', desc: '15問連続正解', emoji: '🌩️', check: (s) => s.bestCombo >= 15 },
  { id: 'streak-3', name: '三日坊主卒業', desc: '3日連続で学習', emoji: '🔥', check: (_s, c) => c.streak >= 3 },
  { id: 'streak-7', name: '一週間の誓い', desc: '7日連続で学習', emoji: '🔥', check: (_s, c) => c.streak >= 7 },
  { id: 'streak-30', name: '不屈の学徒', desc: '30日連続で学習', emoji: '🌋', check: (_s, c) => c.streak >= 30 },
  { id: 'mastered-20', name: '記憶の書庫', desc: '20問を定着レベルまで復習', emoji: '📖', check: (_s, c) => c.masteredCount >= 20 },
  { id: 'mastered-60', name: '知識の大図書館', desc: '60問を定着レベルまで復習', emoji: '🏛️', check: (_s, c) => c.masteredCount >= 60 },
  { id: 'boss-first', name: '初陣の勝利', desc: 'ボスを初めて倒す', emoji: '⚔️', check: (s) => bossCount(s, 3) + bossCount(s, 2) >= 1 },
  { id: 'boss-all3', name: 'FP3級 六大制覇', desc: '6分野すべての3級ボスを撃破', emoji: '👑', check: (s) => bossCount(s, 3) >= 6 },
  { id: 'boss-all2', name: 'FP2級 六大制覇', desc: '6分野すべての2級ボスを撃破', emoji: '💎', check: (s) => bossCount(s, 2) >= 6 },
  { id: 'mock-pass3', name: '3級合格ライン', desc: '3級学科模試で合格基準を突破', emoji: '🎖️', check: (s) => s.mockHistory.some((m) => m.grade === 3 && m.part === 'gakka' && m.passed && !m.scaled) },
  { id: 'mock-pass2', name: '2級合格ライン', desc: '2級学科模試で合格基準を突破', emoji: '🏅', check: (s) => s.mockHistory.some((m) => m.grade === 2 && m.part === 'gakka' && m.passed && !m.scaled) },
  { id: 'calc-50', name: '電卓の達人', desc: '計算特訓で50問正解', emoji: '🧮', check: (s) => s.calcDrills.correct >= 50 },
  { id: 'scenario-all', name: '頼れるFP', desc: '実務シミュレーションを全件解決', emoji: '🤝', check: (s) => SCENARIOS.every((x) => s.scenariosCleared[x.id]) },
  { id: 'scenario-5', name: '駆け出しFP', desc: '実務シミュレーションを5件解決', emoji: '🗂️', check: (s) => Object.keys(s.scenariosCleared).length >= 5 },
  { id: 'book-10', name: '二刀流の学徒', desc: '史上最強問題集の記録を10件登録', emoji: '📚', check: (s) => s.bookEntries.length >= 10 },
];
