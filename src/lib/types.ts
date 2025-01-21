import type { Role } from './types';

export type Role = 'global_admin' | 'organization_admin' | 'team_admin' | 'user';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface UserOrganization {
  user_id: string;
  organization_id: string;
  role: Role;
  created_at: string;
}

export interface UserTeam {
  user_id: string;
  team_id: string;
  role: Role;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  is_global_admin: boolean;
  has_otp_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OTPSetupResponse {
  qr_code: string;
  secret: string;
}