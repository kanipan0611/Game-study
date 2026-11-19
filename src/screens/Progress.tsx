import { useState } from 'react';
import type { FieldId } from '../types';
import { useGame } from '../state/store';
import { FIELDS, FIELD_MAP, type TopicNode } from '../data/fields';
import { topicStatus } from '../engine/stages';
import { fieldMastery, levelInfo } from '../engine/xp';
import { dateKey, streakOf } from '../engine/dates';
import { Back, Bar, pct } from '../components/ui';

// ============================================================
// スキルツリー：論点（トピック）ごとの習得度。
// ノードは「解いて覚えた」ことでのみ点灯し、XPでは買えない。
// ============================================================
export function SkillTree() {
  const { state, questions } = useGame();
  const [field, setField] = useState<FieldId>('life');
  const f = FIELD_MAP[field];
  const depthOf = (t: TopicNode): number => (t.requires.length ? 1 + Math.max(...t.requires.map((r) => depthOf(f.topics.find((x) => x.id === r)!))) : 0);
  const statuses = Object.fromEntries(f.topics.map((t) => [t.id, topicStatus(t.id, questions, state)]));
  const learned = (id: string) => ['learned', 'mastered'].includes(statuses[id].state) || statuses[id].state === 'empty';

  return (
    <div>
      <Back to="" label="ホーム" />
      <div className="section-title">🌳 スキルツリー</div>
      <p className="muted small">各論点の問題を一度ずつ正解すると「習得」、復習を重ねて定着Lv3以上になると「極意」として輝きます。前提スキルを習得すると次の枝が開きます。</p>
      <div className="tabs">
        {FIELDS.map((x) => (
          <button key={x.id} className={field === x.id ? 'on' : ''} onClick={() => setField(x.id)}>
            {x.emoji}
            {x.name}
          </button>
        ))}
      </div>
      <div className="panel tree">
        {f.topics.map((t) => {
          const st = statuses[t.id];
          const locked = !t.requires.every(learned);
          const cls = locked ? 'locked' : st.state;
          return (
            <div key={t.id} className={`tnode ${cls}`} style={{ ['--depth' as string]: depthOf(t) }}>
              <div className="indent" />
              <div className="gem">
                <span>{locked ? '🔒' : st.state === 'mastered' ? '★' : st.state === 'learned' ? '◆' : st.state === 'learning' ? '◇' : '・'}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small" style={{ fontWeight: 800 }}>
                  {t.name} <span className="chip">{t.grade}級</span>
                </div>
                {st.pool > 0 ? (
                  <>
                    <Bar value={(st.learned + st.mastered) / (st.pool * 2)} thin />
                    <div className="muted small">
                      習得 {st.learned}/{st.pool}・極意 {st.mastered}/{st.pool}
                      {locked && `（前提：${t.requires.map((r) => f.topics.find((x) => x.id === r)?.name).join('・')}）`}
                    </div>
                  </>
                ) : (
                  <div className="muted small">問題準備中（CSVで追加可能）</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 学習記録：カレンダー・分野別の正答率・理解度・復習状況
// ============================================================
export function Stats() {
  const { state, questions } = useGame();
  const now = Date.now();
  const streak = streakOf(state.days);
  const days = Object.values(state.days);
  const totalMin = Math.round(days.reduce((a, d) => a + d.seconds, 0) / 60);
  const totalAns = days.reduce((a, d) => a + d.answered, 0);
  const totalCor = days.reduce((a, d) => a + d.correct, 0);
  const best = (() => {
    let b = 0;
    let c = 0;
    const keys = Object.keys(state.days).sort();
    let prev: Date | null = null;
    for (const k of keys) {
      const d = new Date(k + 'T00:00:00');
      const act = state.days[k].answered > 0 || state.days[k].seconds >= 300;
      if (!act) continue;
      c = prev && (d.getTime() - prev.getTime()) / 86400000 === 1 ? c + 1 : 1;
      b = Math.max(b, c);
      prev = d;
    }
    return b;
  })();

  // 直近5週（35日）のカレンダー
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 34);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const cells: Date[] = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) cells.push(new Date(d));

  return (
    <div>
      <div className="section-title">📊 学習記録</div>
      <div className="grid3">
        <Stat v={`${streak}日`} l="連続学習" e="🔥" />
        <Stat v={`${best}日`} l="最長連続" e="🏆" />
        <Stat v={`${totalMin}分`} l="総学習時間" e="⏱️" />
        <Stat v={`${totalAns}問`} l="総解答数" e="📝" />
        <Stat v={totalAns ? pct(totalCor / totalAns) : '-'} l="総正答率" e="🎯" />
        <Stat v={`${state.bestCombo}`} l="最大コンボ" e="⚡" />
      </div>

      <div className="section-title">🗓 学習カレンダー</div>
      <div className="panel">
        <div className="calendar">
          {['月', '火', '水', '木', '金', '土', '日'].map((w) => (
            <div key={w} className="hd">
              {w}
            </div>
          ))}
          {cells.map((d) => {
            const k = dateKey(d);
            const log = state.days[k];
            const min = (log?.seconds ?? 0) / 60;
            const lvl = !log || (log.answered === 0 && min < 5) ? '' : min >= state.settings.dailyGoalMin ? 'l3' : log.answered >= 10 ? 'l2' : 'l1';
            return (
              <div key={k} className={`d ${lvl} ${k === dateKey(today) ? 'today' : ''}`} title={`${k}：${log?.answered ?? 0}問・${Math.round(min)}分`}>
                {d.getDate()}
              </div>
            );
          })}
        </div>
        <div className="muted small" style={{ marginTop: 6 }}>
          濃い金色＝目標{state.settings.dailyGoalMin}分達成。
        </div>
      </div>

      <div className="section-title">🧭 分野別の理解度</div>
      <div className="panel bars">
        {FIELDS.map((f) => {
          const m3 = fieldMastery(f.id, questions, state, now, 3);
          const m2 = fieldMastery(f.id, questions, state, now, 2);
          const flv = levelInfo(state.fieldXp[f.id] * 3);
          const books = state.bookEntries.filter((b) => b.field === f.id);
          const bAtt = books.flatMap((b) => b.attempts);
          return (
            <div key={f.id} className="bar" style={{ marginBottom: 14 }}>
              <div className="lbl">
                <b>
                  {f.emoji} {f.name} <span className="chip gold">Lv.{flv.level}</span>
                </b>
                <span>復習待ち {m3.dueCount + m2.dueCount}</span>
              </div>
              <div className="small muted">
                3級 定着{pct(m3.retention)}・正答率{pct(m3.accuracy)}（{m3.answered}/{m3.total}問着手）
              </div>
              <Bar value={m3.retention} thin />
              <div className="small muted">
                2級 定着{pct(m2.retention)}・正答率{pct(m2.accuracy)}（{m2.answered}/{m2.total}問着手）
              </div>
              <Bar value={m2.retention} thin tone="green" />
              {books.length > 0 && (
                <div className="small muted">
                  📚 問題集 {books.length}件・正答率 {bAtt.length ? pct(bAtt.filter((a) => a.correct).length / bAtt.length) : '-'}・苦手 {books.filter((b) => b.weak).length}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ v, l, e }: { v: string; l: string; e: string }) {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: 10, marginBottom: 0 }}>
      <div>{e}</div>
      <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--gold-300)' }}>{v}</div>
      <div className="muted small">{l}</div>
    </div>
  );
}
