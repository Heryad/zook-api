export enum DeliveryFeeType {
  ZONE = 'zone',
  FIXED = 'fixed',
  DISTANCE = 'distance'
}

export interface Country {
  id: string;
  name: string;
  code: string;              // ISO country code
  phone_code: string;        // International dialing code
  currency_code: string;     // ISO currency code
  currency_symbol: string;   // Currency symbol
  timezone: string;         // Default timezone
  language: string;         // Primary language code
  
  // Franchise settings
  has_delivery: boolean;
  has_pickup: boolean;
  min_order_amount: number;
  default_delivery_fee: number;
  fee_type: 'fixed' | 'percentage';
  
  // App settings
  share_text: string;       // Default sharing message
  support_phone: string;
  support_email: string;
  social_media: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CountryCreateDto {
  name: string;
  code: string;
  phone_code: string;
  currency_code: string;
  currency_symbol: string;
  timezone: string;
  language: string;
  
  has_delivery?: boolean;
  has_pickup?: boolean;
  min_order_amount?: number;
  default_delivery_fee?: number;
  fee_type?: 'fixed' | 'percentage';
  
  share_text?: string;
  support_phone?: string;
  support_email?: string;
  social_media?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
}

export interface CountryUpdateDto {
  name?: string;
  phone_code?: string;
  currency_code?: string;
  currency_symbol?: string;
  timezone?: string;
  language?: string;
  
  has_delivery?: boolean;
  has_pickup?: boolean;
  min_order_amount?: number;
  default_delivery_fee?: number;
  fee_type?: 'fixed' | 'percentage';
  
  share_text?: string;
  support_phone?: string;
  support_email?: string;
  social_media?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  
  is_active?: boolean;
}

export interface CountryQueryParams {
  search?: string;          // Search by name or code
  is_active?: boolean;      // Filter by status
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

export interface CountryResponse extends Country {
  total_cities?: number;
  total_admins?: number;
  total_users?: number;
}

export interface PaginatedCountryResponse {
  countries: CountryResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 