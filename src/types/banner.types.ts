
export interface Banner {
  id: string;
  country_id: string;
  city_id?: string;
  store_id?: string;
  name: string;
  description?: string;
  media_id: string;
  is_promotion: boolean;
  start_date?: Date;
  end_date?: Date;
  position: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BannerCreateDto {
  country_id: string;
  city_id?: string;
  store_id?: string;
  name: string;
  description?: string;
  media_id: string;
  is_promotion?: boolean;
  start_date?: Date;
  end_date?: Date;
  position?: number;
  is_active?: boolean;
}

export interface BannerUpdateDto {
  name?: string;
  description?: string;
  media_id?: string;
  store_id?: string | null;  // null to remove store reference
  is_promotion?: boolean;
  start_date?: Date | null;  // null to remove date
  end_date?: Date | null;    // null to remove date
  position?: number;
  is_active?: boolean;
}

export interface BannerQueryParams {
  search?: string;          // Search in name and description
  country_id?: string;      // Filter by country
  city_id?: string;        // Filter by city
  store_id?: string;       // Filter by store
  is_promotion?: boolean;  // Filter by promotion status
  is_active?: boolean;     // Filter by active status
  include_expired?: boolean; // Include banners with past end_date
  page?: number;
  limit?: number;
  sort_by?: 'position' | 'name' | 'created_at' | 'start_date';
  sort_order?: 'asc' | 'desc';
}

// Response types
export interface BannerResponse extends Banner {
  country_name: string;
  city_name?: string;
  store_name?: string;
  media: {
    url: string;
    thumbnail_url?: string;
    type: 'image' | 'gif';
  };
  is_expired?: boolean;  // Computed field for banners with end_date in the past
}

export interface PaginatedBannerResponse {
  banners: BannerResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 