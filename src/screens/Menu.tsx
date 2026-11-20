import { useRef, useState } from 'react';
import type { GameState } from '../types';
import { useGame } from '../state/store';
import { ACHIEVEMENTS } from '../data/meta';
import { BUILTIN_QUESTIONS } from '../data/questions';
import { BASIS_DATE } from '../data/fields';
import { EXAM_SOURCE } from '../data/examSpecs';
import { csvToQuestions, download, QUESTION_HEADERS, toCsv } from '../engine/csv';
import { levelInfo, titleFor, TITLES } from '../engine/xp';
import { XP } from '../engine/xp';

export function Menu() {
  const { state, actions } = useGame();
  const [msg, setMsg] = useState('');
  const saveRef = useRef<HTMLInputElement>(null);
  const qRef = useRef<HTMLInputElement>(null);
  const lv = levelInfo(state.xp).level;
  const statusCount = BUILTIN_QUESTIONS.reduce<Record<string, number>>((a, q) => ((a[q.law.status] = (a[q.law.status] ?? 0) + 1), a), {});

  return (
    <div>
      <div className="navgrid" style={{ marginTop: 6 }}>
        <a className="navcard" href="#/calc"><div className="e">🧮</div><div className="t">計算特訓</div></a>
        <a className="navcard" href="#/sim"><div className="e">🤝</div><div className="t">実務シミュレーション</div></a>
        <a className="navcard" href="#/mock"><div className="e">🎓</div><div className="t">模擬試験</div></a>
        <a className="navcard" href="#/skills"><div className="e">🌳</div><div className="t">スキルツリー</div></a>
        <a className="navcard" href="#/drill"><div className="e">📄</div><div className="t">資料読み取り演習</div></a>
      </div>

      <div className="section-title">🏅 称号</div>
      <div className="panel small">
        {TITLES.map((t) => (
          <div key={t.level} className="row between" style={{ opacity: lv >= t.level ? 1 : 0.4 }}>
            <span>{lv >= t.level ? '👑' : '🔒'} {t.title}</span>
            <span className="muted">Lv.{t.level}</span>
          </div>
        ))}
        <div style={{ marginTop: 6 }}>現在の称号：<b style={{ color: 'var(--gold-300)' }}>{titleFor(lv)}</b></div>
      </div>

      <div className="section-title">🎖 実績バッジ（{Object.keys(state.achievements).length}/{ACHIEVEMENTS.length}）</div>
      <div className="panel">
        {ACHIEVEMENTS.map((a) => (
          <div key={a.id} className={`ach ${state.achievements[a.id] ? '' : 'off'}`}>
            <div className="e">{a.emoji}</div>
            <div>
              <div style={{ fontWeight: 800 }}>{a.name}</div>
              <div className="muted small">{a.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">⚖️ 経験値のルール</div>
      <div className="panel small">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>初回正解：{XP.firstClear[1]}〜{XP.firstClear[3]}XP（2級は×{XP.grade2Mult}）</li>
          <li>復習：期限が来た問題に正解して定着Lvが上がった時のみ（同じLvで二度はもらえない）</li>
          <li>苦手克服ボーナス：一度間違えた問題を後で正解 +{XP.overcome}</li>
          <li>期限前の再挑戦・閲覧モード：0XP（同じ問題の連打では稼げません）</li>
          <li>ステージ制覇・ボス撃破・相談解決：初回のみ</li>
          <li>計算特訓：1日{XP.calcDailyCap}XPまで／問題集の記録：1日{XP.bookDailyCap}XPまで</li>
          <li>実力メーター（ホーム）はXPと無関係に、定着度と模試結果だけで算出</li>
        </ul>
      </div>

      <div className="section-title">📜 法改正・問題の正確性</div>
      <div className="panel small">
        <p style={{ marginTop: 0 }}>
          収録問題はすべてオリジナルで、各問題に「法令基準日・根拠法令・出典・検証状態」を付けています。現在の基準日は <b>{BASIS_DATE}</b>（2026年6月〜2027年5月受検分）です。
        </p>
        <div className="row wrap">
          <span className="chip ok">現行制度確認済 {statusCount.verified ?? 0}問</span>
          <span className="chip warn">要確認 {statusCount['needs-review'] ?? 0}問</span>
          <span className="chip ng">旧制度 {statusCount.outdated ?? 0}問</span>
        </div>
        <p className="muted">
          CSV で取り込んだ問題は自動的に「要確認」となり、検証済みとは表示されません。試験制度：{EXAM_SOURCE}
        </p>
      </div>

      <div className="section-title">➕ オリジナル問題のCSV取込</div>
      <div className="panel small">
        <p style={{ marginTop: 0 }}>自作問題を CSV で追加できます（将来の OCR 取込も同じ形式に変換して利用）。市販教材の問題文の転記はしないでください。</p>
        <div className="row wrap">
          <button className="btn sm" onClick={() => qRef.current?.click()}>CSVを取り込む</button>
          <button
            className="btn ghost sm"
            onClick={() =>
              download(
                'fpquest-questions-template.csv',
                toCsv([
                  QUESTION_HEADERS,
                  ['', 'tax', 3, 'single', 'tax-deduct', '（自作の問題文）', '選択肢A', '選択肢B', '選択肢C', '', 'Aの解説', 'Bの解説', 'Cの解説', '', 'b', '', '正解の理由', '式1|式2', '2026-04-01', '所得税法 第○条', '国税庁'],
                ]),
              )
            }
          >
            テンプレート
          </button>
          <input
            ref={qRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const { questions, errors } = csvToQuestions(await file.text());
              actions.importQuestions(questions);
              setMsg(`${questions.length}問を取り込みました。${errors.length ? `エラー：${errors.slice(0, 3).join(' / ')}` : ''}`);
            }}
          />
        </div>
        <div className="muted" style={{ marginTop: 6 }}>登録済みの自作問題：{state.customQuestions.length}問</div>
        {state.customQuestions.slice(0, 20).map((q) => (
          <div key={q.id} className="row between" style={{ padding: '3px 0' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.prompt}</span>
            <button className="linkbtn" onClick={() => actions.deleteCustomQuestion(q.id)}>削除</button>
          </div>
        ))}
      </div>

      <div className="section-title">⚙️ 設定・セーブデータ</div>
      <div className="panel">
        <label className="field">
          冒険者名
          <input className="input" defaultValue={state.playerName} onBlur={(e) => actions.setName(e.target.value)} />
        </label>
        <label className="field">
          1日の目標学習時間
          <select value={state.settings.dailyGoalMin} onChange={(e) => actions.setGoal(Number(e.target.value))}>
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m}分
              </option>
            ))}
          </select>
        </label>
        <div className="row wrap">
          <button className="btn ghost sm" onClick={() => download(`fpquest-save-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state), 'application/json')}>
            セーブをエクスポート
          </button>
          <button className="btn ghost sm" onClick={() => saveRef.current?.click()}>
            セーブを読み込み
          </button>
          <button className="btn danger sm" onClick={() => window.confirm('すべての進捗を削除します。よろしいですか？') && actions.reset()}>
            データ初期化
          </button>
          <input
            ref={saveRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const data = JSON.parse(await file.text()) as GameState;
                if (typeof data.xp !== 'number' || !data.records) throw new Error();
                actions.replaceAll(data);
                setMsg('セーブデータを読み込みました。');
              } catch {
                setMsg('読み込みに失敗しました（形式が違います）。');
              }
            }}
          />
        </div>
        <p className="muted small">進捗はこの端末のブラウザ（LocalStorage）に保存されます。機種変更時はエクスポートしてください。</p>
      </div>
      {msg && <div className="toast" onClick={() => setMsg('')} style={{ position: 'fixed', bottom: 90, left: 16, right: 16, margin: '0 auto' }}>{msg}</div>}
    </div>
  );
}
