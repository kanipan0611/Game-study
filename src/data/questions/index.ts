import type { FieldId, Question } from '../../types';
import { lifeQuestions } from './life';
import { lifeQuestions2 } from './life2';
import { riskQuestions } from './risk';
import { riskQuestions2 } from './risk2';
import { financeQuestions } from './finance';
import { financeQuestions2 } from './finance2';
import { taxQuestions } from './tax';
import { taxQuestions2 } from './tax2';
import { estateQuestions } from './estate';
import { inheritQuestions } from './inherit';

/** 組込みのオリジナル問題（CSV インポート分は state 側で追加される） */
export const BUILTIN_QUESTIONS: Question[] = [
  ...lifeQuestions,
  ...lifeQuestions2,
  ...riskQuestions,
  ...riskQuestions2,
  ...financeQuestions,
  ...financeQuestions2,
  ...taxQuestions,
  ...taxQuestions2,
  ...estateQuestions,
  ...inheritQuestions,
];

export const QUESTION_BY_ID: Record<string, Question> = Object.fromEntries(
  BUILTIN_QUESTIONS.map((q) => [q.id, q]),
);

export const questionsOf = (field: FieldId, filter?: (q: Question) => boolean) =>
  BUILTIN_QUESTIONS.filter((q) => q.field === field && (!filter || filter(q)));
