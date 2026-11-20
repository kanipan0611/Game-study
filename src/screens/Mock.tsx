import { useEffect, useMemo, useRef, useState } from 'react';
import type { FieldId, MockResult, Question } from '../types';
import { useGame } from '../state/store';
import { EXAM_SOURCE, EXAM_SPECS, type ExamSpec } from '../data/examSpecs';
import { SCENARIOS } from '../data/scenarios';
import { FIELDS, FIELD_MAP } from '../data/fields';
import { shuffle } from '../engine/stages';
import { Explanation, isCorrect, QuestionCard } from '../components/QuestionCard';
import { Back, Bar, Exhibits, pct } from '../components/ui';
import { go } from '../router';

/** 実務シミュレーションの各ステップを事例問題に変換（実技模試で使用） */
function scenarioQuestions(grade: 2 | 3): Question[] {
  return SCENARIOS.filter((s) => grade === 2 || s.grade === 3).flatMap((s) =>
    s.steps.map((st, i) => ({
      id: `${s.id}-step${i}`,
      field: st.fields[0],
      grade: s.grade,
      stage: 'review' as const,
      format: 'case' as const,
      topic: 'scenario',
      scenario: `【${s.client}】${s.profile.join('／')}　${s.request}`,
      prompt: st.prompt,
      choices: st.choices.map((c, k) => ({ id: String.fromCharCode(97 + k), text: c.text, why: c.why })),
      answer: String.fromCharCode(97 + st.choices.findIndex((c) => c.good)),
      explanation: st.choices.find((c) => c.good)!.why,
      steps: st.steps,
      difficulty: 2 as const,
      law: st.law,
    })),
  );
}

/** 本試験と同様に6分野から均等に出題（不足分は他分野から補充） */
function pickByField(pool: Question[], total: number): Question[] {
  const fields: FieldId[] = ['life', 'risk', 'finance', 'tax', 'estate', 'inherit'];
  const per = Math.floor(total / fields.length);
  const picked: Question[] = [];
  const rest: Question[] = [];
  for (const f of fields) {
    const qs = shuffle(pool.filter((q) => q.field === f));
    picked.push(...qs.slice(0, per));
    rest.push(...qs.slice(per));
  }
  picked.push(...shuffle(rest).slice(0, Math.max(0, total - picked.length)));
  return picked;
}

function buildExam(spec: ExamSpec, qs: Question[]): Question[] {
  if (spec.key === 'g3-gakka') {
    // 本試験：○×式30問 ＋ 三答択一式30問
    const tf = pickByField(qs.filter((q) => q.grade === 3 && q.format === 'truefalse'), 30);
    const sc = pickByField(qs.filter((q) => q.grade === 3 && q.format === 'single'), 30);
    return [...tf, ...sc];
  }
  if (spec.key === 'g2-gakka') {
    // 本試験：四答択一式60問
    return shuffle(pickByField(qs.filter((q) => q.grade === 2 && q.format === 'single'), spec.questions));
  }
  const g = spec.grade;
  const fit = (q: Question) => g === 2 || q.grade === 3;
  const exhibits = qs.filter((q) => q.exhibit && fit(q));
  const calc = qs.filter((q) => !q.exhibit && q.format === 'numeric' && fit(q));
  const cases = scenarioQuestions(g);
  // 本試験の実技は「資料を読み取って答える」問題が中心：資料問題 約4割・事例 約3割・計算 約3割
  const nEx = Math.min(exhibits.length, Math.round(spec.questions * 0.4));
  const nCase = Math.min(cases.length, Math.round(spec.questions * 0.3));
  return shuffle([
    ...pickByField(exhibits, nEx),
    ...shuffle(cases).slice(0, nCase),
    ...pickByField(calc, spec.questions - nEx - nCase),
  ]);
}

