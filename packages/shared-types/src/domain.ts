import type { LocationType, UserRole } from '@sasana/shared-constants';

export interface LocationSummary {
  id: string;
  code: string;
  name: string;
  type: LocationType;
}

/** Hasil RPC `get_my_context()` */
export interface MyContext {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  locations: LocationSummary[];
}
