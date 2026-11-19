import { useGame } from '../state/store';
import { DAILY_POOL, WEEKLY_POOL } from '../data/meta';
import { FIELDS } from '../data/fields';
import { estimatedScore, fieldMastery, levelInfo, titleFor } from '../engine/xp';
import { dateKey, streakOf } from '../engine/dates';
import { dueQuestions } from '../engine/stages';
import { Bar, pct } from '../components/ui';

export function Home() {
  const { state, questions, actions } = useGame();
  const now = Date.now();
  const lv = levelInfo(state.xp);
  const streak = streakOf(state.days);
  const today = state.days[dateKey(new Date())];
  const minutes = Math.floor((today?.seconds ?? 0) / 60);
  const due = dueQuestions(questions, state, now).length;
  const est3 = estimatedScore(state, questions, 3, now);
  const est2 = estimatedScore(state, questions, 2, now);
  // ゲームレベルと実力の乖離チェック
  const gap = lv.level >= 10 && est3.score < 40;
  // おすすめ：最も定着度の低い分野
  const weakest = FIELDS.map((f) => ({ f, m: fieldMastery(f.id, questions, state, now, 3) })).sort((a, b) => a.m.retention - b.m.retention)[0];

  return (
    <div>
      <div className="panel">
        <div className="row between">
          <div>
            <div className="muted small">{titleFor(lv.level)}</div>
            <h2 style={{ margin: 0 }}>
              {state.playerName} <span style={{ color: 'var(--gold-400)' }}>Lv.{lv.level}</span>
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26 }}>🔥{streak}</div>
            <div className="muted small">連続学習日数</div>
          </div>
        </div>
        <div style={{ margin: '8px 0 4px' }}>
          <Bar value={lv.progress} />
        </div>
        <div className="muted small">
          EXP {state.xp - lv.cur} / {lv.next - lv.cur}（次のレベルまで {lv.next - state.xp}）
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="row between small">
            <span>今日の学習 {minutes}分 / 目標 {state.settings.dailyGoalMin}分</span>
            <span className="muted">{today?.answered ?? 0}問・正解{today?.correct ?? 0}</span>
          </div>
          <Bar value={minutes / state.settings.dailyGoalMin} tone="green" thin />
        </div>
      </div>

      <div className="grid2">
        <a className="navcard" href="#/review">
          <div className="e">🔁</div>
          <div className="t">復習クエスト</div>
          <div className="muted small">{due > 0 ? `${due}問が復習どき` : '復習待ちなし'}</div>
        </a>
        <a className="navcard" href={`#/dungeon/${weakest.f.id}`}>
          <div className="e">{weakest.f.emoji}</div>
          <div className="t">おすすめ</div>
          <div className="muted small">{weakest.f.name}（定着 {pct(weakest.m.retention)}）</div>
        </a>
      </div>

      <div className="section-title">📜 デイリークエスト</div>
      <div className="panel">
        {state.daily.quests.map((q) => {
          const def = DAILY_POOL.find((d) => d.id === q.id)!;
          return <QuestRow key={q.id} def={def} q={q} onClaim={() => actions.claimQuest(q.id, 'daily')} />;
        })}
      </div>
      <div className="section-title">🗓️ ウィークリークエスト</div>
      <div className="panel">
        {state.weekly.quests.map((q) => {
          const def = WEEKLY_POOL.find((d) => d.id === q.id)!;
          return <QuestRow key={q.id} def={def} q={q} onClaim={() => actions.claimQuest(q.id, 'weekly')} />;
        })}
      </div>

      <div className="section-title">🎯 実力メーター（ゲームLvとは別に評価）</div>
      <div className="panel">
        <Meter label="FP3級 推定得点率" est={est3} />
        <Meter label="FP2級 推定得点率" est={est2} />
        {gap && <div className="warnbox">レベルに対して知識の定着が追いついていません。新しい問題より「復習クエスト」を優先しましょう。</div>}
        <div className="muted small" style={{ marginTop: 6 }}>
          推定得点率 ＝ 問題の定着度（間隔反復）60％ ＋ 直近の学科模試 40％。合格ラインの目安は60％です。
        </div>
      </div>

      <div className="section-title">⚔️ 冒険メニュー</div>
      <div className="navgrid">
        <a className="navcard" href="#/map"><div className="e">🗺️</div><div className="t">世界地図</div><div className="muted small">6つのダンジョン</div></a>
        <a className="navcard" href="#/calc"><div className="e">🧮</div><div className="t">計算特訓</div><div className="muted small">数値が毎回変わる</div></a>
        <a className="navcard" href="#/sim"><div className="e">🤝</div><div className="t">実務シミュレーション</div><div className="muted small">顧客相談を解決</div></a>
        <a className="navcard" href="#/mock"><div className="e">🎓</div><div className="t">模擬試験</div><div className="muted small">3級・2級 学科/実技</div></a>
        <a className="navcard" href="#/book"><div className="e">📚</div><div className="t">史上最強 連携</div><div className="muted small">問題集の学習記録</div></a>
        <a className="navcard" href="#/skills"><div className="e">🌳</div><div className="t">スキルツリー</div><div className="muted small">論点ごとの習得度</div></a>
      </div>
    </div>
  );
}

function Meter({ label, est }: { label: string; est: ReturnType<typeof estimatedScore> }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row between small">
        <span>{label}</span>
        <span>
          <b style={{ color: est.score >= 60 ? 'var(--ok)' : 'var(--gold-300)' }}>{est.score}%</b>
          {est.provisional && <span className="muted">（暫定・模試未受験）</span>}
        </span>
      </div>
      <Bar value={est.score / 100} tone={est.score >= 60 ? 'green' : undefined} thin />
    </div>
  );
}

function QuestRow({ def, q, onClaim }: { def: (typeof DAILY_POOL)[number]; q: { progress: number; claimed: boolean }; onClaim: () => void }) {
  const done = q.progress >= def.target;
  return (
    <div className="quest">
      <div className="q-ico">{def.emoji}</div>
      <div className="q-body">
        <div className="small" style={{ fontWeight: 700 }}>{def.name}</div>
        <Bar value={q.progress / def.target} thin />
        <div className="muted small">
          {q.progress}/{def.target}
        </div>
      </div>
      {q.claimed ? (
        <span className="chip ok">達成済</span>
      ) : (
        <button className="btn sm" disabled={!done} onClick={onClaim}>
          受取
        </button>
      )}
    </div>
  );
}
