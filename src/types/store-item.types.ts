import { Media } from './media.types';

export type StoreCoverType = 'image' | 'video' | 'gif';

interface StoreItemOption {
    title: string;
    is_required: boolean;
    is_single: boolean;
    items: {
        name: string;
    }[];
}

interface StoreItemExtra {
    name: string;
    price: number;
}

interface StoreItemRatings {
    count: number;
    summary: number;
}

export interface StoreItemPhoto {
    id: string;
    store_item_id: string;
    media_id: string;
    position: number;
    created_at: string;
    media?: Media;
}

export interface StoreItem {
    id: string;
    store_id: string;
    category_id: string;
    name: string;
    description?: string;
    price: number;
    options: StoreItemOption[];
    extras: StoreItemExtra[];
    ratings: StoreItemRatings;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Relations
    store_name?: string;
    category_name?: string;
    photos?: StoreItemPhoto[];
}

export interface StoreItemCreateDto {
    store_id: string;
    category_id: string;
    name: string;
    description?: string;
    price: number;
    options?: StoreItemOption[];
    extras?: StoreItemExtra[];
    is_active?: boolean;
    photo_media_ids?: string[];  // Media IDs for photos
}

export interface StoreItemUpdateDto {
    category_id?: string;
    name?: string;
    description?: string;
    price?: number;
    options?: StoreItemOption[];
    extras?: StoreItemExtra[];
    is_active?: boolean;
    photo_media_ids?: string[];  // Media IDs for photos
}

export interface StoreItemQueryParams {
    search?: string;
    store_id?: string;
    category_id?: string;
    is_active?: boolean;
    min_price?: number;
    max_price?: number;
    page?: number;
    limit?: number;
    sort_by?: keyof StoreItem;
    sort_order?: 'asc' | 'desc';
}

export interface StoreItemPhotoCreateDto {
    store_item_id: string;
    media_id: string;
    position?: number;
}

export interface StoreItemPhotoUpdateDto {
    position: number;
} 