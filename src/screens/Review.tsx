import { useState } from 'react';
import { useGame } from '../state/store';
import { FIELDS, FIELD_MAP } from '../data/fields';
import { dueQuestions } from '../engine/stages';
import { INTERVALS } from '../engine/srs';
import { QuizSession, type SessionSummary } from '../components/QuizSession';
import { Bar } from '../components/ui';

const fmtIn = (ms: number) => {
  if (ms <= 0) return '今';
  const h = ms / 3600000;
  if (h < 1) return `${Math.ceil(ms / 60000)}分後`;
  if (h < 24) return `${Math.ceil(h)}時間後`;
  return `${Math.ceil(h / 24)}日後`;
};

export function Review() {
  const { state, questions } = useGame();
  const [session, setSession] = useState<typeof questions | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const now = Date.now();
  const due = dueQuestions(questions, state, now);
  const answered = questions.filter((q) => (state.records[q.id]?.attempts ?? 0) > 0);
  const boxes = [0, 1, 2, 3, 4, 5].map((b) => answered.filter((q) => state.records[q.id].box === b).length);
  const upcoming = answered
    .filter((q) => state.records[q.id].due > now)
    .sort((a, b) => state.records[a.id].due - state.records[b.id].due)
    .slice(0, 5);
  const weak = answered.filter((q) => state.records[q.id].wrongStreak > 0 || state.records[q.id].correct / state.records[q.id].attempts < 0.5);

  if (session) {
    if (summary) {
      return (
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🔁</div>
          <h2>復習クエスト完了</h2>
          <div style={{ fontSize: 24, fontWeight: 900 }}>
            {summary.correct}/{summary.total} 正解
          </div>
          <div className="xpgain">+{summary.xp} XP</div>
          <p className="muted small">正解した問題は次の復習まで間隔が延びます。間違えた問題は10分後に再登場します。</p>
          <button className="btn block" onClick={() => { setSession(null); setSummary(null); }}>
            戻る
          </button>
        </div>
      );
    }
    return <QuizSession questions={session} mode="review" onFinish={setSummary} />;
  }

  return (
    <div>
      <div className="section-title">🔁 復習クエスト</div>
      <div className="panel">
        <div className="row between">
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold-300)' }}>{due.length}問</div>
            <div className="muted small">いま復習どきの問題</div>
          </div>
          <button className="btn" disabled={!due.length} onClick={() => setSession(due.slice(0, 10))}>
            {due.length ? `復習する（${Math.min(10, due.length)}問）` : '復習待ちなし'}
          </button>
        </div>
        <p className="muted small">
          間違えた問題は自動でここに入ります。正解するたびに出題間隔が
          {INTERVALS.slice(1).map((ms) => `${Math.round(ms / 86400000)}日`).join('→')}
          と延び、忘れかけた頃に再出題されます。期限前に解いても定着度は上がりません。
        </p>
        {weak.length > 0 && (
          <button className="btn ghost block" onClick={() => setSession(weak.slice(0, 10))}>
            苦手問題だけ特訓（{weak.length}問・期限前はXPなし）
          </button>
        )}
      </div>

      <div className="section-title">📦 定着ボックス</div>
      <div className="panel">
        {boxes.map((n, b) => (
          <div key={b} className="bars">
            <div className="bar">
              <div className="lbl">
                <span>{['🔴 要復習', '🟠 Lv1（1日）', '🟡 Lv2（3日）', '🟢 Lv3（7日）', '🔵 Lv4（14日・定着）', '🟣 Lv5（30日・完全定着）'][b]}</span>
                <span>{n}問</span>
              </div>
              <Bar value={answered.length ? n / answered.length : 0} thin />
            </div>
          </div>
        ))}
        <div className="muted small">未着手：{questions.length - answered.length}問</div>
      </div>

      <div className="section-title">⏳ 次の復習予定</div>
      <div className="panel small">
        {upcoming.length === 0 && <span className="muted">予定はありません</span>}
        {upcoming.map((q) => (
          <div key={q.id} className="row between" style={{ padding: '4px 0' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {FIELD_MAP[q.field].emoji} {q.prompt.slice(0, 26)}…
            </span>
            <span className="chip">{fmtIn(state.records[q.id].due - now)}</span>
          </div>
        ))}
      </div>

      <div className="section-title">🗂 分野別の復習待ち</div>
      <div className="grid3">
        {FIELDS.map((f) => {
          const n = due.filter((q) => q.field === f.id).length;
          return (
            <button key={f.id} className="navcard" style={{ textAlign: 'left', cursor: n ? 'pointer' : 'default' }} disabled={!n} onClick={() => setSession(due.filter((q) => q.field === f.id).slice(0, 10))}>
              <div className="e">{f.emoji}</div>
              <div className="small">{f.name}</div>
              <div className="t">{n}問</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
