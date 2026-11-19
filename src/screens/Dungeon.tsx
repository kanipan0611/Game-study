import { useState } from 'react';
import type { FieldId, StageKind } from '../types';
import { useGame } from '../state/store';
import { FIELD_MAP } from '../data/fields';
import { fieldMastery, levelInfo } from '../engine/xp';
import {
  appliedProgress, appliedUnlocked, basicProgress, bossUnlocked, buildSession, calcProgress, CLEAR_RATE, shuffle, stagePool, STAGE_LABEL,
} from '../engine/stages';
import { QuizSession, type SessionSummary } from '../components/QuizSession';
import { Back, Bar, Celebrate, pct } from '../components/ui';
import { go } from '../router';

export function Dungeon({ field }: { field: FieldId }) {
  const { state, questions } = useGame();
  const f = FIELD_MAP[field];
  if (!f) return <div>ダンジョンが見つかりません</div>;
  const now = Date.now();
  const flv = levelInfo(state.fieldXp[field] * 3); // 分野Lvは分野XPベース（全体より上がりやすい）
  const m3 = fieldMastery(field, questions, state, now, 3);
  const m2 = fieldMastery(field, questions, state, now, 2);
  const bp = basicProgress(field, questions, state);
  const ap = appliedProgress(field, questions, state);
  const cp = calcProgress(field, questions, state);
  const aUnlocked = appliedUnlocked(field, state);
  const b3 = bossUnlocked(field, 3, questions, state);
  const b2 = bossUnlocked(field, 2, questions, state);
  const books = state.bookEntries.filter((b) => b.field === field);

  const stages: { key: string; icon: string; title: string; desc: string; progress?: number; locked: boolean; cleared: boolean; href: string; lockMsg?: string; browse?: string }[] = [
    { key: 'basic', icon: '📘', title: STAGE_LABEL.basic, desc: `FP3級の基礎知識。${pct(CLEAR_RATE)}正解で制覇`, progress: bp, locked: false, cleared: bp >= CLEAR_RATE, href: `play/${field}/basic` },
    { key: 'calc', icon: '🧮', title: STAGE_LABEL.calc, desc: '途中過程まで確認できる計算問題', progress: cp, locked: false, cleared: cp >= CLEAR_RATE, href: `play/${field}/calc` },
    { key: 'review', icon: '🔀', title: STAGE_LABEL.review, desc: '分野内からランダム10問（解放済みの2級含む）', locked: false, cleared: false, href: `play/${field}/review` },
    { key: 'boss3', icon: f.boss.emoji, title: `ボス戦：${f.boss.name}（3級）`, desc: 'ミス3回で敗北。初回撃破で2級応用ステージ解放', locked: !b3, cleared: !!state.bossCleared[`${field}-3`], href: `boss/${field}/3`, lockMsg: `基礎ステージを${pct(CLEAR_RATE)}制覇で解放`, browse: `play/${field}/basic?browse=1` },
    { key: 'applied', icon: '📕', title: STAGE_LABEL.applied, desc: 'FP2級レベルの応用問題', progress: ap, locked: !aUnlocked, cleared: ap >= CLEAR_RATE, href: `play/${field}/applied`, lockMsg: '3級ボス撃破で解放', browse: `play/${field}/applied?browse=1` },
    { key: 'boss2', icon: '💀', title: `ボス戦：真・${f.boss.name}（2級）`, desc: '3級＋2級の混成問題', locked: !b2, cleared: !!state.bossCleared[`${field}-2`], href: `boss/${field}/2`, lockMsg: `応用ステージを${pct(CLEAR_RATE)}制覇で解放`, browse: `play/${field}/applied?browse=1` },
  ];

  return (
    <div>
      <Back to="map" label="世界地図" />
      <div className="panel" style={{ ['--c' as string]: f.color }}>
        <div className="dungeon-head">
          <div className="emblem">{f.emoji}</div>
          <div style={{ flex: 1 }}>
            <div className="muted small">第{f.no}の迷宮 ／ {f.dungeon}</div>
            <h2 style={{ margin: 0 }}>{f.name}</h2>
            <div className="row small">
              <span className="chip gold">分野Lv.{flv.level}</span>
              {state.bossCleared[`${field}-3`] && <span>👑</span>}
              {state.bossCleared[`${field}-2`] && <span>💎</span>}
            </div>
          </div>
        </div>
        <div className="grid2" style={{ marginTop: 10 }}>
          <div>
            <div className="small">3級 定着度 {pct(m3.retention)}</div>
            <Bar value={m3.retention} thin />
            <div className="muted small">正答率 {pct(m3.accuracy)}・復習待ち {m3.dueCount}</div>
          </div>
          <div>
            <div className="small">2級 定着度 {pct(m2.retention)}</div>
            <Bar value={m2.retention} thin />
            <div className="muted small">正答率 {pct(m2.accuracy)}・復習待ち {m2.dueCount}</div>
          </div>
        </div>
      </div>

      {stages.map((s) => (
        <div key={s.key}>
          <a
            className={`stage ${s.locked ? 'locked' : ''} ${s.cleared ? 'cleared' : ''}`}
            href={s.locked ? undefined : `#/${s.href}`}
            onClick={(e) => {
              if (s.locked) e.preventDefault();
            }}
          >
            <div className="icon">{s.locked ? '🔒' : s.icon}</div>
            <div className="body">
              <div className="title">
                {s.title} {s.cleared && <span className="chip gold">制覇</span>}
              </div>
              <div className="muted small">{s.locked ? s.lockMsg : s.desc}</div>
              {s.progress !== undefined && !s.locked && <Bar value={s.progress} thin />}
            </div>
          </a>
          {s.locked && s.browse && (
            <div style={{ margin: '-4px 0 10px 52px' }}>
              <a className="linkbtn small" href={`#/${s.browse}`}>
                👁 閲覧モードで中身を見る（XPなし）
              </a>
            </div>
          )}
        </div>
      ))}

      <div className="section-title">📚 史上最強問題集の関連記録</div>
      <div className="panel small">
        {books.length === 0 ? (
          <span className="muted">この分野の記録はまだありません。</span>
        ) : (
          <>
            登録 {books.length}件・苦手 {books.filter((b) => b.weak).length}件・習得 {books.filter((b) => b.status === 'mastered').length}件
          </>
        )}{' '}
        <a href="#/book">記録を開く →</a>
      </div>
    </div>
  );
}

