import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BookEntry, FieldId, GameState, Grade, MockResult, Question, QuestState } from '../types';
import { BUILTIN_QUESTIONS } from '../data/questions';
import { ACHIEVEMENTS, DAILY_POOL, WEEKLY_POOL, type QuestEvent } from '../data/meta';
import { applyAnswer, MASTERED_BOX } from '../engine/srs';
import { levelInfo, XP, xpForAnswer } from '../engine/xp';
import { dateKey, streakOf, weekKey } from '../engine/dates';
import { appliedProgress, basicProgress, calcProgress, CLEAR_RATE } from '../engine/stages';

const KEY = 'fpquest.save.v1';
const VERSION = 1;
const FIELDS: FieldId[] = ['life', 'risk', 'finance', 'tax', 'estate', 'inherit'];

export const initialState = (): GameState => ({
  version: VERSION,
  playerName: '冒険者',
  xp: 0,
  fieldXp: Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<FieldId, number>,
  records: {},
  bossCleared: {},
  stageCleared: {},
  achievements: {},
  days: {},
  bestCombo: 0,
  daily: { date: '', quests: [] },
  weekly: { week: '', quests: [] },
  mockHistory: [],
  calcDrills: { done: 0, correct: 0, byKind: {} },
  scenariosCleared: {},
  bookEntries: [],
  customQuestions: [],
  xpCaps: {},
  settings: { dailyGoalMin: 15, sound: false },
});

function load(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<GameState>;
    // 将来のバージョンアップ時はここでマイグレーション
    return { ...initialState(), ...parsed, version: VERSION };
  } catch {
    return initialState();
  }
}

