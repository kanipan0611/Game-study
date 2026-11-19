import { useRef, useState } from 'react';
import type { BookEntry, FieldId, Grade } from '../types';
import { useGame } from '../state/store';
import { FIELDS, FIELD_MAP } from '../data/fields';
import { BOOK_HEADERS, bookToCsv, csvToBook, download, toCsv } from '../engine/csv';
import { Bar, pct } from '../components/ui';

const PRESETS = ['史上最強のFP3級問題集', '史上最強のFP2級AFP問題集', '史上最強のFP3級テキスト', '史上最強のFP2級AFPテキスト'];
const STATUS: Record<BookEntry['status'], { t: string; c: string }> = {
  untouched: { t: '未着手', c: '' },
  solved: { t: '解答済', c: 'gold' },
  review: { t: '要復習', c: 'ng' },
  mastered: { t: '習得', c: 'ok' },
};
const STAGE_OPTS = (field: FieldId) => [
  { v: `${field}-basic`, t: '基礎ステージ（3級）' },
  { v: `${field}-calc`, t: '計算ステージ' },
  { v: `${field}-applied`, t: '応用ステージ（2級）' },
];

type Filter = 'all' | 'weak' | 'review' | FieldId;

export function Book() {
  const { state, actions } = useGame();
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const entries = state.bookEntries.filter((e) =>
    filter === 'all' ? true : filter === 'weak' ? e.weak : filter === 'review' ? e.status === 'review' : e.field === filter,
  );
  const all = state.bookEntries;
  const attempts = all.flatMap((e) => e.attempts);
  const acc = attempts.length ? attempts.filter((a) => a.correct).length / attempts.length : 0;

  const onImport = async (file: File) => {
    const text = await file.text();
    const { entries: es, errors } = csvToBook(text);
    actions.importBook(es);
    setMsg(`${es.length}件を取り込みました。${errors.length ? `（エラー ${errors.length}件：${errors.slice(0, 3).join(' / ')}）` : ''}`);
  };

  return (
    <div>
      <div className="section-title">📚 史上最強シリーズ 学習記録</div>
      <div className="infobox small">
        お手持ちの問題集（ナツメ社「史上最強のFP」シリーズ）を開いて解き、結果をここに記録します。著作権に配慮し、問題文・解説は登録せず「章・ページ・問題番号・正誤・理解度」のみを管理します。ゲーム内の演習はすべてオリジナル問題です。
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="grid3 small" style={{ textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{all.length}</div>登録
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ng)' }}>{all.filter((e) => e.weak).length}</div>苦手
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ok)' }}>{all.filter((e) => e.status === 'mastered').length}</div>習得
          </div>
        </div>
        <div className="small" style={{ marginTop: 8 }}>
          問題集の正答率 {pct(acc)}（{attempts.length}回解答）
        </div>
        <Bar value={acc} tone="green" thin />
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className="btn sm" onClick={() => setAdding(!adding)}>
            ＋ 記録を追加
          </button>
          <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>
            CSV取込
          </button>
          <button className="btn ghost sm" disabled={!all.length} onClick={() => download('fpquest-book.csv', bookToCsv(all))}>
            CSV出力
          </button>
          <button
            className="btn ghost sm"
            onClick={() =>
              download(
                'fpquest-book-template.csv',
                toCsv([BOOK_HEADERS, ['史上最強のFP3級問題集', '第1章 ライフプランニング', 12, '問3', 'ライフ', 3, 'solved', 3, 0, 'life-basic', '係数の選び方を間違えた', 1, 1]]),
              )
            }
          >
            テンプレート
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
        {msg && <div className="small" style={{ marginTop: 6 }}>{msg}</div>}
      </div>

      {adding && <AddForm onDone={() => setAdding(false)} />}

      <div className="tabs">
        {(['all', 'weak', 'review'] as Filter[]).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'すべて' : f === 'weak' ? '苦手' : '要復習'}
          </button>
        ))}
        {FIELDS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>
            {f.emoji}
            {f.name}
          </button>
        ))}
      </div>

      {entries.length === 0 && <div className="panel muted small">記録がありません。「＋記録を追加」から、解いた問題を登録しましょう。</div>}
      {[...entries]
        .sort((a, b) => a.book.localeCompare(b.book) || (a.page ?? 0) - (b.page ?? 0) || a.problemNo.localeCompare(b.problemNo, 'ja', { numeric: true }))
        .map((e) => (
          <BookRow key={e.id} e={e} />
        ))}
    </div>
  );
}

