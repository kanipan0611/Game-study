import type { FieldId, Question } from '../../types';
import { lifeQuestions } from './life';
import { riskQuestions } from './risk';
import { financeQuestions } from './finance';
import { taxQuestions } from './tax';
import { estateQuestions } from './estate';
import { inheritQuestions } from './inherit';

/** 組込みのオリジナル問題（CSV インポート分は state 側で追加される） */
export const BUILTIN_QUESTIONS: Question[] = [
  ...lifeQuestions,
  ...riskQuestions,
  ...financeQuestions,
  ...taxQuestions,
  ...estateQuestions,
  ...inheritQuestions,
];

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(
  BUILTIN_QUESTIONS.map((q) => [q.id, q]),
);

export const questionsOf = (field: FieldId, filter?: (q: Question) => boolean) =>
  BUILTIN_QUESTIONS.filter((q) => q.field === field && (!filter || filter(q)));
