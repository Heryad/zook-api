export enum RatingTargetType {
    STORE = 'store',
    ITEM = 'item'
}

export enum RatingStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    REPORTED = 'reported'
}

export interface Rating {
    id: string;
    country_id: string;
    city_id?: string;
    user_id: string;
    target_type: RatingTargetType;
    target_id: string;
    star_count: number;
    description?: string;
    status: RatingStatus;
    report_reason?: string;
    moderated_by?: string;
    moderated_at?: Date;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

// DTOs
export interface RatingCreateDto {
    country_id: string;
    city_id?: string;
    user_id: string;
    target_type: RatingTargetType;
    target_id: string;
    star_count: number;
    description?: string;
}

export interface RatingUpdateDto {
    star_count?: number;
    description?: string;
    is_active?: boolean;
}

export interface RatingModerationDto {
    status: RatingStatus;
    report_reason?: string;
}

// Query Parameters
export interface RatingQueryParams {
    search?: string;          // Search in description
    country_id?: string;
    city_id?: string;
    user_id?: string;
    target_type?: RatingTargetType;
    target_id?: string;
    status?: RatingStatus;
    star_count?: number;
    is_active?: boolean;
    page?: number;
    limit?: number;
    sort_by?: 'star_count' | 'created_at' | 'status';
    sort_order?: 'asc' | 'desc';
}

// Response types
export interface RatingResponse extends Rating {
    user_name?: string;
    country_name?: string;
    city_name?: string;
    moderator_name?: string;
    target_name?: string;     // Store name or item name
}

export interface RatingStats {
    average_rating: number;
    total_ratings: number;
    rating_distribution: {
        [key: number]: number;  // star_count: count
    };
}

export interface PaginatedRatingResponse {
    ratings: RatingResponse[];
    stats?: RatingStats;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
} 