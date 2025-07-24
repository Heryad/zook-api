import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
    TicketCreateDto, 
    TicketUpdateDto,
    TicketQueryParams,
    TicketResponse,
    TicketStats,
    PaginatedTicketResponse,
    TicketStatus,
    TicketPriority,
    TicketCategory
} from '../types/support.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

interface StatsData {
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
    created_at: string;
    resolved_at?: string;
}

interface MessageData {
    ticket_id: string;
    message: string;
    created_at: string;
    sender_type: 'user' | 'admin';
    sender_id: string;
    users?: {
        name: string;
    };
    admins?: {
        username: string;
    };
}

export class SupportTicketController {
    static async getTickets(req: Request, res: Response) {
        try {
            const {
                search,
                country_id,
                city_id,
                user_id,
                assigned_to,
                ticket_number,
                category,
                priority,
                status,
                is_active,
                from_date,
                to_date,
                page = 1,
                limit = 10,
                sort_by = 'created_at',
                sort_order = 'desc'
            } = req.query as unknown as TicketQueryParams;

            let query = supabase
                .from('support_tickets')
                .select(`
                    *,
                    users (
                        name
                    ),
                    countries (
                        name
                    ),
                    cities (
                        name
                    ),
                    assigned_admin:admins (
                        username
                    ),
                    messages:support_messages (
                        count
                    ),
                    unread_messages:support_messages (
                        count
                    )
                `, { count: 'exact' });

            // Apply filters
            if (search) {
                query = query.or(`subject.ilike.%${search}%,description.ilike.%${search}%`);
            }
            if (ticket_number) query = query.eq('ticket_number', ticket_number);
            if (category) query = query.eq('category', category);
            if (priority) query = query.eq('priority', priority);
            if (status) query = query.eq('status', status);
            if (typeof is_active === 'boolean') query = query.eq('is_active', is_active);
            if (from_date) query = query.gte('created_at', from_date);
            if (to_date) query = query.lte('created_at', to_date);
            if (user_id) query = query.eq('user_id', user_id);
            if (assigned_to) query = query.eq('assigned_to', assigned_to);

            // Apply access control based on admin role and location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (req.admin?.country_id) {
                    query = query.eq('country_id', req.admin.country_id);
                }
                if (req.admin?.city_id) {
                    query = query.eq('city_id', req.admin.city_id);
                }
            } else {
                // Super admin can filter by location if requested
                if (country_id) query = query.eq('country_id', country_id);
                if (city_id) query = query.eq('city_id', city_id);
            }

            // Calculate stats if needed
            let stats: TicketStats | undefined;
            if (!ticket_number && !user_id) {  // Only calculate stats for list views
                // Create a new query for stats with the same filters
                const statsQuery = supabase
                    .from('support_tickets')
                    .select('status, priority, category, created_at, resolved_at');

                // Apply the same filters
                if (country_id) statsQuery.eq('country_id', country_id);
                if (city_id) statsQuery.eq('city_id', city_id);
                if (status) statsQuery.eq('status', status);
                if (typeof is_active === 'boolean') statsQuery.eq('is_active', is_active);

                const { data: statsData } = await statsQuery;

                if (statsData) {
                    const typedStatsData = statsData as StatsData[];
                    stats = {
                        total_open: typedStatsData.filter(t => t.status === TicketStatus.OPEN).length,
                        total_in_progress: typedStatsData.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
                        total_resolved: typedStatsData.filter(t => t.status === TicketStatus.RESOLVED).length,
                        total_closed: typedStatsData.filter(t => t.status === TicketStatus.CLOSED).length,
                        total_reopened: typedStatsData.filter(t => t.status === TicketStatus.REOPENED).length,
                        average_resolution_time: typedStatsData
                            .filter(t => t.resolved_at)
                            .reduce((acc, t) => {
                                const resolvedAt = new Date(t.resolved_at!);
                                const createdAt = new Date(t.created_at);
                                return acc + (resolvedAt.getTime() - createdAt.getTime()) / 3600000;  // Convert to hours
                            }, 0) / (typedStatsData.filter(t => t.resolved_at).length || 1),
                        priority_distribution: Object.values(TicketPriority).reduce((acc, priority) => {
                            acc[priority] = typedStatsData.filter(t => t.priority === priority).length;
                            return acc;
                        }, {} as { [key in TicketPriority]: number }),
                        category_distribution: Object.values(TicketCategory).reduce((acc, category) => {
                            acc[category] = typedStatsData.filter(t => t.category === category).length;
                            return acc;
                        }, {} as { [key in TicketCategory]: number })
                    };
                }
            }

            // Apply pagination
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            // Apply sorting
            query = query.range(from, to).order(sort_by, { ascending: sort_order === 'asc' });

            const { data: tickets, error, count } = await query;

            if (error) throw error;

            const totalPages = Math.ceil((count || 0) / limit);

            // Get last message for each ticket
            const ticketIds = tickets?.map(t => t.id) || [];
            const { data: lastMessages } = await supabase
                .from('support_messages')
                .select(`
                    ticket_id,
                    message,
                    created_at,
                    sender_type,
                    sender_id,
                    users (
                        name
                    ),
                    admins (
                        username
                    )
                `)
                .in('ticket_id', ticketIds)
                .order('created_at', { ascending: false });