function hashStr(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function pickQuests(pool: typeof DAILY_POOL, seed: string, n: number): QuestState[] {
  const ordered = [...pool].sort((a, b) => hashStr(seed + a.id) - hashStr(seed + b.id));
  return ordered.slice(0, n).map((q) => ({ id: q.id, progress: 0, claimed: false }));
}

function ensurePeriods(s: GameState, now = new Date()) {
  const d = dateKey(now);
  const w = weekKey(now);
  if (s.daily.date !== d) s.daily = { date: d, quests: pickQuests(DAILY_POOL, d, 3) };
  if (s.weekly.week !== w) s.weekly = { week: w, quests: pickQuests(WEEKLY_POOL, w, 3) };
}

export type Toast = { id: number; kind: 'xp' | 'level' | 'achievement' | 'quest' | 'info'; text: string; sub?: string };

export interface AnswerOutcome {
  xp: number;
  reasons: string[];
  levelUp: number | null;
}

interface Ctx {
  state: GameState;
  questions: Question[];
  toasts: Toast[];
  dismissToast: (id: number) => void;
  actions: ReturnType<typeof makeActions>;
}

const GameCtx = createContext<Ctx | null>(null);

function makeActions(
  mutate: <T>(fn: (s: GameState, toast: (t: Omit<Toast, 'id'>) => void) => T) => T,
) {
  const today = (s: GameState) => {
    const k = dateKey(new Date());
    if (!s.days[k]) {
      s.days[k] = { date: k, answered: 0, correct: 0, reviews: 0, seconds: 0, xp: 0 };
    }
    return s.days[k];
  };

  const bump = (s: GameState, ev: QuestEvent, n = 1) => {
    ensurePeriods(s);
    for (const [list, pool] of [
      [s.daily.quests, DAILY_POOL],
      [s.weekly.quests, WEEKLY_POOL],
    ] as const) {
      for (const q of list) {
        const def = pool.find((d) => d.id === q.id);
        if (def?.event === ev) q.progress = Math.min(def.target, q.progress + n);
      }
    }
  };

  /** 学習した日を記録（ウィークリーの学習日数カウント用） */
  const markActive = (s: GameState) => {
    const d = today(s);
    if (d.answered === 0 && d.reviews === 0) bump(s, 'studyDay');
  };

  const gainXp = (s: GameState, amount: number, field: FieldId | null, toast: (t: Omit<Toast, 'id'>) => void): number | null => {
    if (amount <= 0) return null;
    const before = levelInfo(s.xp).level;
    s.xp += amount;
    if (field) s.fieldXp[field] += amount;
    today(s).xp += amount;
    const after = levelInfo(s.xp).level;
    if (after > before) {
      toast({ kind: 'level', text: `レベルアップ！ Lv.${after}`, sub: '学習の成果が力になった！' });
      return after;
    }
    return null;
  };

  const checkAchievements = (s: GameState, toast: (t: Omit<Toast, 'id'>) => void) => {
    const recs = Object.values(s.records);
    const ctx = {
      streak: streakOf(s.days),
      masteredCount: recs.filter((r) => r.box >= MASTERED_BOX).length,
      totalAnswered: recs.reduce((a, r) => a + r.attempts, 0),
    };
    for (const a of ACHIEVEMENTS) {
      if (!s.achievements[a.id] && a.check(s, ctx)) {
        s.achievements[a.id] = Date.now();
        toast({ kind: 'achievement', text: `実績解除：${a.emoji} ${a.name}`, sub: a.desc });
      }
    }
  };

  return {
    /**
     * 問題への解答を記録する。
     * mode 'browse'（閲覧）・'mock'（模試）は SRS/XP に反映しない or XP なし。
     */
    answer(q: Question, correct: boolean, opts: { combo: number; mode: 'play' | 'review' | 'boss' | 'mock' }): AnswerOutcome {
      return mutate((s, toast) => {
        ensurePeriods(s);
        markActive(s);
        const now = Date.now();
        const prev = s.records[q.id];
        const { record, boxUp, wasDue } = applyAnswer(prev, correct, now);
        const d = today(s);
        d.answered += 1;
        if (correct) d.correct += 1;
        bump(s, 'answer');
        if (correct) bump(s, 'correct');
        const isReview = !!prev && prev.attempts > 0 && wasDue;
        if (isReview) {
          d.reviews += 1;
          bump(s, 'review');
        }
        let xp = 0;
        let reasons: string[] = [];
        if (opts.mode !== 'mock') {
          const r = xpForAnswer(q, prev, record, correct, boxUp, opts.combo);
          xp = r.xp;
          reasons = r.reason;
          if (correct && !record.firstClearXp) record.firstClearXp = true;
          if (xp > 0) record.lastXpBox = record.box;
        }
        s.records[q.id] = record;
        s.bestCombo = Math.max(s.bestCombo, opts.combo);
        const levelUp = gainXp(s, xp, q.field, toast);
        checkAchievements(s, toast);
        return { xp, reasons, levelUp };
      });
    },

    /** ステージ制覇判定（80%以上を一度は正解）。初回のみ XP */
    clearStageIfReady(field: FieldId, kind: 'basic' | 'applied' | 'calc') {
      return mutate((s, toast) => {
        const key = `${field}-${kind}`;
        if (s.stageCleared[key]) return 0;
        const qs = [...BUILTIN_QUESTIONS, ...s.customQuestions];
        const prog = kind === 'basic' ? basicProgress(field, qs, s) : kind === 'applied' ? appliedProgress(field, qs, s) : calcProgress(field, qs, s);
        if (prog < CLEAR_RATE) return 0;
        s.stageCleared[key] = Date.now();
        gainXp(s, XP.stageClear, field, toast);
        toast({ kind: 'info', text: 'ステージ制覇！', sub: `+${XP.stageClear} XP` });
        checkAchievements(s, toast);
        return XP.stageClear;
      });
    },

    bossVictory(field: FieldId, grade: Grade) {
      return mutate((s, toast) => {
        bump(s, 'boss');
        const key = `${field}-${grade}`;
        let xp = 0;
        if (!s.bossCleared[key]) {
          s.bossCleared[key] = Date.now();
          xp = XP.bossClear[grade];
          gainXp(s, xp, field, toast);
        }
        checkAchievements(s, toast);
        return xp;
      });
    },

    calcResult(kind: string, field: FieldId, correct: boolean) {
      return mutate((s, toast) => {
        ensurePeriods(s);
        markActive(s);
        const d = today(s);
        d.answered += 1;
        if (correct) d.correct += 1;
        s.calcDrills.done += 1;
        if (correct) s.calcDrills.correct += 1;
        const k = (s.calcDrills.byKind[kind] ??= { done: 0, correct: 0 });
        k.done += 1;
        if (correct) k.correct += 1;
        bump(s, 'calc');
        bump(s, 'answer');
        if (correct) bump(s, 'correct');
        let xp = 0;
        const capKey = `calc-${d.date}`;
        if (correct && (s.xpCaps[capKey] ?? 0) < XP.calcDailyCap) {
          xp = XP.calcDrill;
          s.xpCaps[capKey] = (s.xpCaps[capKey] ?? 0) + xp;
          gainXp(s, xp, field, toast);
        }
        checkAchievements(s, toast);
        return xp;
      });
    },

    scenarioDone(id: string, perfect: boolean, fields: FieldId[]) {
      return mutate((s, toast) => {
        bump(s, 'scenario');
        let xp = 0;
        if (perfect && !s.scenariosCleared[id]) {
          s.scenariosCleared[id] = Date.now();
          xp = XP.scenarioClear;
          gainXp(s, xp, fields[0] ?? null, toast);
        }
        checkAchievements(s, toast);
        return xp;
      });
    },

    mockDone(result: MockResult) {
      return mutate((s, toast) => {
        s.mockHistory.push(result);
        bump(s, 'mock');
        markActive(s);
        // 模試XPは1日1回・試験区分ごと（縮小版は半分）
        const capKey = `mock-${result.grade}-${result.part}-${dateKey(new Date())}`;
        let xp = 0;
        if (!s.xpCaps[capKey]) {
          const ratio = result.score / result.max;
          xp = Math.round(ratio * 60 * XP.mockPerPoint * (result.scaled ? 0.5 : 1));
          s.xpCaps[capKey] = xp || 1;
          gainXp(s, xp, null, toast);
        }
        checkAchievements(s, toast);
        return xp;
      });
    },

    claimQuest(id: string, kind: 'daily' | 'weekly') {
      return mutate((s, toast) => {
        const list = kind === 'daily' ? s.daily.quests : s.weekly.quests;
        const pool = kind === 'daily' ? DAILY_POOL : WEEKLY_POOL;
        const q = list.find((x) => x.id === id);
        const def = pool.find((d) => d.id === id);
        if (!q || !def || q.claimed || q.progress < def.target) return 0;
        q.claimed = true;
        const xp = kind === 'daily' ? XP.dailyQuest : XP.weeklyQuest;
        gainXp(s, xp, null, toast);
        toast({ kind: 'quest', text: `クエスト達成：${def.name}`, sub: `+${xp} XP` });
        return xp;
      });
    },

    addSeconds(sec: number) {
      mutate((s) => {
        ensurePeriods(s);
        const d = today(s);
        d.seconds += sec;
        const minutes = Math.floor(d.seconds / 60);
        for (const q of s.daily.quests) {
          const def = DAILY_POOL.find((x) => x.id === q.id);
          if (def?.event === 'minutes') q.progress = Math.min(def.target, minutes);
        }
      });
    },

    // ---------------- 史上最強シリーズ連携 ----------------
    addBook(e: Omit<BookEntry, 'id' | 'createdAt' | 'attempts'>) {
      mutate((s, toast) => {
        s.bookEntries.push({ ...e, id: `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now(), attempts: [] });
        checkAchievements(s, toast);
      });
    },
    updateBook(id: string, patch: Partial<BookEntry>) {
      mutate((s) => {
        const e = s.bookEntries.find((x) => x.id === id);
        if (e) Object.assign(e, patch);
      });
    },
    deleteBook(id: string) {
      mutate((s) => {
        s.bookEntries = s.bookEntries.filter((x) => x.id !== id);
      });
    },
    logBookAttempt(id: string, correct: boolean) {
      return mutate((s, toast) => {
        const e = s.bookEntries.find((x) => x.id === id);
        if (!e) return 0;
        ensurePeriods(s);
        markActive(s);
        e.attempts.push({ date: Date.now(), correct });
        if (e.status === 'untouched') e.status = 'solved';
        if (!correct) {
          e.weak = true;
          e.status = 'review';
        } else {
          // 直近3回連続正解で「習得」
          const last = e.attempts.slice(-3);
          if (last.length === 3 && last.every((a) => a.correct)) {
            e.status = 'mastered';
            e.weak = false;
          }
        }
        bump(s, 'book');
        const d = today(s);
        const capKey = `book-${d.date}`;
        let xp = 0;
        if ((s.xpCaps[capKey] ?? 0) < XP.bookDailyCap) {
          xp = XP.bookRecord;
          s.xpCaps[capKey] = (s.xpCaps[capKey] ?? 0) + xp;
          gainXp(s, xp, e.field, toast);
        }
        checkAchievements(s, toast);
        return xp;
      });
    },
    importBook(entries: BookEntry[]) {
      mutate((s, toast) => {
        s.bookEntries.push(...entries);
        checkAchievements(s, toast);
      });
    },
    importQuestions(qs: Question[]) {
      mutate((s) => {
        const ids = new Set([...BUILTIN_QUESTIONS.map((q) => q.id), ...s.customQuestions.map((q) => q.id)]);
        s.customQuestions.push(...qs.filter((q) => !ids.has(q.id)));
      });
    },
    deleteCustomQuestion(id: string) {
      mutate((s) => {
        s.customQuestions = s.customQuestions.filter((q) => q.id !== id);
      });
    },

    setName(name: string) {
      mutate((s) => {
        s.playerName = name.slice(0, 16) || '冒険者';
      });
    },
    setGoal(min: number) {
      mutate((s) => {
        s.settings.dailyGoalMin = min;
      });
    },
    replaceAll(next: GameState) {
      mutate((s) => {
        Object.assign(s, initialState(), next);
      });
    },
    reset() {
      mutate((s) => {
        Object.assign(s, initialState());
        ensurePeriods(s);
      });
    },
  };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(() => {
    const s = load();
    ensurePeriods(s);
    return s;
  });
  const ref = useRef(state);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(1);

  const mutate = useCallback(<T,>(fn: (s: GameState, toast: (t: Omit<Toast, 'id'>) => void) => T): T => {
    const next = structuredClone(ref.current);
    const pending: Toast[] = [];
    const result = fn(next, (t) => pending.push({ ...t, id: toastId.current++ }));
    ref.current = next;
    setState(next);
    if (pending.length) setToasts((ts) => [...ts, ...pending].slice(-4));
    return result;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* 容量超過などは無視（次回保存で再試行） */
    }
  }, [state]);

  const actions = useMemo(() => makeActions(mutate), [mutate]);
  const questions = useMemo(() => [...BUILTIN_QUESTIONS, ...state.customQuestions], [state.customQuestions]);
  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const value = useMemo(() => ({ state, questions, toasts, dismissToast, actions }), [state, questions, toasts, dismissToast, actions]);
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}

export function useGame() {
  const c = useContext(GameCtx);
  if (!c) throw new Error('GameProvider がありません');
  return c;
}

export const SAVE_KEY = KEY;
