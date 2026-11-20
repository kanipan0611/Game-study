import { useEffect, useSyncExternalStore } from 'react';

// ============================================================
// ルーター：画面の状態はメモリ上に持ち、URLのハッシュには「#dungeon--life」の
// ような英数字とハイフンだけの形で反映する（埋め込み表示先が #/path 形式を
// 受け付けない環境でも動くようにするため）。
// 画面内のリンクは従来どおり href="#/dungeon/life" と書き、クリックを横取りして遷移する。
// ============================================================

type Route = { path: string; nonce: number };
let route: Route = { path: decode(window.location.hash), nonce: 0 };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** #/a/b?browse=1 / #a--b--browse の両方を読める */
function decode(hash: string) {
  const h = hash.replace(/^#\/?/, '');
  if (!h) return '';
  if (h.includes('/') || h.includes('?')) return h;
  const parts = h.split('--');
  if (parts[parts.length - 1] === 'browse') return parts.slice(0, -1).join('/') + '?browse=1';
  return parts.join('/');
}
const encode = (path: string) => path.replace('?browse=1', '/browse').split('/').filter(Boolean).join('--');

export function go(to: string) {
  const path = to.replace(/^#?\/?/, '');
  route = { path, nonce: route.nonce };
  emit();
  window.scrollTo(0, 0);
  try {
    const h = encode(path);
    if (decode(window.location.hash) !== path) window.history.pushState(null, '', h ? `#${h}` : window.location.pathname + window.location.search);
  } catch {
    /* 履歴を操作できない環境ではメモリ上の遷移だけ行う */
  }
}

/** 同じ画面を最初からやり直す（ページの再読み込みは使わない） */
export function restart() {
  route = { path: route.path, nonce: route.nonce + 1 };
  emit();
  window.scrollTo(0, 0);
}

export function useRoute() {
  const r = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => route,
  );
  useEffect(() => {
    // 戻る・進むボタン
    const onPop = () => {
      route = { path: decode(window.location.hash), nonce: route.nonce };
      emit();
    };
    // href="#/..." のリンクを横取り
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement).closest?.('a');
      const href = a?.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      e.preventDefault();
      go(href);
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onPop);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
      document.removeEventListener('click', onClick);
    };
  }, []);
  const [pathname, query = ''] = r.path.split('?');
  return { parts: pathname.split('/').filter(Boolean), query: new URLSearchParams(query), nonce: r.nonce };
}
