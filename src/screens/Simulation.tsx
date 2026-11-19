import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { SCENARIOS } from '../data/scenarios';
import { FIELD_MAP } from '../data/fields';
import { shuffle } from '../engine/stages';
import { Back, Celebrate, LawBadge } from '../components/ui';
import { go } from '../router';

export function SimMenu() {
  const { state } = useGame();
  return (
    <div>
      <Back to="" label="ホーム" />
      <div className="section-title">🤝 実務シミュレーション</div>
      <p className="muted small">あなたはFPアカデミーの相談員。顧客の状況を読み取り、複数分野の知識を組み合わせて最適な助言を選ぼう。全ステップで最適解を選ぶと「解決」（初回 +100XP）。</p>
      {SCENARIOS.map((s) => (
        <a key={s.id} className={`stage ${state.scenariosCleared[s.id] ? 'cleared' : ''}`} href={`#/sim/${s.id}`}>
          <div className="icon">{s.avatar}</div>
          <div className="body">
            <div className="title">
              {s.title} {state.scenariosCleared[s.id] && <span className="chip gold">解決済</span>}
            </div>
            <div className="muted small">
              {s.client}・{s.grade}級レベル・{s.steps.length}ステップ
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

export function SimPlay({ id }: { id: string }) {
  const { actions } = useGame();
  const sc = SCENARIOS.find((s) => s.id === id);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [goods, setGoods] = useState(0);
  const [done, setDone] = useState<null | { xp: number; perfect: boolean }>(null);
  const order = useMemo(() => (sc ? sc.steps.map((st) => shuffle(st.choices.map((_, i) => i))) : []), [sc]);
  if (!sc) return <div>シナリオが見つかりません</div>;
  const st = sc.steps[step];

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (st.choices[i].good) setGoods(goods + 1);
  };
  const next = () => {
    if (step + 1 >= sc.steps.length) {
      const perfect = goods === sc.steps.length;
      const xp = actions.scenarioDone(sc.id, perfect, sc.steps.flatMap((s) => s.fields));
      setDone({ xp, perfect });
      return;
    }
    setStep(step + 1);
    setPicked(null);
  };

  if (done) {
    return done.perfect ? (
      <Celebrate emoji={sc.avatar} title="相談解決！" onClose={() => go('sim')}>
        <div>「ありがとうございます、とても安心しました！」</div>
        {done.xp > 0 ? <div className="xpgain">+{done.xp} XP</div> : <div className="muted small">解決済みのシナリオです</div>}
      </Celebrate>
    ) : (
      <div className="panel" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🤔</div>
        <h2>
          {goods}/{sc.steps.length} ステップで最適な助言
        </h2>
        <p className="muted">顧客はまだ少し不安そうです。解説を読み直して再挑戦しよう。</p>
        <div className="grid2">
          <button className="btn ghost" onClick={() => go('sim')}>一覧へ</button>
          <button className="btn" onClick={() => window.location.reload()}>再挑戦</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Back to="sim" label="相談一覧" />
      <div className="panel">
        <div className="row">
          <div style={{ fontSize: 44 }}>{sc.avatar}</div>
          <div>
            <h3 style={{ margin: 0 }}>{sc.client}</h3>
            <div className="muted small">{sc.title}</div>
          </div>
        </div>
        <ul className="small" style={{ margin: '8px 0', paddingLeft: 18 }}>
          {sc.profile.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <div className="scenario-box">{sc.request}</div>
      </div>
      <div className="panel">
        <div className="row between">
          <span className="chip gold">
            STEP {step + 1}/{sc.steps.length}
          </span>
          <span className="row">
            {st.fields.map((f) => (
              <span key={f} className="chip small">
                {FIELD_MAP[f].emoji}
                {FIELD_MAP[f].name}
              </span>
            ))}
          </span>
        </div>
        <div className="qprompt">{st.prompt}</div>
        <div className="choices">
          {order[step].map((ci, k) => {
            const c = st.choices[ci];
            const cls = picked === null ? '' : c.good ? 'right' : picked === ci ? 'wrong' : '';
            return (
              <button key={ci} className={`choice ${cls}`} onClick={() => choose(ci)} disabled={picked !== null}>
                <span className="mark">{String.fromCharCode(65 + k)}</span>
                <span>{c.text}</span>
              </button>
            );
          })}
        </div>
        {picked !== null && (
          <div className="explain">
            <div className={`result-banner ${st.choices[picked].good ? 'ok' : 'ng'}`}>{st.choices[picked].good ? '◎ 最適な助言！' : '✕ 再考が必要'}</div>
            <h4>■ 各選択肢の検討</h4>
            <ul className="whys">
              {order[step].map((ci, k) => (
                <li key={ci} className={st.choices[ci].good ? 'is-answer' : ''}>
                  <b>{String.fromCharCode(65 + k)}.</b> {st.choices[ci].why}
                </li>
              ))}
            </ul>
            {st.steps && (
              <>
                <h4>■ 計算</h4>
                <ol className="steps">
                  {st.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </>
            )}
            <LawBadge law={st.law} />
            <button className="btn block" style={{ marginTop: 12 }} onClick={next}>
              {step + 1 >= sc.steps.length ? '相談を締めくくる' : '次のステップ ▶'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
