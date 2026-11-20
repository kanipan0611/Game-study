import type { Exhibit, FieldId, Grade, LawMeta, Question } from '../../types';

// 問題データを簡潔に記述するためのビルダー。
// 出力は純粋な Question オブジェクト（CSV と相互変換可能）。

interface Base {
  id: string;
  exhibit?: Exhibit[];
  grade: Grade;
  topic: string;
  prompt: string;
  explanation: string;
  law: LawMeta;
  scenario?: string;
  steps?: string[];
  related?: string;
  bridge?: { grade3?: string; grade2?: string };
  difficulty?: 1 | 2 | 3;
}

const IDS = ['a', 'b', 'c', 'd', 'e'];
/** 「正解。」「適切。」だけの短い解説は本文の解説で補う */
const fillWhy = (why: string, explanation: string) => (why.length <= 6 ? `${why}${explanation}` : why);

export function makeBuilder(field: FieldId) {
  const stageOf = (grade: Grade): 'basic' | 'applied' => (grade === 3 ? 'basic' : 'applied');

  return {
    /** ○×問題。wrongWhy = 逆の答えを選んだ人への解説 */
    tf(b: Base & { ans: 'o' | 'x'; wrongWhy: string }): Question {
      const { ans, wrongWhy, ...rest } = b;
      return {
        ...rest,
        field,
        stage: stageOf(b.grade),
        format: 'truefalse',
        difficulty: b.difficulty ?? 1,
        choices: [
          { id: 'o', text: '○（適切）', why: ans === 'o' ? '正解。' + b.explanation : wrongWhy },
          { id: 'x', text: '×（不適切）', why: ans === 'x' ? '正解。' + b.explanation : wrongWhy },
        ],
        answer: ans,
      };
    },
    /** 択一。choices = [本文, その選択肢の解説]、ans = 正解インデックス */
    single(b: Base & { choices: [string, string][]; ans: number; format?: 'single' | 'case' }): Question {
      const { choices, ans, format, ...rest } = b;
      return {
        ...rest,
        field,
        stage: stageOf(b.grade),
        format: format ?? (b.scenario ? 'case' : 'single'),
        difficulty: b.difficulty ?? (b.grade === 2 ? 2 : 1),
        choices: choices.map(([text, why], i) => ({ id: IDS[i], text, why: fillWhy(why, b.explanation) })),
        answer: IDS[ans],
      };
    },
    /** 複数選択。ans = 正解インデックス配列 */
    multi(b: Base & { choices: [string, string][]; ans: number[] }): Question {
      const { choices, ans, ...rest } = b;
      return {
        ...rest,
        field,
        stage: stageOf(b.grade),
        format: 'multi',
        difficulty: b.difficulty ?? 2,
        choices: choices.map(([text, why], i) => ({ id: IDS[i], text, why: fillWhy(why, b.explanation) })),
        answer: ans.map((i) => IDS[i]),
      };
    },
    /** 計算問題（数値入力）。steps に途中過程を必ず書く */
    num(b: Base & { value: number; unit: string; tolerance?: number; steps: string[] }): Question {
      const { value, unit, tolerance, ...rest } = b;
      return {
        ...rest,
        field,
        stage: 'calc',
        format: 'numeric',
        difficulty: b.difficulty ?? 2,
        answer: String(value),
        numeric: { value, unit, tolerance },
      };
    },
  };
}

// ------------------------------------------------------------
// 大量追加用のコンパクトなビルダー（バンク）。
// ID は「分野接頭辞-級-連番(101〜)」を出現順に自動採番する。
// 進捗データは ID に紐づくため、既存問題の並べ替え・削除は禁止（末尾に追記のみ）。
// 法令メタはトピックごとの既定値を使い、必要な問題だけ opt.law で上書きする。
// ------------------------------------------------------------
interface Opt {
  related?: string;
  bridge?: { grade3?: string; grade2?: string };
  scenario?: string;
  exhibit?: Exhibit[];
  law?: LawMeta;
  difficulty?: 1 | 2 | 3;
  tolerance?: number;
}

export function bank(field: FieldId, prefix: string, grade: Grade, laws: Record<string, LawMeta>) {
  let seq = 100;
  const b = makeBuilder(field);
  const base = (topic: string, prompt: string, explanation: string, o?: Opt) => {
    const law = o?.law ?? laws[topic];
    if (!law) throw new Error(`法令メタ未定義: ${topic}`);
    return {
      id: `${prefix}-${grade}-${++seq}`,
      grade, topic, prompt, explanation, law,
      related: o?.related, bridge: o?.bridge, scenario: o?.scenario, exhibit: o?.exhibit, difficulty: o?.difficulty,
    };
  };
  const tfWhy = (ans: 'o' | 'x', e: string, w?: string) => w ?? (ans === 'o' ? `記述は適切です。${e}` : `記述には誤りがあります。${e}`);
  return {
    /** ○が正解の○×問題 */
    o: (topic: string, prompt: string, explanation: string, wrongWhy?: string, o?: Opt): Question =>
      b.tf({ ...base(topic, prompt, explanation, o), ans: 'o', wrongWhy: tfWhy('o', explanation, wrongWhy) }),
    /** ×が正解の○×問題 */
    x: (topic: string, prompt: string, explanation: string, wrongWhy?: string, o?: Opt): Question =>
      b.tf({ ...base(topic, prompt, explanation, o), ans: 'x', wrongWhy: tfWhy('x', explanation, wrongWhy) }),
    /** 択一（3級は3肢・2級は4肢） */
    c: (topic: string, prompt: string, choices: [string, string][], ans: number, explanation: string, o?: Opt): Question =>
      b.single({ ...base(topic, prompt, explanation, o), choices, ans }),
    /** 複数選択 */
    m: (topic: string, prompt: string, choices: [string, string][], ans: number[], explanation: string, o?: Opt): Question =>
      b.multi({ ...base(topic, prompt, explanation, o), choices, ans }),
    /** 計算（数値入力） */
    n: (topic: string, prompt: string, value: number, unit: string, steps: string[], explanation: string, o?: Opt): Question =>
      b.num({ ...base(topic, prompt, explanation, o), value, unit, steps, tolerance: o?.tolerance }),
  };
}
