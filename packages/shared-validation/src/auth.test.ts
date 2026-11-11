import { describe, expect, it } from 'vitest';
import { loginSchema } from './auth';

describe('loginSchema', () => {
  it('accepts and normalizes a valid username', () => {
    const r = loginSchema.parse({ username: ' Budi.D ', password: 'x' });
    expect(r.username).toBe('budi.d');
  });
  it('rejects short usernames', () => {
    expect(loginSchema.safeParse({ username: 'ab', password: 'x' }).success).toBe(false);
  });
  it('rejects usernames with spaces or symbols', () => {
    expect(loginSchema.safeParse({ username: 'budi santoso', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'budi@x', password: 'x' }).success).toBe(false);
  });
  it('requires a password', () => {
    expect(loginSchema.safeParse({ username: 'budi', password: '' }).success).toBe(false);
  });
});
