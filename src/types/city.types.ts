export interface Zone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  delivery_price: number;
}

export interface City {
  id: string;
  country_id: string;
  name: string;
  zones: Zone[];
  is_active: boolean;
  created_at: Date;
}

// Zone management DTOs
export interface ZoneCreateDto {
  name: string;
  latitude: number;
  longitude: number;
  delivery_price: number;
}

export interface ZoneUpdateDto {
  name?: string;
  latitude?: number;
  longitude?: number;
  delivery_price?: number;
}

export interface CityCreateDto {
  country_id: string;
  name: string;
  zones?: ZoneCreateDto[];
}

export interface CityUpdateDto {
  name?: string;
  is_active?: boolean;
}

export interface CityQueryParams {
  search?: string;          // Search by name
  country_id?: string;      // Filter by country
  is_active?: boolean;      // Filter by status
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

// Response types
export interface CityResponse extends City {
  country_name: string;
}

export interface PaginatedCityResponse {
  cities: CityResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Zone validation types
export interface ZoneValidationError {
  field: string;
  message: string;
}

export interface ZoneValidation {
  isValid: boolean;
  errors: ZoneValidationError[];
} 