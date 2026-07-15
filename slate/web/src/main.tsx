import { render } from 'preact';
import { App } from './app';
import { adoptMigratedGroups, redirectLegacyOrigin } from './migrate';
import './styles.css';

// Origin migration (slate.mattrandell.com → heyslate.app): the legacy origin
// hands its localStorage groups off via the fragment and must not mount.
if (!redirectLegacyOrigin()) {
  adoptMigratedGroups();
  render(<App />, document.getElementById('app')!);
}
