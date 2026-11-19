import { useRef, useState } from 'react';
import type { Question } from '../types';
import { useGame, type AnswerOutcome } from '../state/store';
import { QuestionCard } from './QuestionCard';
import { Bar } from './ui';

export interface SessionSummary {
  total: number;
  correct: number;
  xp: number;
  bestCombo: number;
  wrongIds: string[];
}

interface Props {
  questions: Question[];
  mode: 'play' | 'review' | 'browse';
  onFinish: (s: SessionSummary) => void;
}

/** 通常演習・復習・閲覧で共通の出題ループ */
export function QuizSession({ questions, mode, onFinish }: Props) {
  const { actions } = useGame();
  const [i, setI] = useState(0);
  const [combo, setCombo] = useState(0);
  const [last, setLast] = useState<AnswerOutcome | null>(null);
  const [answered, setAnswered] = useState(false);
  const sum = useRef<SessionSummary>({ total: questions.length, correct: 0, xp: 0, bestCombo: 0, wrongIds: [] });
  const q = questions[i];
  if (!q) return null;

  const onSubmit = (correct: boolean) => {
    setAnswered(true);
    const nextCombo = correct ? combo + 1 : 0;
    setCombo(nextCombo);
    if (correct) sum.current.correct++;
    else sum.current.wrongIds.push(q.id);
    sum.current.bestCombo = Math.max(sum.current.bestCombo, nextCombo);
    const out = actions.answer(q, correct, { combo: nextCombo, mode: mode === 'review' ? 'review' : 'play' });
    sum.current.xp += out.xp;
    setLast(out);
  };

  const next = () => {
    if (i + 1 >= questions.length) onFinish(sum.current);
    else {
      setI(i + 1);
      setAnswered(false);
      setLast(null);
    }
  };

  const xpNote =
    mode === 'browse' ? (
      <div className="infobox small">閲覧モード：記録・経験値には反映されません。</div>
    ) : last ? (
      last.xp > 0 ? (
        <div className="xpgain" style={{ textAlign: 'center' }}>
          +{last.xp} XP <span className="small muted">（{last.reasons.join('・')}）</span>
        </div>
      ) : (
        <div className="muted small" style={{ textAlign: 'center' }}>
          {answered && sum.current.wrongIds.includes(q.id)
            ? '復習リストに追加しました。忘れかけた頃に再出題します。'
            : '復習期限前の再挑戦のため XP はありません（定着度は期限後の復習で上がります）'}
        </div>
      )
    ) : null;

  return (
    <div>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Bar value={(i + (answered ? 1 : 0)) / questions.length} thin />
        </div>
        {combo >= 2 && <span className={`combo ${combo >= 5 ? 'big' : ''}`}>🔥 {combo} COMBO</span>}
      </div>
      {mode === 'browse' ? (
        <QuestionCard key={q.id} q={q} index={i} total={questions.length} reveal xpNote={xpNote} footer={<NextBtn last={i + 1 >= questions.length} onClick={next} />} />
      ) : (
        <QuestionCard
          key={q.id}
          q={q}
          index={i}
          total={questions.length}
          onSubmit={onSubmit}
          xpNote={xpNote}
          footer={<NextBtn last={i + 1 >= questions.length} onClick={next} />}
        />
      )}
    </div>
  );
}

function NextBtn({ last, onClick }: { last: boolean; onClick: () => void }) {
  return (
    <button className="btn block" style={{ marginTop: 14 }} onClick={onClick}>
      {last ? '結果を見る' : '次の問題へ ▶'}
    </button>
  );
}
