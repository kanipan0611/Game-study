import { useState } from 'react';
import type { FieldId } from '../types';
import { useGame } from '../state/store';
import { FIELDS } from '../data/fields';
import { buildSession } from '../engine/stages';
import { QuizSession, type SessionSummary } from '../components/QuizSession';
import { Back, Bar, pct } from '../components/ui';

/** 実技対策：資料（キャッシュフロー表・保険証券・登記事項証明書など）を読み取る問題の演習 */
export function ExhibitDrill() {
  const { state, questions } = useGame();
  const [field, setField] = useState<FieldId | 'all'>('all');
  const [grade, setGrade] = useState<3 | 2>(3);
  const [session, setSession] = useState<typeof questions | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const pool = questions.filter((q) => q.exhibit && (grade === 2 || q.grade === 3) && (field === 'all' || q.field === field));
  const solved = pool.filter((q) => (state.records[q.id]?.correct ?? 0) > 0).length;

  if (session) {
    if (summary) {
      return (
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>📄</div>
          <h2>資料読み取り演習 結果</h2>
          <div style={{ fontSize: 24, fontWeight: 900 }}>
            {summary.correct}/{summary.total} 正解
          </div>
          <div className="xpgain">+{summary.xp} XP</div>
          <button className="btn block" style={{ marginTop: 12 }} onClick={() => { setSession(null); setSummary(null); }}>
            戻る
          </button>
        </div>
      );
    }
    return <QuizSession questions={session} mode="play" onFinish={setSummary} />;
  }

  return (
    <div>
      <Back to="calc" label="計算特訓" />
      <div className="section-title">📄 資料読み取り演習（実技対策）</div>
      <p className="muted small">
        本試験の実技は、キャッシュフロー表・保険証券・源泉徴収票・登記事項証明書・親族関係図などの資料を読み取って答える問題が中心です。1つの資料から複数の問題が出ます。
      </p>
      <div className="tabs">
        {([3, 2] as const).map((g) => (
          <button key={g} className={grade === g ? 'on' : ''} onClick={() => setGrade(g)}>
            {g === 3 ? '3級レベル' : '2級まで'}
          </button>
        ))}
      </div>
      <div className="tabs">
        <button className={field === 'all' ? 'on' : ''} onClick={() => setField('all')}>
          全分野
        </button>
        {FIELDS.map((f) => (
          <button key={f.id} className={field === f.id ? 'on' : ''} onClick={() => setField(f.id)}>
            {f.emoji}
            {f.name}
          </button>
        ))}
      </div>
      <div className="panel">
        <div className="row between small">
          <span>収録 {pool.length}問</span>
          <span>正解済み {solved}問（{pool.length ? pct(solved / pool.length) : '0%'}）</span>
        </div>
        <Bar value={pool.length ? solved / pool.length : 0} thin />
        <button className="btn block" style={{ marginTop: 12 }} disabled={!pool.length} onClick={() => setSession(buildSession(pool, state, 8))}>
          演習を始める（最大8問）
        </button>
      </div>
    </div>
  );
}
