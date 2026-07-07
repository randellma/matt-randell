import { useEffect, useState } from 'preact/hooks';
import { DivvyApi } from './api';
import { Home } from './views/Home';
import { Group } from './views/Group';

const API_URL =
  (import.meta.env.VITE_POCKETBASE_URL as string) ??
  (import.meta.env.DEV ? 'http://127.0.0.1:8090' : 'https://divvy-api.mattrandell.com');

export const api = new DivvyApi(API_URL);

export function navigate(path: string): void {
  location.hash = path;
}

// Share links use a real path (/g/:id/:t) so the server can inject a link
// preview for that group (see functions/g/[[route]].js); the app itself lives
// on hash routes. Normalize before mounting — also covers the offline case
// where the service worker answers a path navigation with the cached shell.
{
  const m = location.pathname.match(/^\/g\/([^/]+)\/([^/]+)/);
  if (m && !location.hash) history.replaceState(null, '', `/#/g/${m[1]}/${m[2]}`);
}

export function groupPath(id: string, t: string, sub = ''): string {
  return `#/g/${id}/${t}${sub}`;
}

function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function App() {
  const hash = useHash();
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  if (parts[0] === 'g' && parts[1] && parts[2]) {
    return <Group key={parts[1]} groupId={parts[1]} token={parts[2]} sub={parts.slice(3)} />;
  }
  return <Home />;
}
