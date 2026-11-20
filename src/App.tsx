import { useEffect, useRef } from 'react';
import type { FieldId, StageKind } from './types';
import { useGame } from './state/store';
import { useRoute } from './router';
import { levelInfo } from './engine/xp';
import { streakOf } from './engine/dates';
import { dueQuestions } from './engine/stages';
import { Bar, Toasts } from './components/ui';
import { Home } from './screens/Home';
import { WorldMap } from './screens/WorldMap';
import { Dungeon, Play } from './screens/Dungeon';
import { Boss } from './screens/Boss';
import { Review } from './screens/Review';
import { CalcDrill, CalcMenu } from './screens/Calc';
import { SimMenu, SimPlay } from './screens/Simulation';
import { MockExam, MockMenu } from './screens/Mock';
import { Book } from './screens/Book';
import { SkillTree, Stats } from './screens/Progress';
import { Menu } from './screens/Menu';
import { ExhibitDrill } from './screens/ExhibitDrill';

const TABS = [
  { to: '', ico: '🏠', label: 'ホーム', match: ['', 'skills'] },
  { to: 'map', ico: '🗺️', label: '地図', match: ['map', 'dungeon', 'play', 'boss'] },
  { to: 'review', ico: '🔁', label: '復習', match: ['review'] },
  { to: 'book', ico: '📚', label: '問題集', match: ['book'] },
  { to: 'stats', ico: '📊', label: '記録', match: ['stats'] },
  { to: 'menu', ico: '☰', label: 'メニュー', match: ['menu', 'calc', 'sim', 'mock', 'drill'] },
];

/** 学習時間の計測：画面が表示中かつ直近2分以内に操作があれば加算 */
function useStudyTimer() {
  const { actions } = useGame();
  const last = useRef(Date.now());
  useEffect(() => {
    const touch = () => (last.current = Date.now());
    const evs = ['pointerdown', 'keydown', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - last.current < 120_000) actions.addSeconds(15);
    }, 15_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(t);
    };
  }, [actions]);
}

export function App() {
  const { state, questions } = useGame();
  const { parts, query, nonce } = useRoute();
  useStudyTimer();
  const lv = levelInfo(state.xp);
  const streak = streakOf(state.days);
  const due = dueQuestions(questions, state).length;
  const [p0 = '', p1, p2] = parts;

  let screen: JSX.Element;
  switch (p0) {
    case 'map': screen = <WorldMap />; break;
    case 'dungeon': screen = <Dungeon field={p1 as FieldId} />; break;
    case 'play': screen = <Play key={parts.join('/') + query.toString() + nonce} field={p1 as FieldId} kind={p2 as StageKind} browse={query.get('browse') === '1'} />; break;
    case 'boss': screen = <Boss key={parts.join('/') + nonce} field={p1 as FieldId} grade={Number(p2) === 2 ? 2 : 3} />; break;
    case 'review': screen = <Review />; break;
    case 'calc': screen = p1 ? <CalcDrill key={p1} kind={p1} /> : <CalcMenu />; break;
    case 'sim': screen = p1 ? <SimPlay key={p1 + nonce} id={p1} /> : <SimMenu />; break;
    case 'mock': screen = p1 ? <MockExam key={p1} specKey={p1} /> : <MockMenu />; break;
    case 'drill': screen = <ExhibitDrill />; break;
    case 'book': screen = <Book />; break;
    case 'skills': screen = <SkillTree />; break;
    case 'stats': screen = <Stats />; break;
    case 'menu': screen = <Menu />; break;
    default: screen = <Home />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="logo" style={{ textDecoration: 'none' }}>⚔ FP QUEST</a>
        <div className="lv">
          <div className="row between small">
            <b style={{ color: 'var(--gold-300)' }}>Lv.{lv.level}</b>
            <span className="muted">{state.xp} XP</span>
          </div>
          <Bar value={lv.progress} thin />
        </div>
        <span className="chip gold" title="連続学習日数">🔥{streak}</span>
      </header>
      <main className="main">{screen}</main>
      <nav className="bottomnav">
        <div className="inner">
          {TABS.map((t) => (
            <a key={t.label} href={`#/${t.to}`} className={t.match.includes(p0) ? 'on' : ''}>
              <span className="ico">{t.ico}</span>
              {t.label}
              {t.to === 'review' && due > 0 && <span className="badge-dot">{due}</span>}
            </a>
          ))}
        </div>
      </nav>
      <Toasts />
    </div>
  );
}
