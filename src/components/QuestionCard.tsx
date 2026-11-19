import { useMemo, useState } from 'react';
import type { Question } from '../types';
import { checkNumber, yen } from '../engine/calcGenerators';
import { shuffle } from '../engine/stages';
import { FIELD_MAP } from '../data/fields';
import { LawBadge } from './ui';

const FORMAT_LABEL: Record<Question['format'], string> = {
  truefalse: '○×問題',
  single: '択一問題',
  multi: '複数選択',
  numeric: '計算問題',
  case: '事例問題',
};

export function isCorrect(q: Question, picked: string[], numInput: string) {
  if (q.format === 'numeric') return checkNumber(numInput, q.numeric!.value, q.numeric!.tolerance ?? 0.5);
  if (q.format === 'multi') {
    const ans = [...(q.answer as string[])].sort().join(',');
    return [...picked].sort().join(',') === ans;
  }
  return picked[0] === q.answer;
}

interface Props {
  q: Question;
  index?: number;
  total?: number;
  /** 解答確定時。correct を返す */
  onSubmit?: (correct: boolean) => void;
  /** 閲覧モード：最初から解説を表示 */
  reveal?: boolean;
  /** 模試：解説を出さずに回答だけ保持 */
  examMode?: { picked: string[]; num: string; onChange: (picked: string[], num: string) => void };
  footer?: React.ReactNode;
  xpNote?: React.ReactNode;
}