export function Play({ field, kind, browse }: { field: FieldId; kind: StageKind; browse: boolean }) {
  const { state, questions, actions } = useGame();
  const [session] = useState(() => {
    const pool = stagePool(field, kind, questions, state);
    if (browse) return pool;
    if (kind === 'review') return shuffle(pool).slice(0, 10);
    return buildSession(pool, state, 8);
  });
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [celebrate, setCelebrate] = useState<null | { title: string }>(null);
  const f = FIELD_MAP[field];

  if (!session.length) {
    return (
      <div>
        <Back to={`dungeon/${field}`} />
        <div className="panel">このステージの問題はまだありません。</div>
      </div>
    );
  }

  const finish = (s: SessionSummary) => {
    setSummary(s);
    if (browse) return;
    // ステージ制覇判定（最新 state はアクション経由で更新済み）
    if (kind === 'basic' || kind === 'applied' || kind === 'calc') {
      const xp = actions.clearStageIfReady(field, kind);
      if (xp > 0) setCelebrate({ title: `${STAGE_LABEL[kind]} 制覇！` });
    }
  };

  if (summary) {
    const rate = summary.total ? summary.correct / summary.total : 0;
    return (
      <div>
        {celebrate && (
          <Celebrate emoji="🏆" title={celebrate.title} onClose={() => setCelebrate(null)}>
            <div>{f.name}の{celebrate.title}</div>
          </Celebrate>
        )}
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>{browse ? '👁' : rate >= 0.8 ? '🌟' : rate >= 0.5 ? '⚔️' : '🛡️'}</div>
          <h2>{browse ? '閲覧おわり' : 'ステージ結果'}</h2>
          {!browse && (
            <>
              <div style={{ fontSize: 28, fontWeight: 900 }}>
                {summary.correct} / {summary.total} 正解
              </div>
              <div className="xpgain">+{summary.xp} XP</div>
              <div className="muted small">最大コンボ {summary.bestCombo}</div>
              {summary.wrongIds.length > 0 && <div className="infobox small" style={{ marginTop: 8 }}>間違えた {summary.wrongIds.length}問は復習クエストに追加されました。</div>}
            </>
          )}
        </div>
        <div className="grid2">
          <button className="btn ghost" onClick={() => go(`dungeon/${field}`)}>
            ダンジョンへ
          </button>
          <button className="btn" onClick={() => window.location.reload()}>
            もう一度
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row between">
        <Back to={`dungeon/${field}`} label={f.name} />
        <span className="chip gold">{browse ? '👁 閲覧モード' : STAGE_LABEL[kind]}</span>
      </div>
      <QuizSession questions={session} mode={browse ? 'browse' : 'play'} onFinish={finish} />
    </div>
  );
}
