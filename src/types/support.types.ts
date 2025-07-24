export enum TicketStatus {
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    RESOLVED = 'resolved',
    CLOSED = 'closed',
    REOPENED = 'reopened'
}

export enum TicketPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    URGENT = 'urgent'
}

export enum TicketCategory {
    GENERAL = 'general',
    TECHNICAL = 'technical',
    BILLING = 'billing',
    FEATURE_REQUEST = 'feature_request',
    COMPLAINT = 'complaint'
}

export interface SupportTicket {
    id: string;
    country_id: string;
    city_id?: string;
    user_id: string;
    assigned_to?: string;
    ticket_number: string;
    subject: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    resolution_note?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    resolved_at?: Date;
    closed_at?: Date;
}

export interface SupportMessage {
    id: string;
    ticket_id: string;
    sender_type: 'user' | 'admin';
    sender_id: string;
    message: string;
    attachments?: {
        name: string;
        url: string;
        type: string;
        size: number;
    }[];
    is_internal: boolean;
    is_read: boolean;
    read_at?: Date;
    created_at: Date;
    updated_at: Date;
}

// DTOs
export interface TicketCreateDto {
    country_id: string;
    city_id?: string;
    user_id: string;
    subject: string;
    description: string;
    category?: TicketCategory;
    priority?: TicketPriority;
}

export interface TicketUpdateDto {
    subject?: string;
    description?: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    status?: TicketStatus;
    resolution_note?: string;
    assigned_to?: string;
    is_active?: boolean;
    resolved_at?: string;
    closed_at?: string;
}

export interface MessageCreateDto {
    ticket_id: string;
    sender_type: 'user' | 'admin';
    sender_id: string;
    message: string;
    attachments?: {
        name: string;
        url: string;
        type: string;
        size: number;
    }[];
    is_internal?: boolean;
}

export interface MessageUpdateDto {
    message?: string;
    is_read?: boolean;
    read_at?: string;
}

// Query Parameters
export interface TicketQueryParams {
    search?: string;          // Search in subject or description
    country_id?: string;
    city_id?: string;
    user_id?: string;
    assigned_to?: string;
    ticket_number?: string;
    category?: TicketCategory;
    priority?: TicketPriority;
    status?: TicketStatus;
    is_active?: boolean;
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
    sort_by?: 'created_at' | 'updated_at' | 'priority' | 'status';
    sort_order?: 'asc' | 'desc';
}

export interface MessageQueryParams {
    ticket_id: string;
    sender_type?: 'user' | 'admin';
    sender_id?: string;
    is_internal?: boolean;
    is_read?: boolean;
    from_date?: string;
    to_date?: string;
    page?: number;
    limit?: number;
}

// Response types
export interface TicketResponse extends SupportTicket {
    user_name?: string;
    country_name?: string;
    city_name?: string;
    assigned_to_name?: string;
    unread_messages_count: number;
    total_messages_count: number;
    last_message?: {
        message: string;
        sender_name: string;
        created_at: Date;
    };
}

export interface MessageResponse extends SupportMessage {
    sender_name: string;
    ticket_number: string;
}

export interface TicketStats {
    total_open: number;
    total_in_progress: number;
    total_resolved: number;
    total_closed: number;
    total_reopened: number;
    average_resolution_time: number;  // in hours
    priority_distribution: {
        [key in TicketPriority]: number;
    };
    category_distribution: {
        [key in TicketCategory]: number;
    };
}

export interface PaginatedTicketResponse {
    tickets: TicketResponse[];
    stats?: TicketStats;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface PaginatedMessageResponse {
    messages: MessageResponse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
} 