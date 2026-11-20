import { useState } from 'react';
import { useGame } from '../state/store';
import { CALC_KINDS, checkNumber, seeded, yen, type CalcProblem } from '../engine/calcGenerators';
import { Back, pct } from '../components/ui';
import { FIELD_MAP } from '../data/fields';

export function CalcMenu() {
  const { state } = useGame();
  return (
    <div>
      <Back to="" label="ホーム" />
      <div className="section-title">🧮 計算特訓モード</div>
      <p className="muted small">
        数値が毎回ランダムに変わるので「答えの丸暗記」ができません。式と途中過程を確認しながら、試験で必ず出る計算を体に染み込ませましょう。（正解1問 +6XP、1日120XPまで）
      </p>
      <a className="navcard" href="#/drill" style={{ marginBottom: 10 }}>
        <div className="e">📄</div>
        <div className="t">資料読み取り演習（実技対策）</div>
        <div className="muted small">キャッシュフロー表・保険証券・源泉徴収票・登記事項証明書・親族関係図など</div>
      </a>
      <div className="navgrid">
        {CALC_KINDS.map((k) => {
          const st = state.calcDrills.byKind[k.id];
          return (
            <a key={k.id} className="navcard" href={`#/calc/${k.id}`}>
              <div className="e">{k.emoji}</div>
              <div className="t">{k.name}</div>
              <div className="muted small">
                {FIELD_MAP[k.field].name}
                <br />
                {st ? `${st.correct}/${st.done} 正解（${pct(st.correct / st.done)}）` : '未挑戦'}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function CalcDrill({ kind }: { kind: string }) {
  const { actions } = useGame();
  const def = CALC_KINDS.find((k) => k.id === kind);
  const [seed, setSeed] = useState(() => Date.now());
  const [input, setInput] = useState('');
  const [result, setResult] = useState<null | { ok: boolean; xp: number }>(null);
  const [streak, setStreak] = useState(0);
  const [showFormula, setShowFormula] = useState(false);
  if (!def) return <div>不明な特訓です</div>;
  const p: CalcProblem = def.gen(seeded(seed));

  const submit = () => {
    if (result || !input.trim()) return;
    const ok = checkNumber(input, p.answer, p.tolerance);
    const xp = actions.calcResult(def.id, def.field, ok);
    setStreak(ok ? streak + 1 : 0);
    setResult({ ok, xp });
  };
  const next = () => {
    setSeed(seed + 7919);
    setInput('');
    setResult(null);
    setShowFormula(false);
  };

  return (
    <div>
      <div className="row between">
        <Back to="calc" label="計算特訓" />
        {streak >= 2 && <span className="combo">🔥 {streak}連続</span>}
      </div>
      <div className="panel">
        <div className="row wrap" style={{ marginBottom: 6 }}>
          <span className="chip gold">
            {def.emoji} {p.title}
          </span>
          <span className="chip">{FIELD_MAP[p.field].name}</span>
        </div>
        <div className="qprompt">{p.prompt}</div>
        {p.table && (
          <table className="datatable">
            <tbody>
              {p.table.map((row, i) => (
                <tr key={i}>{row.map((c, j) => (i === 0 ? <th key={j}>{c}</th> : <td key={j}>{c}</td>))}</tr>
              ))}
            </tbody>
          </table>
        )}
        {!result && (
          <button className="linkbtn small" onClick={() => setShowFormula(!showFormula)}>
            💡 {showFormula ? '公式を隠す' : '公式のヒントを見る'}
          </button>
        )}
        {showFormula && !result && <div className="infobox small">{p.formula}</div>}
        <form
          className="numinput"
          style={{ marginTop: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input inputMode="decimal" value={input} onChange={(e) => setInput(e.target.value)} disabled={!!result} placeholder="答え" aria-label="解答" />
          <span style={{ fontWeight: 800 }}>{p.unit}</span>
        </form>
        {!result ? (
          <button className="btn block" style={{ marginTop: 12 }} onClick={submit} disabled={!input.trim()}>
            解答する
          </button>
        ) : (
          <div className="explain">
            <div className={`result-banner ${result.ok ? 'ok' : 'ng'}`}>{result.ok ? '◎ 正解！' : '✕ 不正解'}</div>
            {result.xp > 0 && <div className="xpgain" style={{ textAlign: 'center' }}>+{result.xp} XP</div>}
            <h4>■ 正解</h4>
            <div style={{ fontWeight: 800 }}>
              {yen(p.answer)} {p.unit}
              {!result.ok && <span className="muted small">（あなたの解答：{input}）</span>}
            </div>
            <h4>■ 公式</h4>
            <div>{p.formula}</div>
            <h4>■ 途中過程</h4>
            <ol className="steps">
              {p.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <div className="law">数値は架空の設例です。税率・控除額は法令基準日 2026-04-01 時点の制度に基づきます。</div>
            <button className="btn block" style={{ marginTop: 12 }} onClick={next}>
              次の問題 ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