            // Format response
            const ticketResponses = tickets?.map(ticket => {
                const lastMessage = lastMessages?.find(m => m.ticket_id === ticket.id) as MessageData | undefined;
                return {
                    ...ticket,
                    user_name: ticket.users?.name,
                    country_name: ticket.countries?.name,
                    city_name: ticket.cities?.name,
                    assigned_to_name: ticket.assigned_admin?.username,
                    unread_messages_count: ticket.unread_messages?.[0]?.count || 0,
                    total_messages_count: ticket.messages?.[0]?.count || 0,
                    last_message: lastMessage ? {
                        message: lastMessage.message,
                        sender_name: lastMessage.sender_type === 'user' 
                            ? lastMessage.users?.name 
                            : lastMessage.admins?.username,
                        created_at: lastMessage.created_at
                    } : undefined
                };
            }) || [];

            const response: PaginatedTicketResponse = {
                tickets: ticketResponses,
                stats,
                total: count || 0,
                page,
                limit,
                totalPages
            };

            ResponseHandler.success(res, 200, 'Tickets retrieved successfully', response);
        } catch (error) {
            logger.error('Get tickets error:', error);
            ResponseHandler.error(res, 500, 'Failed to retrieve tickets');
        }
    }

    static async createTicket(req: Request, res: Response) {
        try {
            const ticketData: TicketCreateDto = req.body;

            // Validate location access if admin is creating ticket
            if (req.admin && req.admin.role !== AdminRole.SUPER_ADMIN) {
                if (ticketData.country_id !== req.admin.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot create ticket for different country');
                }
                if (req.admin.city_id && ticketData.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot create ticket for different city');
                }
            }

            const { data: ticket, error } = await supabase
                .from('support_tickets')
                .insert([{
                    ...ticketData,
                    status: TicketStatus.OPEN,
                    is_active: true
                }])
                .select(`
                    *,
                    users (
                        name
                    ),
                    countries (
                        name
                    ),
                    cities (
                        name
                    )
                `)
                .single();

            if (error) throw error;

            const ticketResponse: TicketResponse = {
                ...ticket,
                user_name: ticket.users?.name,
                country_name: ticket.countries?.name,
                city_name: ticket.cities?.name,
                unread_messages_count: 0,
                total_messages_count: 0
            };

            ResponseHandler.success(res, 201, 'Ticket created successfully', ticketResponse);
        } catch (error) {
            logger.error('Create ticket error:', error);
            ResponseHandler.error(res, 500, 'Failed to create ticket');
        }
    }

    static async updateTicket(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updateData: TicketUpdateDto = req.body;

            // Check if ticket exists and get its current data
            const { data: existingTicket, error: fetchError } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !existingTicket) {
                return ResponseHandler.error(res, 404, 'Ticket not found');
            }

            // Validate access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (existingTicket.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot update ticket from different country');
                }
                if (req.admin?.city_id && existingTicket.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot update ticket from different city');
                }
            }

            // Handle status changes
            if (updateData.status) {
                const now = new Date().toISOString();
                if (updateData.status === TicketStatus.RESOLVED) {
                    if (!updateData.resolution_note) {
                        return ResponseHandler.error(res, 400, 'Resolution note required when resolving ticket');
                    }
                    updateData.resolved_at = now;
                }
                if (updateData.status === TicketStatus.CLOSED) {
                    updateData.closed_at = now;
                }
            }

            const { data: ticket, error } = await supabase
                .from('support_tickets')
                .update(updateData)
                .eq('id', id)
                .select(`
                    *,
                    users (
                        name
                    ),
                    countries (
                        name
                    ),
                    cities (
                        name
                    ),
                    assigned_admin:admins (
                        username
                    )
                `)
                .single();

            if (error) throw error;

            // Get message counts
            const { data: messageCounts } = await supabase
                .from('support_messages')
                .select('id, is_read', { count: 'exact' })
                .eq('ticket_id', id);

            const ticketResponse: TicketResponse = {
                ...ticket,
                user_name: ticket.users?.name,
                country_name: ticket.countries?.name,
                city_name: ticket.cities?.name,
                assigned_to_name: ticket.assigned_admin?.username,
                unread_messages_count: messageCounts?.filter(m => !m.is_read).length || 0,
                total_messages_count: messageCounts?.length || 0
            };

            ResponseHandler.success(res, 200, 'Ticket updated successfully', ticketResponse);
        } catch (error) {
            logger.error('Update ticket error:', error);
            ResponseHandler.error(res, 500, 'Failed to update ticket');
        }
    }

    static async deleteTicket(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // Check if ticket exists and get its data
            const { data: ticket, error: fetchError } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !ticket) {
                return ResponseHandler.error(res, 404, 'Ticket not found');
            }

            // Validate delete access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (ticket.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot delete ticket from different country');
                }
                if (req.admin?.city_id && ticket.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot delete ticket from different city');
                }
            }

            const { error } = await supabase
                .from('support_tickets')
                .delete()
                .eq('id', id);

            if (error) throw error;

            ResponseHandler.success(res, 200, 'Ticket deleted successfully', null);
        } catch (error) {
            logger.error('Delete ticket error:', error);
            ResponseHandler.error(res, 500, 'Failed to delete ticket');
        }
    }
} 