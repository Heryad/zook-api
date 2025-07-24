export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  FINANCE = 'finance',
  SUPPORT = 'support',
  OPERATOR = 'operator'
}

export interface Admin {
  id: string;
  username: string;
  password: string;
  email?: string;
  role: AdminRole;
  country_id?: string;
  city_id?: string;
  full_name?: string;
  phone_number?: string;
  photo_media_id?: string;
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// DTOs
export interface AdminLoginDto {
  username: string;
  password: string;
}

export interface AdminCreateDto {
  username: string;
  password: string;
  email?: string;
  role: AdminRole;
  country_id?: string;
  city_id?: string;
  full_name?: string;
  phone_number?: string;
  photo_media_id?: string;
}

export interface AdminUpdateDto {
  username?: string;
  password?: string;
  email?: string;
  role?: AdminRole;
  country_id?: string;
  city_id?: string;
  full_name?: string;
  phone_number?: string;
  photo_media_id?: string;
  is_active?: boolean;
}

// Query Parameters
export interface AdminQueryParams {
  search?: string;          // Search by username, email, or full_name
  role?: AdminRole;
  country_id?: string;
  city_id?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'username' | 'role' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

// Response types (without sensitive data)
export interface AdminResponse {
  id: string;
  username: string;
  email?: string;
  role: AdminRole;
  country_id?: string;
  country_name?: string;
  city_id?: string;
  city_name?: string;
  full_name?: string;
  phone_number?: string;
  photo_media_id?: string;
  photo_url?: string; // Keep this for backward compatibility, will be populated from media table
  is_active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface AdminAuthResponse {
  admin: AdminResponse;
  token: string;
}

export interface PaginatedAdminResponse {
  admins: AdminResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 