export function MockMenu() {
  const { state } = useGame();
  return (
    <div>
      <Back to="" label="ホーム" />
      <div className="section-title">🎓 模擬試験</div>
      <div className="infobox small">
        本番と同じ制限時間・合格基準で採点します。収録問題数が本試験に満たない場合は、問題数と時間を比例縮小した「縮小版」になります（縮小版は合格実績の対象外）。
      </div>
      {EXAM_SPECS.map((s) => {
        const hist = state.mockHistory.filter((m) => m.grade === s.grade && m.part === s.part);
        const best = hist.reduce((a, m) => Math.max(a, m.score / m.max), 0);
        return (
          <div key={s.key} className="panel">
            <div className="row between">
              <h3 style={{ margin: 0 }}>{s.name}</h3>
              <span className="chip gold">{s.minutes}分</span>
            </div>
            <div className="muted small" style={{ margin: '4px 0 8px' }}>{s.note}</div>
            <div className="small">
              合格基準：{s.max}点満点中 {s.passLine}点以上（{pct(s.passLine / s.max)}）
            </div>
            {hist.length > 0 && (
              <div className="small muted">
                受験 {hist.length}回・最高 {pct(best)}・直近 {pct(hist[hist.length - 1].score / hist[hist.length - 1].max)}
              </div>
            )}
            <button className="btn block" style={{ marginTop: 8 }} onClick={() => go(`mock/${s.key}`)}>
              受験する
            </button>
          </div>
        );
      })}
      <div className="section-title">📈 模試履歴</div>
      <div className="panel small">
        {state.mockHistory.length === 0 && <span className="muted">まだ受験していません</span>}
        {[...state.mockHistory].reverse().slice(0, 15).map((m) => (
          <div key={m.id} className="row between" style={{ padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
            <span>
              {new Date(m.date).toLocaleDateString('ja-JP')} {m.grade}級{m.part === 'gakka' ? '学科' : '実技'}
              {m.scaled && <span className="muted">（縮小版{m.questionCount}問）</span>}
            </span>
            <span className={`chip ${m.passed ? 'ok' : 'ng'}`}>
              {Math.round(m.score * 10) / 10}/{m.max} {m.passed ? '合格' : '不合格'}
            </span>
          </div>
        ))}
      </div>
      <p className="muted small">出典：{EXAM_SOURCE}</p>
    </div>
  );
}

interface Ans {
  picked: string[];
  num: string;
  flag: boolean;
}

export function MockExam({ specKey }: { specKey: string }) {
  const { questions, actions } = useGame();
  const spec = EXAM_SPECS.find((s) => s.key === specKey);
  const exam = useMemo(() => (spec ? buildExam(spec, questions) : []), [spec, questions]);
  const scaled = !!spec && exam.length < spec.questions;
  const seconds = spec ? Math.max(300, Math.ceil((spec.minutes * 60 * exam.length) / spec.questions)) : 0;
  const [started, setStarted] = useState(false);
  const [left, setLeft] = useState(seconds);
  const [cur, setCur] = useState(0);
  const [ans, setAns] = useState<Record<string, Ans>>({});
  const [result, setResult] = useState<MockResult | null>(null);
  const [reviewIdx, setReviewIdx] = useState<number | null>(null);
  const startAt = useRef(0);
  // タイマーからの自動採点でも最新の解答を参照できるよう ref に保持
  const ansRef = useRef(ans);
  ansRef.current = ans;
  const finished = useRef(false);

  const finish = () => {
    if (finished.current || !spec) return;
    finished.current = true;
    const byField: MockResult['byField'] = {};
    let correct = 0;
    const realIds = new Set(questions.map((q) => q.id));
    for (const q of exam) {
      const a = ansRef.current[q.id] ?? { picked: [], num: '', flag: false };
      const ok = (a.picked.length > 0 || a.num !== '') && isCorrect(q, a.picked, a.num);
      if (ok) correct++;
      const bf = (byField[q.field] ??= { correct: 0, total: 0 });
      bf.total++;
      if (ok) bf.correct++;
      // 模試の結果も復習システムへ反映（XPは付与しない）
      if (realIds.has(q.id) && (a.picked.length > 0 || a.num !== '')) actions.answer(q, ok, { combo: 0, mode: 'mock' });
    }
    const score = Math.round((correct / exam.length) * spec.max * 10) / 10;
    const r: MockResult = {
      id: `mock-${Date.now()}`,
      date: Date.now(),
      grade: spec.grade,
      part: spec.part,
      score,
      max: spec.max,
      passLine: spec.passLine,
      passed: score >= spec.passLine,
      byField,
      questionCount: exam.length,
      scaled,
      seconds: Math.round((Date.now() - startAt.current) / 1000),
    };
    actions.mockDone(r);
    setResult(r);
  };

  useEffect(() => {
    if (!started || result) return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(t);
          setTimeout(finish, 0);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, result]);

  if (!spec) return <div>試験が見つかりません</div>;

  if (!started) {
    return (
      <div>
        <Back to="mock" label="模試一覧" />
        <div className="panel">
          <h2>{spec.name}</h2>
          <div className="small stack">
            <div>出題数：{exam.length}問 {scaled && <span className="chip warn">縮小版（本試験 {spec.questions}問）</span>}</div>
            <div>制限時間：{Math.ceil(seconds / 60)}分 {scaled && <span className="muted">（本試験 {spec.minutes}分を比例縮小）</span>}</div>
            <div>合格基準：得点率 {pct(spec.passLine / spec.max)} 以上</div>
            <div className="muted">{spec.note}</div>
          </div>
          <div className="warnbox" style={{ marginTop: 10 }}>
            試験中は解説が表示されません。🚩で見直しマークを付け、最後に一覧から見直せます。時間切れで自動採点されます。
          </div>
          <button
            className="btn block"
            style={{ marginTop: 12 }}
            disabled={!exam.length}
            onClick={() => {
              startAt.current = Date.now();
              setStarted(true);
            }}
          >
            試験開始
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    if (reviewIdx !== null) {
      const q = exam[reviewIdx];
      const a = ans[q.id] ?? { picked: [], num: '', flag: false };
      return (
        <div>
          <button className="btn ghost sm" onClick={() => setReviewIdx(null)} style={{ marginBottom: 10 }}>
            ← 結果に戻る
          </button>
          <div className="panel">
            <div className="muted small">
              第{reviewIdx + 1}問 ／ {FIELD_MAP[q.field].name}
            </div>
            {q.scenario && <div className="scenario-box">{q.scenario}</div>}
            <Exhibits items={q.exhibit} />
            <div className="qprompt">{q.prompt}</div>
            <Explanation q={q} correct={(a.picked.length > 0 || a.num !== '') && isCorrect(q, a.picked, a.num)} picked={a.picked} num={a.num} />
          </div>
          <div className="grid2">
            <button className="btn ghost" disabled={reviewIdx === 0} onClick={() => setReviewIdx(reviewIdx - 1)}>◀ 前</button>
            <button className="btn ghost" disabled={reviewIdx + 1 >= exam.length} onClick={() => setReviewIdx(reviewIdx + 1)}>次 ▶</button>
          </div>
        </div>
      );
    }
    const rate = result.score / result.max;
    return (
      <div>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56 }}>{result.passed ? '🎉' : '📖'}</div>
          <h2>{result.passed ? '合格ライン突破！' : rate >= 0.5 ? '合格ラインまであと一歩' : '合格ラインに届かず…弱点分野から復習しよう'}</h2>
          <div style={{ fontSize: 32, fontWeight: 900 }}>
            {result.score} <span className="muted" style={{ fontSize: 16 }}>/ {result.max}点</span>
          </div>
          <div className="small">
            合格基準 {result.passLine}点（{pct(result.passLine / result.max)}）／ あなた {pct(rate)}
          </div>
          <div style={{ position: 'relative', margin: '10px 0' }}>
            <Bar value={rate} tone={result.passed ? 'green' : 'red'} />
            <div style={{ position: 'absolute', top: -4, bottom: -4, left: `${(result.passLine / result.max) * 100}%`, width: 2, background: 'var(--gold-300)' }} />
          </div>
          {result.scaled && <div className="warnbox small">縮小版（{result.questionCount}問）のため参考値です。</div>}
          <div className="muted small">所要時間 {Math.floor(result.seconds / 60)}分{result.seconds % 60}秒</div>
        </div>
        <div className="section-title">分野別正答率</div>
        <div className="panel bars">
          {FIELDS.map((f) => {
            const b = result.byField[f.id as FieldId];
            if (!b) return null;
            const r = b.correct / b.total;
            return (
              <div key={f.id} className="bar">
                <div className="lbl">
                  <span>
                    {f.emoji} {f.name}
                  </span>
                  <span>
                    {b.correct}/{b.total}（{pct(r)}）{r < 0.6 && ' ⚠弱点'}
                  </span>
                </div>
                <Bar value={r} tone={r >= 0.6 ? 'green' : 'red'} thin />
              </div>
            );
          })}
        </div>
        <div className="section-title">解答の見直し</div>
        <div className="panel">
          <div className="qnav">
            {exam.map((q, i) => {
              const a = ans[q.id];
              const ok = a && (a.picked.length > 0 || a.num !== '') && isCorrect(q, a.picked, a.num);
              return (
                <button key={q.id} className={ok ? 'right' : 'wrong'} onClick={() => setReviewIdx(i)}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <p className="muted small">番号をタップで解説を表示。間違えた問題は復習クエストに追加済みです。</p>
        </div>
        <button className="btn block" onClick={() => go('mock')}>
          模試一覧へ
        </button>
      </div>
    );
  }

  const q = exam[cur];
  const a = ans[q.id] ?? { picked: [], num: '', flag: false };
  const setA = (patch: Partial<Ans>) => setAns((m) => ({ ...m, [q.id]: { ...a, ...patch } }));
  const answeredCount = exam.filter((x) => {
    const y = ans[x.id];
    return y && (y.picked.length > 0 || y.num !== '');
  }).length;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div>
      <div className="panel row between" style={{ position: 'sticky', top: 56, zIndex: 10 }}>
        <span className={`timer ${left < 60 ? 'low' : ''}`}>
          ⏱ {mm}:{ss}
        </span>
        <span className="small">
          解答 {answeredCount}/{exam.length}
        </span>
        <button
          className="btn sm"
          onClick={() => {
            if (window.confirm(`${exam.length - answeredCount}問が未解答です。採点しますか？`)) finish();
          }}
        >
          採点する
        </button>
      </div>
      <QuestionCard
        key={q.id}
        q={q}
        index={cur}
        total={exam.length}
        examMode={{ picked: a.picked, num: a.num, onChange: (picked, num) => setA({ picked, num }) }}
      />
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn ghost" style={{ flex: 1 }} disabled={cur === 0} onClick={() => setCur(cur - 1)}>
          ◀ 前
        </button>
        <button className={`btn ${a.flag ? '' : 'ghost'}`} onClick={() => setA({ flag: !a.flag })}>
          🚩
        </button>
        <button className="btn ghost" style={{ flex: 1 }} disabled={cur + 1 >= exam.length} onClick={() => setCur(cur + 1)}>
          次 ▶
        </button>
      </div>
      <div className="panel">
        <div className="small muted" style={{ marginBottom: 6 }}>問題一覧（🚩＝見直し）</div>
        <div className="qnav">
          {exam.map((x, i) => {
            const y = ans[x.id];
            const done = y && (y.picked.length > 0 || y.num !== '');
            return (
              <button key={x.id} className={`${done ? 'done' : ''} ${y?.flag ? 'flag' : ''} ${i === cur ? 'cur' : ''}`} onClick={() => setCur(i)}>
                {i + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
