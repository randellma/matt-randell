import { useEffect, useState } from 'preact/hooks';
import { DivvyApi } from './api';
import { Home } from './views/Home';
import { Group } from './views/Group';
import { DialogProvider } from './components/ConfirmDialog';

const API_URL =
  (import.meta.env.VITE_POCKETBASE_URL as string) ??
  (import.meta.env.DEV ? 'http://127.0.0.1:8090' : 'https://divvy-api.mattrandell.com');

export const api = new DivvyApi(API_URL);

export function navigate(path: string): void {
  location.hash = path;
}

// Share links use a real path (/g/:id/:t — or just /g/:id for PIN-gated
// groups, whose links don't carry the token) so the server can inject a link
// preview for that group (see functions/g/[[route]].js); the app itself lives
// on hash routes. Normalize before mounting — also covers the offline case
// where the service worker answers a path navigation with the cached shell.
{
  const m = location.pathname.match(/^\/g\/([^/]+)(?:\/([^/]+))?/);
  if (m && !location.hash) {
    history.replaceState(null, '', m[2] ? `/#/g/${m[1]}/${m[2]}` : `/#/g/${m[1]}`);
  }
}

/** With an empty token the route is token-less — PIN-gated groups live there
 * so the credential never sits in the address bar. */
export function groupPath(id: string, t: string, sub = ''): string {
  return t ? `#/g/${id}/${t}${sub}` : `#/g/${id}${sub}`;
}

/** Tokens are long lowercase hex (newToken); route words like "settings",
 * "new", or an expense id never match, so the two URL forms can't collide. */
const TOKEN_RE = /^[a-f0-9]{20,}$/;

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

  let content;
  if (parts[0] === 'g' && parts[1]) {
    const hasToken = parts[2] !== undefined && TOKEN_RE.test(parts[2]);
    content = (
      <Group
        key={parts[1]}
        groupId={parts[1]}
        token={hasToken ? parts[2] : undefined}
        sub={parts.slice(hasToken ? 3 : 2)}
      />
    );
  } else {
    content = <Home />;
  }
  return <DialogProvider>{content}</DialogProvider>;
}
