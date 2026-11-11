import type { UserRole } from '@sasana/shared-constants';

/** Halaman awal per role. Folder route ada di src/app/<segment>. */
export const ROLE_HOME = {
  DRIVER: '/driver',
  ADMIN_GUDANG: '/warehouse',
  OWNER_PABRIK: '/factory',
  SUPER_OWNER: '/owner',
} as const satisfies Record<UserRole, string>;
