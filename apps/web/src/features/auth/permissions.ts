import type { UserRole } from '@sasana/shared-constants';

const is = (...roles: UserRole[]) => (r: UserRole) => roles.includes(r);

/**
 * Izin tampilan (UX). Sumber kebenaran tetap RLS/RPC di database —
 * matriks ini harus selalu sama dengan migration.
 */
export const can = {
  manageCatalog: is('SUPER_OWNER'), // lokasi, item, satuan, packaging
  manageUsers: is('SUPER_OWNER'),
  viewStock: is('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK'),
  inbound: is('SUPER_OWNER', 'ADMIN_GUDANG'),
  shipments: is('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK'),
  adjustStock: is('SUPER_OWNER'),
  manageParties: is('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK'), // Q14, Q15
  // Q10: SO hanya melihat; input oleh pabrik. Void: SO & Owner Pabrik.
  viewProduction: is('SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_PABRIK'),
  createProduction: is('OWNER_PABRIK', 'ADMIN_PABRIK'),
  voidProduction: is('SUPER_OWNER', 'OWNER_PABRIK'),
  // Distribusi: OP dari pabrik, AG dari Gudang Penjualan (Q21). SO lihat & void. AP tidak.
  viewDistribution: is('SUPER_OWNER', 'OWNER_PABRIK', 'ADMIN_GUDANG'),
  createDistribution: is('OWNER_PABRIK', 'ADMIN_GUDANG'),
  viewReports: is('SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK'),
};
