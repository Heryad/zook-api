export enum PromoCodeType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed'
}

export interface PromoCode {
  id: string;
  country_id: string;
  city_id?: string;
  code: string;
  type: PromoCodeType;
  discount_amount: number;
  minimum_order_amount?: number;
  maximum_discount?: number;
  usage_limit?: number;
  used_count: number;
  description?: string;
  start_date?: Date;
  end_date?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PromoCodeCreateDto {
  country_id: string;
  city_id?: string;
  code: string;
  type?: PromoCodeType;
  discount_amount: number;
  minimum_order_amount?: number;
  maximum_discount?: number;
  usage_limit?: number;
  description?: string;
  start_date?: Date;
  end_date?: Date;
  is_active?: boolean;
}

export interface PromoCodeUpdateDto extends Partial<PromoCodeCreateDto> {}

export interface PromoCodeQueryParams {
  search?: string;          // Search by code or description
  country_id?: string;      // Filter by country
  city_id?: string;        // Filter by city
  type?: PromoCodeType;    // Filter by type
  is_active?: boolean;     // Filter by status
  is_expired?: boolean;    // Filter expired codes
  page?: number;
  limit?: number;
  sort_by?: 'code' | 'created_at' | 'start_date' | 'end_date';
  sort_order?: 'asc' | 'desc';
}

// Response types
export interface PromoCodeResponse extends PromoCode {
  country_name: string;
  city_name?: string;
  is_expired: boolean;      // Computed based on end_date
  is_started: boolean;      // Computed based on start_date
  is_limit_reached: boolean; // Computed based on usage_limit and used_count
}

export interface PaginatedPromoCodeResponse {
  promo_codes: PromoCodeResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Validation types
export interface PromoCodeValidationError {
  field: string;
  message: string;
}

export interface PromoCodeValidationResult {
  isValid: boolean;
  errors: PromoCodeValidationError[];
  computedDiscount?: number;  // For percentage discounts
} 