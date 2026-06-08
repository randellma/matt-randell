import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageSecretStore } from './SecretStore';

describe('LocalStorageSecretStore', () => {
  let store: LocalStorageSecretStore;

  beforeEach(() => {
    localStorage.clear();
    store = new LocalStorageSecretStore();
  });

  it('returns null when no secret is stored', () => {
    expect(store.get()).toBeNull();
  });

  it('returns the stored value', () => {
    localStorage.setItem('inventory-secret', 'abc123');
    expect(store.get()).toBe('abc123');
  });

  it('persists a secret via set()', () => {
    store.set('my-secret');
    expect(localStorage.getItem('inventory-secret')).toBe('my-secret');
  });
});