export function QuestionCard({ q, index, total, onSubmit, reveal, examMode, footer, xpNote }: Props) {
  const [picked, setPicked] = useState<string[]>(examMode?.picked ?? []);
  const [num, setNum] = useState(examMode?.num ?? '');
  const [submitted, setSubmitted] = useState(!!reveal);
  // 選択肢の並びは毎回シャッフル（位置で覚えるのを防ぐ）。○×は固定。
  const choices = useMemo(() => (q.format === 'truefalse' || !q.choices ? q.choices ?? [] : shuffle(q.choices)), [q]);
  const correct = submitted && !reveal ? isCorrect(q, picked, num) : null;
  const answerIds = Array.isArray(q.answer) ? q.answer : [q.answer];
  const field = FIELD_MAP[q.field];

  const choose = (id: string) => {
    if (submitted) return;
    let next: string[];
    if (q.format === 'multi') next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    else next = [id];
    setPicked(next);
    examMode?.onChange(next, num);
    // ○×・択一はタップ即確定（スマホでのテンポ重視）。模試では確定しない。
    if (!examMode && (q.format === 'truefalse' || q.format === 'single' || q.format === 'case')) submit(next, num);
  };

  const submit = (p = picked, n = num) => {
    if (submitted || examMode) return;
    setSubmitted(true);
    onSubmit?.(isCorrect(q, p, n));
  };

  const canSubmit = q.format === 'numeric' ? num.trim() !== '' : picked.length > 0;

  return (
    <div className="panel">
      <div className="qhead">
        <div className="row wrap">
          <span className="chip" style={{ borderColor: field.color }}>
            {field.emoji} {field.name}
          </span>
          <span className="chip gold">{q.grade}級</span>
          <span className="chip">{FORMAT_LABEL[q.format]}</span>
          {q.law.status !== 'verified' && <span className="chip warn">要確認</span>}
        </div>
        {index !== undefined && total !== undefined && (
          <span className="muted small">
            {index + 1}/{total}
          </span>
        )}
      </div>
      {q.scenario && <div className="scenario-box">{q.scenario}</div>}
      <div className="qprompt">{q.prompt}</div>

      {q.format === 'numeric' ? (
        <form
          className="numinput"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) submit();
          }}
        >
          <input
            inputMode="decimal"
            placeholder="答えを入力"
            value={num}
            disabled={submitted}
            onChange={(e) => {
              setNum(e.target.value);
              examMode?.onChange(picked, e.target.value);
            }}
            aria-label="解答"
          />
          <span style={{ fontWeight: 800 }}>{q.numeric!.unit}</span>
        </form>
      ) : (
        <div className={q.format === 'truefalse' ? 'tf' : 'choices'}>
          {choices.map((c, i) => {
            const isAns = answerIds.includes(c.id);
            const sel = picked.includes(c.id);
            const cls = submitted ? (isAns ? 'right' : sel ? 'wrong' : '') : sel ? 'sel' : '';
            return (
              <button key={c.id} className={`choice ${cls}`} onClick={() => choose(c.id)} disabled={submitted && !examMode}>
                {q.format === 'truefalse' ? (
                  c.id === 'o' ? '○' : '×'
                ) : (
                  <>
                    <span className="mark">{q.format === 'multi' ? (sel ? '☑' : '☐') : String.fromCharCode(65 + i)}</span>
                    <span>{c.text}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!submitted && !examMode && (q.format === 'multi' || q.format === 'numeric') && (
        <button className="btn block" style={{ marginTop: 12 }} disabled={!canSubmit} onClick={() => submit()}>
          解答する
        </button>
      )}

      {submitted && <Explanation q={q} correct={correct} picked={picked} num={num} choices={choices} xpNote={xpNote} />}
      {submitted && footer}
    </div>
  );
}

export function Explanation({
  q,
  correct,
  picked,
  num,
  choices,
  xpNote,
}: {
  q: Question;
  correct: boolean | null;
  picked: string[];
  num?: string;
  choices?: Question['choices'];
  xpNote?: React.ReactNode;
}) {
  const answerIds = Array.isArray(q.answer) ? q.answer : [q.answer];
  const list = choices ?? q.choices ?? [];
  return (
    <div className="explain">
      {correct !== null && <div className={`result-banner ${correct ? 'ok' : 'ng'}`}>{correct ? '◎ 正解！' : '✕ 不正解'}</div>}
      {xpNote}
      <h4>■ 正解</h4>
      <div style={{ fontWeight: 800 }}>
        {q.format === 'numeric'
          ? `${yen(q.numeric!.value)} ${q.numeric!.unit}`
          : list
              .filter((c) => answerIds.includes(c.id))
              .map((c) => (q.format === 'truefalse' ? c.text : c.text))
              .join(' ／ ')}
        {q.format === 'numeric' && num && correct === false && <span className="muted small">（あなたの解答：{num}）</span>}
      </div>
      <h4>■ 正解の理由</h4>
      <div>{q.explanation}</div>
      {q.steps && q.steps.length > 0 && (
        <>
          <h4>■ 計算式と途中過程</h4>
          <ol className="steps">
            {q.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </>
      )}
      {list.length > 0 && q.format !== 'truefalse' && (
        <>
          <h4>■ 各選択肢の解説</h4>
          <ul className="whys">
            {list.map((c, i) => (
              <li key={c.id} className={answerIds.includes(c.id) ? 'is-answer' : ''}>
                <b>
                  {String.fromCharCode(65 + i)}. {answerIds.includes(c.id) ? '◎' : picked.includes(c.id) ? '✕（あなたの選択）' : ''}
                </b>{' '}
                {c.text}
                <div className="muted">→ {c.why}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      {q.format === 'truefalse' && correct === false && (
        <>
          <h4>■ なぜ間違えやすいか</h4>
          <div>{list.find((c) => !answerIds.includes(c.id))?.why}</div>
        </>
      )}
      {q.related && (
        <>
          <h4>■ 関連知識</h4>
          <div>{q.related}</div>
        </>
      )}
      {q.bridge && (
        <>
          <h4>■ 3級・2級のつながり</h4>
          {q.bridge.grade3 && <div>【3級】{q.bridge.grade3}</div>}
          {q.bridge.grade2 && <div>【2級】{q.bridge.grade2}</div>}
        </>
      )}
      <LawBadge law={q.law} />
    </div>
  );
}
