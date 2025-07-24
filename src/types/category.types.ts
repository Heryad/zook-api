export interface Category {
  id: string;
  country_id: string;
  city_id?: string;
  name: string;
  description?: string;
  media_id?: string;
  position: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryCreateDto {
  country_id: string;
  city_id?: string;
  name: string;
  description?: string;
  media_id?: string;
  position?: number;
  is_active?: boolean;
}

export interface CategoryUpdateDto {
  name?: string;
  description?: string;
  media_id?: string | null;  // null to remove media
  position?: number;
  is_active?: boolean;
}

export interface CategoryQueryParams {
  search?: string;          // Search in name and description
  country_id?: string;      // Filter by country
  city_id?: string;        // Filter by city
  is_active?: boolean;     // Filter by status
  page?: number;
  limit?: number;
  sort_by?: 'position' | 'name' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

// Response types
export interface CategoryResponse extends Category {
  country_name: string;
  city_name?: string;
  media?: {
    url: string;
    thumbnail_url?: string;
    type: 'image' | 'gif';
  };
}

export interface PaginatedCategoryResponse {
  categories: CategoryResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 