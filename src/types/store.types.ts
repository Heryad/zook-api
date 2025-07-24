import { Media } from './media.types';

export type StoreCoverType = 'image' | 'video' | 'gif';

interface StoreLocation {
    latitude: number;
    longitude: number;
    street_name: string;
}

interface StoreOperatingHours {
    day: number;
    open: string;
    close: string;
    is_closed: boolean;
}

interface StoreAuthDetails {
    username: string;
    password_hash: string;
}

interface StoreRatings {
    count: number;
    summary: number;
}

export interface Store {
    id: string;
    country_id: string;
    city_id?: string;
    category_id: string;
    logo_media_id?: string;
    cover_media_id?: string;
    name: string;
    slug: string;
    description?: string;
    tags: string[];
    cover_type: StoreCoverType;
    operating_hours: StoreOperatingHours[];
    location: StoreLocation;
    preparation_time_minutes: number;
    special_delivery_fee?: number;
    special_discount_percentage?: number;
    is_sponsored: boolean;
    auth_details: StoreAuthDetails;
    ratings: StoreRatings;
    is_active: boolean;
    is_busy: boolean;
    created_at: string;
    updated_at: string;
}

export interface StoreWithMedia extends Omit<Store, 'logo_media_id' | 'cover_media_id'> {
    logo?: Media;
    cover?: Media;
}

export interface StoreCreateDto {
    country_id: string;
    city_id?: string;
    category_id: string;
    logo_media_id?: string;
    cover_media_id?: string;
    name: string;
    description?: string;
    tags?: string[];
    cover_type: StoreCoverType;
    operating_hours: StoreOperatingHours[];
    location: StoreLocation;
    preparation_time_minutes?: number;
    special_delivery_fee?: number;
    special_discount_percentage?: number;
    is_sponsored?: boolean;
    auth_details: {
        username: string;
        password: string;  // Plain password, will be hashed
    };
}

export interface StoreUpdateDto {
    category_id?: string;
    logo_media_id?: string;
    cover_media_id?: string;
    name?: string;
    description?: string;
    tags?: string[];
    cover_type?: StoreCoverType;
    operating_hours?: StoreOperatingHours[];
    location?: StoreLocation;
    preparation_time_minutes?: number;
    special_delivery_fee?: number;
    special_discount_percentage?: number;
    is_sponsored?: boolean;
    is_active?: boolean;
    is_busy?: boolean;
    auth_details?: {
        username?: string;
        password?: string;  // Plain password, will be hashed
    };
}

export interface StoreFilters {
    search?: string;
    country_id?: string;
    city_id?: string;
    category_id?: string;
    is_sponsored?: boolean;
    is_active?: boolean;
    is_busy?: boolean;
    tags?: string[];
    page?: number;
    limit?: number;
    sort_by?: keyof Store;
    sort_order?: 'asc' | 'desc';
} 