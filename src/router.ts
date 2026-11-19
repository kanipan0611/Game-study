import { useEffect, useState } from 'react';

// ハッシュルーター（#/dungeon/life など）。静的ホスティングでもリロードで迷子にならない。
export function useRoute() {
  const get = () => window.location.hash.replace(/^#\/?/, '');
  const [path, setPath] = useState(get);
  useEffect(() => {
    const on = () => {
      setPath(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const [pathname, query = ''] = path.split('?');
  return { parts: pathname.split('/').filter(Boolean), query: new URLSearchParams(query) };
}

export const go = (to: string) => {
  window.location.hash = '/' + to.replace(/^\//, '');
};
export const back = () => window.history.back();
