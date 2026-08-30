export type UserRole = 'admin' | 'student';

export type UserStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'rejected';

export interface AppUser {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string;
  student_code: string | null;
  status: UserStatus;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}