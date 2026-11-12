export const USER_ROLES = ['SUPER_OWNER', 'ADMIN_GUDANG', 'OWNER_PABRIK', 'ADMIN_PABRIK', 'DRIVER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_OWNER: 'Super Owner',
  ADMIN_GUDANG: 'Admin Gudang',
  OWNER_PABRIK: 'Owner Pabrik',
  ADMIN_PABRIK: 'Admin Pabrik',
  DRIVER: 'Driver',
};

/** Role yang bekerja di pabrik (dashboard & tab pabrik). */
export const FACTORY_ROLES = ['OWNER_PABRIK', 'ADMIN_PABRIK'] as const satisfies readonly UserRole[];
