import type { UserRole } from '@sasana/shared-constants';
import {
  BoxesIcon,
  HandshakeIcon,
  LayoutDashboardIcon,
  MapPinIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly UserRole[];
  /** Judul grup di sidebar */
  group?: string;
}

const WEB_ROLES = ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK'] as const;
const SO = ['SUPER_OWNER'] as const;

/**
 * Menu web. Item baru ditambahkan per phase (lihat docs/phase-0 §8).
 * Ini hanya untuk tampilan; otorisasi data tetap di database.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboardIcon, roles: WEB_ROLES },
  { href: '/master/items', label: 'Barang', icon: BoxesIcon, roles: WEB_ROLES, group: 'Master data' },
  { href: '/master/vendors', label: 'Vendor', icon: TruckIcon, roles: WEB_ROLES, group: 'Master data' },
  { href: '/master/buyers', label: 'Buyer', icon: HandshakeIcon, roles: WEB_ROLES, group: 'Master data' },
  { href: '/master/locations', label: 'Lokasi', icon: MapPinIcon, roles: SO, group: 'Master data' },
  { href: '/users', label: 'User', icon: UsersIcon, roles: SO, group: 'Pengaturan' },
  { href: '/profile', label: 'Profil', icon: UserIcon, roles: WEB_ROLES, group: 'Pengaturan' },
];

export function navForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
