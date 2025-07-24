import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
    RatingCreateDto, 
    RatingUpdateDto, 
    RatingModerationDto,
    RatingQueryParams,
    RatingResponse,
    RatingStats,
    PaginatedRatingResponse,
    RatingStatus
} from '../types/rating.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class RatingController {
    static async getRatings(req: Request, res: Response) {
        try {
            const {
                search,
                country_id,
                city_id,
                user_id,
                target_type,
                target_id,
                status,
                star_count,
                is_active,
                page = 1,
                limit = 10,
                sort_by = 'created_at',
                sort_order = 'desc'
            } = req.query as unknown as RatingQueryParams;

            let query = supabase
                .from('ratings')
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
                    admins (
                        username
                    )
                `, { count: 'exact' });

            // Apply filters
            if (search) {
                query = query.ilike('description', `%${search}%`);
            }
            if (star_count) query = query.eq('star_count', star_count);
            if (status) query = query.eq('status', status);
            if (typeof is_active === 'boolean') query = query.eq('is_active', is_active);
            if (target_type) query = query.eq('target_type', target_type);
            if (target_id) query = query.eq('target_id', target_id);
            if (user_id) query = query.eq('user_id', user_id);

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

            // Calculate stats if target is specified
            let stats: RatingStats | undefined;
            if (target_type && target_id) {
                const { data: statsData } = await supabase
                    .from('ratings')
                    .select('star_count')
                    .match({ target_type, target_id, is_active: true })
                    .eq('status', RatingStatus.APPROVED);

                if (statsData) {
                    const total = statsData.length;
                    const sum = statsData.reduce((acc, curr) => acc + curr.star_count, 0);
                    const distribution = statsData.reduce((acc, curr) => {
                        acc[curr.star_count] = (acc[curr.star_count] || 0) + 1;
                        return acc;
                    }, {} as { [key: number]: number });

                    stats = {
                        average_rating: total > 0 ? sum / total : 0,
                        total_ratings: total,
                        rating_distribution: distribution
                    };
                }
            }

            // Apply pagination
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            // Apply sorting
            query = query.range(from, to).order(sort_by, { ascending: sort_order === 'asc' });

            const { data: ratings, error, count } = await query;

            if (error) throw error;

            const totalPages = Math.ceil((count || 0) / limit);

            // Format response
            const ratingResponses = ratings?.map(rating => ({
                ...rating,
                user_name: rating.users?.name,
                country_name: rating.countries?.name,
                city_name: rating.cities?.name,
                moderator_name: rating.admins?.username,
                // Note: target_name would need to be fetched based on target_type
            })) || [];

            const response: PaginatedRatingResponse = {
                ratings: ratingResponses,
                stats,
                total: count || 0,
                page,
                limit,
                totalPages
            };

            ResponseHandler.success(res, 200, 'Ratings retrieved successfully', response);
        } catch (error) {
            logger.error('Get ratings error:', error);
            ResponseHandler.error(res, 500, 'Failed to retrieve ratings');
        }
    }

    static async createRating(req: Request, res: Response) {
        try {
            const ratingData: RatingCreateDto = req.body;

            // Check for existing rating from this user for this target
            const { data: existing } = await supabase
                .from('ratings')
                .select('id')
                .match({
                    user_id: ratingData.user_id,
                    target_type: ratingData.target_type,
                    target_id: ratingData.target_id
                })
                .single();

            if (existing) {
                return ResponseHandler.error(res, 409, 'User has already rated this target');
            }

            // Validate target exists (store or item)
            const targetTable = ratingData.target_type === 'store' ? 'stores' : 'items';
            const { data: target } = await supabase
                .from(targetTable)
                .select('id')
                .eq('id', ratingData.target_id)
                .single();

            if (!target) {
                return ResponseHandler.error(res, 404, `${ratingData.target_type} not found`);
            }

            const { data: rating, error } = await supabase
                .from('ratings')
                .insert([{
                    ...ratingData,
                    status: RatingStatus.PENDING,
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

            const ratingResponse: RatingResponse = {
                ...rating,
                user_name: rating.users?.name,
                country_name: rating.countries?.name,
                city_name: rating.cities?.name
            };

            ResponseHandler.success(res, 201, 'Rating created successfully', ratingResponse);
        } catch (error) {
            logger.error('Create rating error:', error);
            ResponseHandler.error(res, 500, 'Failed to create rating');
        }
    }

    static async updateRating(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updateData: RatingUpdateDto = req.body;

            // Check if rating exists and get its current data
            const { data: existingRating, error: fetchError } = await supabase
                .from('ratings')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !existingRating) {
                return ResponseHandler.error(res, 404, 'Rating not found');
            }

            // Only allow updates if rating is active and not reported/rejected
            if (!existingRating.is_active || 
                existingRating.status === RatingStatus.REPORTED ||
                existingRating.status === RatingStatus.REJECTED) {
                return ResponseHandler.error(res, 400, 'Rating cannot be updated');
            }

            const { data: rating, error } = await supabase
                .from('ratings')
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
                    )
                `)
                .single();

            if (error) throw error;

            const ratingResponse: RatingResponse = {
                ...rating,
                user_name: rating.users?.name,
                country_name: rating.countries?.name,
                city_name: rating.cities?.name
            };

            ResponseHandler.success(res, 200, 'Rating updated successfully', ratingResponse);
        } catch (error) {
            logger.error('Update rating error:', error);
            ResponseHandler.error(res, 500, 'Failed to update rating');
        }
    }

    static async moderateRating(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const moderationData: RatingModerationDto = req.body;

            // Check if rating exists
            const { data: existingRating, error: fetchError } = await supabase
                .from('ratings')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !existingRating) {
                return ResponseHandler.error(res, 404, 'Rating not found');
            }

            // Validate moderation access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (existingRating.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot moderate rating from different country');
                }
                if (req.admin?.city_id && existingRating.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot moderate rating from different city');
                }
            }

            const { data: rating, error } = await supabase
                .from('ratings')
                .update({
                    ...moderationData,
                    moderated_by: req.admin?.id,
                    moderated_at: new Date().toISOString()
                })
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
                    admins (
                        username
                    )
                `)
                .single();

            if (error) throw error;

            const ratingResponse: RatingResponse = {
                ...rating,
                user_name: rating.users?.name,
                country_name: rating.countries?.name,
                city_name: rating.cities?.name,
                moderator_name: rating.admins?.username
            };

            ResponseHandler.success(res, 200, 'Rating moderated successfully', ratingResponse);
        } catch (error) {
            logger.error('Moderate rating error:', error);
            ResponseHandler.error(res, 500, 'Failed to moderate rating');
        }
    }

    static async deleteRating(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // Check if rating exists and get its data
            const { data: rating, error: fetchError } = await supabase
                .from('ratings')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !rating) {
                return ResponseHandler.error(res, 404, 'Rating not found');
            }

            // Validate delete access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (rating.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot delete rating from different country');
                }
                if (req.admin?.city_id && rating.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot delete rating from different city');
                }
            }

            const { error } = await supabase
                .from('ratings')
                .delete()
                .eq('id', id);

            if (error) throw error;

            ResponseHandler.success(res, 200, 'Rating deleted successfully', null);
        } catch (error) {
            logger.error('Delete rating error:', error);
            ResponseHandler.error(res, 500, 'Failed to delete rating');
        }
    }
} 