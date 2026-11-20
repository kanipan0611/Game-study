import { useEffect, useState, type ReactNode } from 'react';
import type { Exhibit, LawMeta } from '../types';
import { useGame } from '../state/store';

export function Bar({ value, tone, thin }: { value: number; tone?: 'green' | 'red'; thin?: boolean }) {
  return (
    <div className={`xpbar ${thin ? 'thin' : ''} ${tone ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}

const STATUS_LABEL: Record<LawMeta['status'], { t: string; c: string }> = {
  verified: { t: '現行制度確認済', c: 'ok' },
  'needs-review': { t: '要確認', c: 'warn' },
  outdated: { t: '旧制度（現行と異なる）', c: 'ng' },
};

/** 問題ごとの適用年度・根拠・出典 */
export function LawBadge({ law }: { law: LawMeta }) {
  const st = STATUS_LABEL[law.status];
  return (
    <div className="law">
      <div className="row wrap" style={{ marginBottom: 4 }}>
        <span className={`chip ${st.c}`}>{st.t}</span>
        <span className="chip">法令基準日 {law.basisDate || '未設定'}</span>
      </div>
      <div>根拠：{law.basis}</div>
      <div>出典：{law.source}</div>
      {law.note && <div style={{ color: '#ffe0b3' }}>⚠ {law.note}</div>}
    </div>
  );
}

export function Celebrate({ emoji, title, children, onClose }: { emoji: string; title: string; children?: ReactNode; onClose: () => void }) {
  const colors = ['#f6d36b', '#ffe9a8', '#4fa3ff', '#ff8fb1', '#5fd38d'];
  return (
    <div className="celebrate" onClick={onClose}>
      <div className="sparkles" aria-hidden>
        {Array.from({ length: 40 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 10) * 0.12}s` }} />
        ))}
      </div>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <div className="big">{emoji}</div>
        <h2>{title}</h2>
        <div className="stack">{children}</div>
        <button className="btn block" style={{ marginTop: 14 }} onClick={onClose}>
          つづける
        </button>
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useGame();
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => dismissToast(toasts[0].id), 3200);
    return () => clearTimeout(t);
  }, [toasts, dismissToast]);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)}>
          <b>{t.text}</b>
          {t.sub && <div className="small muted">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function Back({ to, label = '戻る' }: { to: string; label?: string }) {
  return (
    <a href={`#/${to}`} className="btn ghost sm" style={{ marginBottom: 10 }}>
      ← {label}
    </a>
  );
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** 実技の資料（表・図・文書）を書類風に表示 */
export function Exhibits({ items }: { items?: Exhibit[] }) {
  if (!items?.length) return null;
  return (
    <>
      {items.map((ex, i) => (
        <figure key={i} className="exhibit">
          <figcaption>{ex.title}</figcaption>
          {ex.table && (
            <div className="exhibit-scroll">
              <table>
                <tbody>
                  {ex.table.map((row, r) => (
                    <tr key={r}>{row.map((c, k) => (r === 0 ? <th key={k}>{c}</th> : <td key={k}>{c}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ex.lines && <pre className="exhibit-lines">{ex.lines.join('\n')}</pre>}
          {ex.note && <div className="exhibit-note">{ex.note}</div>}
        </figure>
      ))}
    </>
  );
}

/**
 * ファイル保存ができない環境（埋め込み表示など）向けに、内容をテキストで表示してコピーできるようにする。
 * 読み込み側は onImport を渡すと「貼り付けて読み込む」欄になる。
 */
export function TextTransfer({ text, onImport, onClose }: { text?: string; onImport?: (t: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(text ?? '');
  const [note, setNote] = useState('');
  return (
    <div className="panel">
      <label className="field" htmlFor="transfer-text">
        {onImport ? '保存しておいたテキストを貼り付けてください' : 'このテキストをメモ帳などに保存してください'}
        <textarea id="transfer-text" value={value} readOnly={!onImport} onChange={(e) => setValue(e.target.value)} style={{ minHeight: 120, fontSize: 12 }} onFocus={(e) => !onImport && e.currentTarget.select()} />
      </label>
      <div className="row wrap">
        {onImport ? (
          <button className="btn sm" disabled={!value.trim()} onClick={() => onImport(value)}>
            読み込む
          </button>
        ) : (
          <button
            className="btn sm"
            onClick={(e) => {
              const area = (e.currentTarget.closest('.panel') as HTMLElement).querySelector('textarea')!;
              navigator.clipboard?.writeText(value).then(
                () => setNote('コピーしました'),
                () => {
                  area.select();
                  setNote('選択しました。長押し（Ctrl+C）でコピーしてください');
                },
              ) ?? (area.select(), setNote('選択しました。長押し（Ctrl+C）でコピーしてください'));
            }}
          >
            コピー
          </button>
        )}
        <button className="btn ghost sm" onClick={onClose}>
          閉じる
        </button>
        {note && <span className="small muted">{note}</span>}
      </div>
    </div>
  );
}
