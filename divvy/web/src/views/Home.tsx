import { useState } from 'preact/hooks';
import { api, groupPath, navigate } from '../app';
import { listJoinedGroups, newToken, rememberGroup } from '../identity';

export function Home() {
  const [creating, setCreating] = useState(false);
  const groups = listJoinedGroups();

  return (
    <div class="page">
      <header class="app-header">
        <h1>Divvy</h1>
        <p class="tagline">Split expenses without the fuss</p>
      </header>

      {groups.length > 0 && (
        <section class="card">
          <h2>Your groups</h2>
          <ul class="group-list">
            {groups.map(g => (
              <li key={g.id}>
                <button class="group-row" onClick={() => navigate(groupPath(g.id, g.t))}>
                  <span class="group-name">{g.name}</span>
                  <span class="chevron">›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating ? (
        <CreateGroup onCancel={() => setCreating(false)} />
      ) : (
        <button class="btn primary big" onClick={() => setCreating(true)}>
          + New group
        </button>
      )}

      {groups.length === 0 && !creating && (
        <p class="hint">
          Create a group and share its link — no accounts, no sign-ups. Anyone
          with the link is in.
        </p>
      )}
    </div>
  );
}

function CreateGroup({ onCancel }: { onCancel: () => void }) {
  const [name, setName] = useState('');
  const [membersText, setMembersText] = useState('');
  const [myName, setMyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const memberNames = [
    ...new Set(
      membersText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
    ),
  ];

  async function create() {
    if (!name.trim()) return setError('Give the group a name');
    if (memberNames.length === 0) return setError('Add at least one member (you!)');
    if (!myName) return setError('Pick which member is you');
    setBusy(true);
    setError('');
    try {
      const token = newToken();
      const group = await api.createGroup(name.trim(), token);
      let myId: string | undefined;
      for (const n of memberNames) {
        const m = await api.addMember(group.id, n, token);
        if (n === myName) myId = m.id;
      }
      rememberGroup({ id: group.id, t: token, name: group.name, memberId: myId });
      navigate(groupPath(group.id, token));
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <section class="card">
      <h2>New group</h2>
      <label class="field">
        <span>Group name</span>
        <input
          value={name}
          onInput={e => setName((e.target as HTMLInputElement).value)}
          placeholder="Beach trip 2026"
        />
      </label>
      <label class="field">
        <span>Members — one per line (you can always add more later)</span>
        <textarea
          rows={4}
          value={membersText}
          onInput={e => setMembersText((e.target as HTMLTextAreaElement).value)}
          placeholder={'Matt\nSarah\nDad'}
        />
      </label>
      {memberNames.length > 0 && (
        <div class="field">
          <span>Which one is you?</span>
          <div class="chip-row">
            {memberNames.map(n => (
              <button
                key={n}
                class={`chip ${myName === n ? 'on' : ''}`}
                onClick={() => setMyName(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p class="error">{error}</p>}
      <div class="btn-row">
        <button class="btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button class="btn primary" onClick={create} disabled={busy}>
          {busy ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </section>
  );
}
