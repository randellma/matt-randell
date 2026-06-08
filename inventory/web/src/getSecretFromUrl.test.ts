import { describe, it, expect } from 'vitest';
import { getSecretFromUrl } from './getSecretFromUrl';

describe('getSecretFromUrl', () => {
  it('returns the secret when ?secret= is present', () => {
    expect(getSecretFromUrl('?secret=abc123')).toBe('abc123');
  });

  it('returns null when search is empty', () => {
    expect(getSecretFromUrl('')).toBeNull();
  });

  it('returns null when secret param is absent', () => {
    expect(getSecretFromUrl('?other=foo')).toBeNull();
  });

  it('returns the secret when mixed with other params', () => {
    expect(getSecretFromUrl('?other=foo&secret=xyz')).toBe('xyz');
  });
});
