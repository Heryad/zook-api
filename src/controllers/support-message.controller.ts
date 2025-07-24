import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
    MessageCreateDto,
    MessageUpdateDto,
    MessageQueryParams,
    MessageResponse,
    PaginatedMessageResponse
} from '../types/support.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class SupportMessageController {
    static async getMessages(req: Request, res: Response) {
        try {
            const {
                ticket_id,
                sender_type,
                sender_id,
                is_internal,
                is_read,
                from_date,
                to_date,
                page = 1,
                limit = 50  // Higher limit for chat messages
            } = req.query as unknown as MessageQueryParams;

            // First check ticket access
            const { data: ticket } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id', ticket_id)
                .single();

            if (!ticket) {
                return ResponseHandler.error(res, 404, 'Ticket not found');
            }

            // Validate access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (ticket.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot access messages from different country');
                }
                if (req.admin?.city_id && ticket.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot access messages from different city');
                }
            }

            let query = supabase
                .from('support_messages')
                .select(`
                    *,
                    users (
                        name
                    ),
                    admins (
                        username
                    )
                `, { count: 'exact' })
                .eq('ticket_id', ticket_id);

            // Apply filters
            if (sender_type) query = query.eq('sender_type', sender_type);
            if (sender_id) query = query.eq('sender_id', sender_id);
            if (typeof is_internal === 'boolean') query = query.eq('is_internal', is_internal);
            if (typeof is_read === 'boolean') query = query.eq('is_read', is_read);
            if (from_date) query = query.gte('created_at', from_date);
            if (to_date) query = query.lte('created_at', to_date);

            // Hide internal messages from non-admins
            if (!req.admin) {
                query = query.eq('is_internal', false);
            }

            // Apply pagination
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            // Apply sorting (newest first for initial load, then oldest first for pagination)
            query = query.range(from, to).order('created_at', { ascending: page === 1 ? false : true });

            const { data: messages, error, count } = await query;

            if (error) throw error;

            const totalPages = Math.ceil((count || 0) / limit);

            // Format response
            const messageResponses = messages?.map(message => ({
                ...message,
                sender_name: message.sender_type === 'user' 
                    ? message.users?.name 
                    : message.admins?.username,
                ticket_number: ticket.ticket_number
            })) || [];

            const response: PaginatedMessageResponse = {
                messages: messageResponses,
                total: count || 0,
                page,
                limit,
                totalPages
            };

            ResponseHandler.success(res, 200, 'Messages retrieved successfully', response);
        } catch (error) {
            logger.error('Get messages error:', error);
            ResponseHandler.error(res, 500, 'Failed to retrieve messages');
        }
    }

    static async createMessage(req: Request, res: Response) {
        try {
            const messageData: MessageCreateDto = req.body;

            // Check ticket access
            const { data: ticket } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id', messageData.ticket_id)
                .single();

            if (!ticket) {
                return ResponseHandler.error(res, 404, 'Ticket not found');
            }

            // Validate access based on location for admins
            if (messageData.sender_type === 'admin') {
                if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                    if (ticket.country_id !== req.admin?.country_id) {
                        return ResponseHandler.error(res, 403, 'Cannot create message for different country');
                    }
                    if (req.admin?.city_id && ticket.city_id !== req.admin.city_id) {
                        return ResponseHandler.error(res, 403, 'Cannot create message for different city');
                    }
                }
            }

            // Only admins can create internal messages
            if (messageData.is_internal && messageData.sender_type !== 'admin') {
                return ResponseHandler.error(res, 403, 'Only admins can create internal messages');
            }

            const { data: message, error } = await supabase
                .from('support_messages')
                .insert([{
                    ...messageData,
                    is_read: false
                }])
                .select(`
                    *,
                    users (
                        name
                    ),
                    admins (
                        username
                    )
                `)
                .single();

            if (error) throw error;

            const messageResponse: MessageResponse = {
                ...message,
                sender_name: message.sender_type === 'user' 
                    ? message.users?.name 
                    : message.admins?.username,
                ticket_number: ticket.ticket_number
            };

            ResponseHandler.success(res, 201, 'Message created successfully', messageResponse);
        } catch (error) {
            logger.error('Create message error:', error);
            ResponseHandler.error(res, 500, 'Failed to create message');
        }
    }

    static async updateMessage(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updateData: MessageUpdateDto = req.body;

            // Check if message exists and get its data
            const { data: existingMessage, error: fetchError } = await supabase
                .from('support_messages')
                .select(`
                    *,
                    support_tickets (
                        country_id,
                        city_id,
                        ticket_number
                    )
                `)
                .eq('id', id)
                .single();

            if (fetchError || !existingMessage) {
                return ResponseHandler.error(res, 404, 'Message not found');
            }

            // Validate access based on location for admins
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                const ticket = existingMessage.support_tickets;
                if (ticket.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot update message from different country');
                }
                if (req.admin?.city_id && ticket.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot update message from different city');
                }
            }

            // Handle read status
            if (updateData.is_read) {
                updateData.read_at = new Date().toISOString();
            }

            const { data: message, error } = await supabase
                .from('support_messages')
                .update(updateData)
                .eq('id', id)
                .select(`
                    *,
                    users (
                        name
                    ),
                    admins (
                        username
                    )
                `)
                .single();

            if (error) throw error;

            const messageResponse: MessageResponse = {
                ...message,
                sender_name: message.sender_type === 'user' 
                    ? message.users?.name 
                    : message.admins?.username,
                ticket_number: existingMessage.support_tickets.ticket_number
            };

            ResponseHandler.success(res, 200, 'Message updated successfully', messageResponse);
        } catch (error) {
            logger.error('Update message error:', error);
            ResponseHandler.error(res, 500, 'Failed to update message');
        }
    }

    static async deleteMessage(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // Check if message exists and get its data
            const { data: message, error: fetchError } = await supabase
                .from('support_messages')
                .select(`
                    *,
                    support_tickets (
                        country_id,
                        city_id
                    )
                `)
                .eq('id', id)
                .single();

            if (fetchError || !message) {
                return ResponseHandler.error(res, 404, 'Message not found');
            }

            // Only admins can delete messages
            if (!req.admin) {
                return ResponseHandler.error(res, 403, 'Only admins can delete messages');
            }

            // Validate delete access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                const ticket = message.support_tickets;
                if (ticket.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot delete message from different country');
                }
                if (req.admin?.city_id && ticket.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot delete message from different city');
                }
            }

            const { error } = await supabase
                .from('support_messages')
                .delete()
                .eq('id', id);

            if (error) throw error;

            ResponseHandler.success(res, 200, 'Message deleted successfully', null);
        } catch (error) {
            logger.error('Delete message error:', error);
            ResponseHandler.error(res, 500, 'Failed to delete message');
        }
    }

    static async markAsRead(req: Request, res: Response) {
        try {
            const { ticket_id } = req.params;

            // Check ticket access
            const { data: ticket } = await supabase
                .from('support_tickets')
                .select('*')
                .eq('id', ticket_id)
                .single();

            if (!ticket) {
                return ResponseHandler.error(res, 404, 'Ticket not found');
            }

            // Validate access based on location for admins
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (ticket.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot access messages from different country');
                }
                if (req.admin?.city_id && ticket.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot access messages from different city');
                }
            }

            // Mark all unread messages as read
            const now = new Date().toISOString();
            const { error } = await supabase
                .from('support_messages')
                .update({ 
                    is_read: true,
                    read_at: now
                })
                .eq('ticket_id', ticket_id)
                .eq('is_read', false);

            if (error) throw error;

            ResponseHandler.success(res, 200, 'Messages marked as read successfully', null);
        } catch (error) {
            logger.error('Mark as read error:', error);
            ResponseHandler.error(res, 500, 'Failed to mark messages as read');
        }
    }
} 