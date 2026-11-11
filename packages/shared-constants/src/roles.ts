export const USER_ROLES = ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'DRIVER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_OWNER: 'Super Owner',
  ADMIN_GUDANG: 'Admin Gudang',
  OWNER_PABRIK: 'Owner Pabrik',
  DRIVER: 'Driver',
};
