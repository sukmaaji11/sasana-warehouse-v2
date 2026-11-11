/**
 * Login memakai username (Decision Log Q13). Supabase Auth membutuhkan email,
 * jadi username dipetakan ke email sintetis yang tidak pernah dilihat user.
 * TLD `.internal` dicadangkan untuk penggunaan privat, sehingga tidak ada email yang terkirim.
 */
export const AUTH_EMAIL_DOMAIN = 'users.sasana.internal';

export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameToAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}
