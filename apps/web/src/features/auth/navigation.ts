import type { UserRole } from '@sasana/shared-constants';
import { LayoutDashboardIcon, UserIcon, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly UserRole[];
}

const WEB_ROLES = ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK'] as const;

/**
 * Menu web. Item baru ditambahkan per phase (lihat docs/phase-0 §8).
 * Ini hanya untuk tampilan; otorisasi data tetap di database.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboardIcon, roles: WEB_ROLES },
  { href: '/profile', label: 'Profil', icon: UserIcon, roles: WEB_ROLES },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