function BookRow({ e }: { e: BookEntry }) {
  const { actions } = useGame();
  const [open, setOpen] = useState(false);
  const f = FIELD_MAP[e.field];
  const st = STATUS[e.status];
  const c = e.attempts.filter((a) => a.correct).length;
  return (
    <div className={`book-row ${e.weak ? 'weak' : ''}`}>
      <div className="row between">
        <div style={{ minWidth: 0 }}>
          <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {e.book}
          </div>
          <div style={{ fontWeight: 800 }}>
            {f.emoji} {e.chapter} {e.page !== null && `p.${e.page}`} {e.problemNo}
          </div>
        </div>
        <span className={`chip ${st.c}`}>{st.t}</span>
      </div>
      <div className="row between" style={{ marginTop: 6 }}>
        <span className="stars" aria-label="理解度">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => actions.updateBook(e.id, { understanding: (e.understanding === n ? n - 1 : n) as BookEntry['understanding'] })}>
              {n <= e.understanding ? '★' : '☆'}
            </button>
          ))}
        </span>
        <span className="row">
          <button className="btn sm" style={{ background: 'linear-gradient(180deg,#6fe0a3,#2a9d63)', borderColor: '#6fe0a3' }} onClick={() => actions.logBookAttempt(e.id, true)}>
            ○正解
          </button>
          <button className="btn sm danger" onClick={() => actions.logBookAttempt(e.id, false)}>
            ×誤答
          </button>
        </span>
      </div>
      <div className="row between small" style={{ marginTop: 4 }}>
        <span className="muted">
          {e.grade}級・正誤 {c}/{e.attempts.length}{' '}
          {e.attempts
            .slice(-6)
            .map((a) => (a.correct ? '○' : '×'))
            .join('')}
        </span>
        <button className="linkbtn small" onClick={() => setOpen(!open)}>
          {open ? '閉じる' : '詳細'}
        </button>
      </div>
      {open && (
        <div className="stack" style={{ marginTop: 6 }}>
          <label className="field">
            メモ（自分の言葉で。問題文の転記はしない）
            <textarea defaultValue={e.memo} onBlur={(ev) => actions.updateBook(e.id, { memo: ev.target.value })} />
          </label>
          <label className="field">
            関連ステージ
            <select value={e.linkedStage ?? ''} onChange={(ev) => actions.updateBook(e.id, { linkedStage: ev.target.value || null })}>
              <option value="">なし</option>
              {STAGE_OPTS(e.field).map((o) => (
                <option key={o.v} value={o.v}>
                  {o.t}
                </option>
              ))}
            </select>
          </label>
          <div className="row wrap">
            <button className="btn ghost sm" onClick={() => actions.updateBook(e.id, { weak: !e.weak })}>
              {e.weak ? '苦手を解除' : '苦手にする'}
            </button>
            {e.linkedStage && (
              <a className="btn ghost sm" href={`#/play/${e.linkedStage.replace('-', '/')}`}>
                ⚔ 関連ステージで類題演習
              </a>
            )}
            <button className="btn danger sm" onClick={() => window.confirm('この記録を削除しますか？') && actions.deleteBook(e.id)}>
              削除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const { actions } = useGame();
  const [book, setBook] = useState(PRESETS[0]);
  const [chapter, setChapter] = useState('');
  const [page, setPage] = useState('');
  const [no, setNo] = useState('');
  const [range, setRange] = useState('');
  const [field, setField] = useState<FieldId>('life');
  const [grade, setGrade] = useState<Grade>(3);
  const [stage, setStage] = useState('');

  const save = () => {
    const base = {
      book, chapter, page: page ? Number(page) : null, field, grade,
      status: 'untouched' as const, understanding: 0 as const, weak: false,
      linkedStage: stage || `${field}-${grade === 3 ? 'basic' : 'applied'}`, memo: '', origin: 'manual' as const,
    };
    // 「1-10」のような範囲指定で一括登録
    const m = range.match(/^(\d+)\s*[-〜~]\s*(\d+)$/);
    if (m) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      for (let i = Math.min(a, b); i <= Math.min(Math.max(a, b), Math.min(a, b) + 99); i++) actions.addBook({ ...base, problemNo: `問${i}` });
    } else {
      actions.addBook({ ...base, problemNo: no });
    }
    onDone();
  };

  return (
    <div className="panel">
      <h3>記録を追加</h3>
      <label className="field">
        問題集
        <input className="input" list="book-presets" value={book} onChange={(e) => setBook(e.target.value)} />
        <datalist id="book-presets">
          {PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      <div className="grid2">
        <label className="field">
          分野
          <select value={field} onChange={(e) => setField(e.target.value as FieldId)}>
            {FIELDS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.no}. {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          級
          <select value={grade} onChange={(e) => setGrade(Number(e.target.value) as Grade)}>
            <option value={3}>3級</option>
            <option value={2}>2級</option>
          </select>
        </label>
      </div>
      <label className="field">
        章
        <input className="input" value={chapter} placeholder="例：第2章 リスク管理" onChange={(e) => setChapter(e.target.value)} />
      </label>
      <div className="grid2">
        <label className="field">
          ページ
          <input className="input" inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} />
        </label>
        <label className="field">
          問題番号
          <input className="input" value={no} placeholder="例：問5" onChange={(e) => setNo(e.target.value)} />
        </label>
      </div>
      <label className="field">
        または一括登録（番号の範囲）
        <input className="input" value={range} placeholder="例：1-20 → 問1〜問20を登録" onChange={(e) => setRange(e.target.value)} />
      </label>
      <label className="field">
        ゲーム内の関連ステージ
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">自動（{grade === 3 ? '基礎' : '応用'}ステージ）</option>
          {STAGE_OPTS(field).map((o) => (
            <option key={o.v} value={o.v}>
              {o.t}
            </option>
          ))}
        </select>
      </label>
      <div className="grid2">
        <button className="btn ghost" onClick={onDone}>
          キャンセル
        </button>
        <button className="btn" onClick={save} disabled={!no && !range}>
          登録
        </button>
      </div>
    </div>
  );
}
