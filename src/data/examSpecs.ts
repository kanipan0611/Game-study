import type { Grade, QuestionFormat } from '../types';

// 試験制度（2026年度・CBT方式）。出典：日本FP協会・金融財政事情研究会の試験概要。
// 受検前に必ず公式サイトで最新情報を確認すること。
export interface ExamSpec {
  key: string;
  grade: Grade;
  part: 'gakka' | 'jitsugi';
  name: string;
  minutes: number;
  questions: number;
  formats: QuestionFormat[];
  /** 1問あたりの配点 */
  pointsEach: number;
  max: number;
  passLine: number;
  note: string;
}

export const EXAM_SPECS: ExamSpec[] = [
  {
    key: 'g3-gakka', grade: 3, part: 'gakka', name: 'FP3級 学科',
    minutes: 90, questions: 60, formats: ['truefalse', 'single'], pointsEach: 1, max: 60, passLine: 36,
    note: '本試験は ○×式30問＋三答択一式30問、60点満点中36点以上で合格（日本FP協会・きんざい共通）。',
  },
  {
    key: 'g3-jitsugi', grade: 3, part: 'jitsugi', name: 'FP3級 実技（資産設計提案業務 形式）',
    minutes: 60, questions: 20, formats: ['case', 'numeric', 'single'], pointsEach: 5, max: 100, passLine: 60,
    note: '日本FP協会「資産設計提案業務」は20問・100点満点中60点以上。きんざい（個人資産相談業務・保険顧客資産相談業務）は事例5題・50点満点中30点以上。',
  },
  {
    key: 'g2-gakka', grade: 2, part: 'gakka', name: 'FP2級 学科',
    minutes: 120, questions: 60, formats: ['single'], pointsEach: 1, max: 60, passLine: 36,
    note: '本試験は四答択一式60問、60点満点中36点以上で合格。',
  },
  {
    key: 'g2-jitsugi', grade: 2, part: 'jitsugi', name: 'FP2級 実技（資産設計提案業務 形式）',
    minutes: 90, questions: 40, formats: ['case', 'numeric', 'single', 'multi'], pointsEach: 2.5, max: 100, passLine: 60,
    note: '日本FP協会「資産設計提案業務」は40問・100点満点中60点以上。きんざいの各実技は事例5題・50点満点中30点以上。',
  },
];

export const EXAM_SOURCE = '日本FP協会・金融財政事情研究会 公式「試験概要」（2026年度 CBT方式／法令基準日 2026年4月1日：2026年6月〜2027年5月受検分）';
