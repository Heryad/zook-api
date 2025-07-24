
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  GIF = 'gif'  // Added GIF type
}

export enum MediaPurpose {
  STORE_LOGO = 'store_logo',
  STORE_COVER = 'store_cover',
  PRODUCT_IMAGE = 'product_image',
  STORE_ITEM = 'store_item',  // Added store item type
  CATEGORY_IMAGE = 'category_image',
  BANNER = 'banner',
  PROFILE_PHOTO = 'profile_photo',
  OTHER = 'other'
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;     // For videos (in seconds)
  size_in_bytes: number;
  mime_type: string;
}

export interface Media {
  id: string;
  country_id: string;
  city_id?: string;
  
  // File details
  file_name: string;
  original_name: string;
  type: MediaType;
  mime_type: string;
  purpose: MediaPurpose;
  url: string;
  thumbnail_url?: string;
  
  // File metadata
  size_in_bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  
  // Organization
  folder_path: string;
  alt_text?: string;
  title?: string;
  description?: string;
  
  // Status and tracking
  uploaded_by: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MediaUploadDto {
  country_id: string;
  city_id?: string;
  purpose: MediaPurpose;
  alt_text?: string;
  title?: string;
  description?: string;
  file: Express.Multer.File;  // Updated type reference
}

export interface MediaUpdateDto {
  purpose?: MediaPurpose;
  alt_text?: string;
  title?: string;
  description?: string;
  is_active?: boolean;
}

export interface MediaQueryParams {
  search?: string;          // Search by title, description, or filename
  country_id?: string;      // Filter by country
  city_id?: string;        // Filter by city
  type?: MediaType;        // Filter by type
  purpose?: MediaPurpose;  // Filter by purpose
  uploaded_by?: string;    // Filter by uploader
  is_active?: boolean;     // Filter by status
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'size_in_bytes' | 'title';
  sort_order?: 'asc' | 'desc';
}

// Response types
export interface MediaResponse extends Media {
  country_name: string;
  city_name?: string;
  uploaded_by_name: string;
  file_size_formatted: string;  // Human readable size
}

export interface PaginatedMediaResponse {
  media: MediaResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Upload validation
export interface MediaValidationError {
  field: string;
  message: string;
}

export interface MediaValidationResult {
  isValid: boolean;
  errors: MediaValidationError[];
  metadata?: MediaMetadata;
}

// Supported formats
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
export const SUPPORTED_VIDEO_TYPES = ['video/mp4'];
export const SUPPORTED_GIF_TYPES = ['image/gif'];  // Added GIF support
export const MAX_FILE_SIZE = {
  image: 5 * 1024 * 1024,    // 5MB
  video: 100 * 1024 * 1024,  // 100MB
  gif: 10 * 1024 * 1024      // 10MB for GIFs
}; 