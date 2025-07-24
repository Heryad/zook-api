export interface StoreItemCategory {
    id: string;
    store_id: string;
    name: string;
    slug: string;
    position: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

// DTOs
export interface StoreItemCategoryCreateDto {
    store_id: string;
    name: string;
    position?: number;
    is_active?: boolean;
}

export interface StoreItemCategoryUpdateDto {
    name?: string;
    position?: number;
    is_active?: boolean;
    slug?: string;  // Added for internal use
}

// Query Parameters
export interface StoreItemCategoryQueryParams {
    search?: string;          // Search in name
    store_id: string;        // Required - categories are store-specific
    is_active?: boolean;     // Filter by active status
    page?: number;           // Default: 1
    limit?: number;          // Default: 50 (higher limit for menu categories)
    sort_by?: 'name' | 'position' | 'created_at';
    sort_order?: 'asc' | 'desc';
}

// Response types
export interface StoreItemCategoryResponse extends StoreItemCategory {
    store_name?: string;
    items_count?: number;    // Number of items in this category
}

export interface PaginatedStoreItemCategoryResponse {
    categories: StoreItemCategoryResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
} 