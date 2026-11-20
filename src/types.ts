// ============================================================
// FP QUEST — ドメイン型定義（STEP 1: データ構造設計）
// 問題データ・進捗データ・教材記録はすべてこの型に従う。
// CSV インポート / 将来の OCR 取り込みもこの型へ変換して扱う。
// ============================================================

export type FieldId = 'life' | 'risk' | 'finance' | 'tax' | 'estate' | 'inherit';
export type Grade = 3 | 2;

/** ダンジョン内のステージ種別 */
export type StageKind = 'basic' | 'applied' | 'calc' | 'review' | 'boss';

export type QuestionFormat =
  | 'truefalse' // ○×
  | 'single' // 択一（3級は三答択一、2級は四答択一）
  | 'multi' // 複数選択
  | 'numeric' // 計算（数値入力）
  | 'case'; // 事例（設例 + 択一）

/** 制度の検証状態。現行制度に対応済みと断言できるものだけ 'verified' */
export type VerifyStatus = 'verified' | 'needs-review' | 'outdated';

export interface LawMeta {
  /** 適用年度（法令基準日）例: '2026-04-01' */
  basisDate: string;
  /** 根拠（法令名・制度名） */
  basis: string;
  /** 出典（公的機関の一次情報） */
  source: string;
  status: VerifyStatus;
  /** 改正予定や注意点 */
  note?: string;
}

export interface Choice {
  id: string;
  text: string;
  /** なぜ正しい／誤りなのか（選択肢ごとの解説） */
  why: string;
}

/** 実技試験の「資料」（キャッシュフロー表・保険証券・登記事項証明書・親族関係図など） */
export interface Exhibit {
  title: string;
  /** 1行目を見出しとする表 */
  table?: string[][];
  /** 図・文書を行単位で表す（親族関係図など） */
  lines?: string[];
  note?: string;
}

export interface Question {
  id: string; // 例: 'life-3-001'
  field: FieldId;
  grade: Grade;
  stage: StageKind; // 'basic' | 'applied' | 'calc' | 'boss' に配置
  format: QuestionFormat;
  topic: string; // スキルツリーのノードIDと対応
  /** 事例問題の設例文 */
  scenario?: string;
  /** 資料（実技の資料読み取り問題） */
  exhibit?: Exhibit[];
  prompt: string;
  choices?: Choice[];
  /** truefalse: 'o' | 'x' / single, case: choice id / multi: choice ids */
  answer: string | string[];
  /** numeric: 正答値と許容誤差・単位 */
  numeric?: { value: number; tolerance?: number; unit: string };
  explanation: string;
  /** 計算式と途中過程 */
  steps?: string[];
  related?: string;
  /** 関連する3級・2級の知識（グレード間ブリッジ） */
  bridge?: { grade3?: string; grade2?: string };
  difficulty: 1 | 2 | 3;
  law: LawMeta;
}

// ------------------------------------------------------------
// 進捗データ（LocalStorage 保存）
// ------------------------------------------------------------

export interface QuestionRecord {
  attempts: number;
  correct: number;
  /** 間隔反復の箱（0〜5）。5 で「定着」とみなす */
  box: number;
  /** 次回出題予定（epoch ms）。未到来の再挑戦は XP 対象外 */
  due: number;
  lastAnswered: number;
  /** 初回正解で XP 付与済みか（XP 稼ぎ防止） */
  firstClearXp: boolean;
  /** 最後に XP を得た箱番号。同じ箱で二度は与えない */
  lastXpBox: number;
  wrongStreak: number;
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  answered: number;
  correct: number;
  reviews: number;
  seconds: number;
  xp: number;
}

export interface QuestState {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface MockResult {
  id: string;
  date: number;
  grade: Grade;
  part: 'gakka' | 'jitsugi';
  score: number;
  max: number;
  passLine: number;
  passed: boolean;
  byField: Partial<Record<FieldId, { correct: number; total: number }>>;
  questionCount: number;
  scaled: boolean; // 問題数不足による縮小版か
  seconds: number;
}

export interface GameState {
  version: number;
  playerName: string;
  xp: number;
  fieldXp: Record<FieldId, number>;
  records: Record<string, QuestionRecord>;
  bossCleared: Partial<Record<string, number>>; // key: `${field}-${grade}` → クリア日時
  stageCleared: Record<string, number>;
  achievements: Record<string, number>;
  days: Record<string, DayLog>;
  bestCombo: number;
  daily: { date: string; quests: QuestState[] };
  weekly: { week: string; quests: QuestState[] };
  mockHistory: MockResult[];
  calcDrills: { done: number; correct: number; byKind: Record<string, { done: number; correct: number }> };
  scenariosCleared: Record<string, number>;
  bookEntries: BookEntry[];
  /** CSV インポート等でユーザーが追加した問題（将来の OCR 取込も同じ形式） */
  customQuestions: Question[];
  /** 計算特訓の XP 上限管理（日付ごと） */
  xpCaps: Record<string, number>;
  settings: { dailyGoalMin: number; sound: boolean };
}

// ------------------------------------------------------------
// 史上最強FPシリーズ（市販教材）連携 — 学習記録のみを管理
// 問題文・解説は保存しない（著作権配慮）。ユーザー自身のメモのみ。
// ------------------------------------------------------------

export type BookStatus = 'untouched' | 'solved' | 'review' | 'mastered';

export interface BookAttempt {
  date: number;
  correct: boolean;
}

export interface BookEntry {
  id: string;
  book: string; // 例: '史上最強のFP3級問題集 2026-2027年版'
  chapter: string;
  page: number | null;
  problemNo: string;
  field: FieldId;
  grade: Grade;
  status: BookStatus;
  attempts: BookAttempt[];
  understanding: 0 | 1 | 2 | 3 | 4 | 5;
  weak: boolean;
  linkedStage: string | null; // 例: 'tax-basic'
  memo: string;
  /** 取込元（'manual' | 'csv' | 'ocr'）将来の OCR 拡張用 */
  origin: 'manual' | 'csv' | 'ocr';
  createdAt: number;
}
