import type { UserRole } from '@sasana/shared-constants';

/**
 * Izin tampilan (UX). Sumber kebenaran tetap RLS/RPC di database —
 * matriks ini harus selalu sama dengan migration.
 */
export const can = {
  manageCatalog: (r: UserRole) => r === 'SUPER_OWNER', // lokasi, item, satuan, packaging
  manageUsers: (r: UserRole) => r === 'SUPER_OWNER',
  viewStock: (r: UserRole) => r === 'SUPER_OWNER' || r === 'ADMIN_GUDANG' || r === 'OWNER_PABRIK',
  inbound: (r: UserRole) => r === 'SUPER_OWNER' || r === 'ADMIN_GUDANG',
  adjustStock: (r: UserRole) => r === 'SUPER_OWNER',
  manageParties: (r: UserRole) => r === 'SUPER_OWNER' || r === 'ADMIN_GUDANG' || r === 'OWNER_PABRIK', // Q14, Q15
};
