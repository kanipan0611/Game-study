import { useGame } from '../state/store';
import { FIELDS } from '../data/fields';
import { fieldMastery } from '../engine/xp';
import { pct } from '../components/ui';

export function WorldMap() {
  const { state, questions } = useGame();
  const now = Date.now();
  return (
    <div>
      <div className="section-title">🗺️ FPアカデミー大陸</div>
      <div className="worldmap">
        <svg className="paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {FIELDS.map((f) => (
            <line key={f.id} x1="50" y1="50" x2={f.map.x} y2={f.map.y} stroke="rgba(246,211,107,.35)" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
          ))}
          {FIELDS.map((f, i) => {
            const n = FIELDS[(i + 1) % FIELDS.length];
            return <line key={'r' + f.id} x1={f.map.x} y1={f.map.y} x2={n.map.x} y2={n.map.y} stroke="rgba(255,255,255,.08)" strokeWidth="0.4" />;
          })}
        </svg>
        <div className="center">
          <div className="castle">🏯</div>
          FPアカデミー
        </div>
        {FIELDS.map((f) => {
          const m3 = fieldMastery(f.id, questions, state, now, 3);
          const b3 = state.bossCleared[`${f.id}-3`];
          const b2 = state.bossCleared[`${f.id}-2`];
          return (
            <a key={f.id} className="node" href={`#/dungeon/${f.id}`} style={{ left: `${f.map.x}%`, top: `${f.map.y}%`, ['--c' as string]: f.color }}>
              <div className="orb">{f.emoji}</div>
              <div className="nm">
                {f.no}. {f.name}
              </div>
              <div className="sub">{f.dungeon}</div>
              <div className="crowns">
                {b3 ? '👑' : '・'}
                {b2 ? '💎' : '・'} <span className="muted">{pct(m3.retention)}</span>
              </div>
            </a>
          );
        })}
      </div>
      <p className="muted small">👑 3級ボス撃破　💎 2級ボス撃破　％は3級範囲の定着度。どのダンジョンからでも挑戦できます。</p>
    </div>
  );
}
