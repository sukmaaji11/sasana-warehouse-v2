import { describe, expect, it } from 'vitest';
import { toAppError } from './errors';

describe('toAppError', () => {
  it('maps RPC error codes from the message prefix', () => {
    expect(toAppError({ message: 'INSUFFICIENT_STOCK: item X' }).code).toBe('INSUFFICIENT_STOCK');
    expect(toAppError({ message: 'PROFILE_NOT_FOUND' }).code).toBe('PROFILE_NOT_FOUND');
  });
  it('maps bad credentials', () => {
    expect(toAppError({ code: 'invalid_credentials', message: 'Invalid login credentials' }).code).toBe(
      'INVALID_CREDENTIALS',
    );
  });
  it('maps permission denied', () => {
    expect(toAppError({ code: '42501', message: 'permission denied' }).code).toBe('FORBIDDEN');
  });
  it('maps a hidden/missing single row to NOT_FOUND', () => {
    const e = toAppError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
    expect(e.code).toBe('NOT_FOUND');
    expect(e.message).toMatch(/tidak punya akses/);
  });
  it('maps network failures', () => {
    expect(toAppError(new TypeError('Failed to fetch')).code).toBe('NETWORK');
    expect(toAppError({ name: 'AuthRetryableFetchError', message: '' }).code).toBe('NETWORK');
  });
  it('falls back to UNKNOWN with an Indonesian message', () => {
    const e = toAppError({ message: 'boom' });
    expect(e.code).toBe('UNKNOWN');
    expect(e.message).toMatch(/kesalahan/);
  });
});
