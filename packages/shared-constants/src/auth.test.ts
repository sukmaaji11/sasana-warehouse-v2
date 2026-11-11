import { describe, expect, it } from 'vitest';
import { normalizeUsername, usernameToAuthEmail } from './auth';

describe('username → auth email', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeUsername('  Budi.Driver ')).toBe('budi.driver');
  });
  it('maps to the internal domain', () => {
    expect(usernameToAuthEmail('Budi')).toBe('budi@users.sasana.internal');
  });
});
