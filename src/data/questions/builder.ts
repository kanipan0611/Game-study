import type { FieldId, Grade, LawMeta, Question } from '../../types';

// 問題データを簡潔に記述するためのビルダー。
// 出力は純粋な Question オブジェクト（CSV と相互変換可能）。

interface Base {
  id: string;
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
        choices: choices.map(([text, why], i) => ({ id: IDS[i], text, why })),
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
        choices: choices.map(([text, why], i) => ({ id: IDS[i], text, why })),
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
