import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
    StoreItemCategoryCreateDto,
    StoreItemCategoryUpdateDto,
    StoreItemCategoryQueryParams,
    StoreItemCategoryResponse,
    PaginatedStoreItemCategoryResponse
} from '../types/store-item-category.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class StoreItemCategoryController {
    static async getCategories(req: Request, res: Response) {
        try {
            const {
                search,
                store_id,
                is_active,
                page = 1,
                limit = 50,
                sort_by = 'position',
                sort_order = 'asc'
            } = req.query as unknown as StoreItemCategoryQueryParams;

            // First check store access
            const { data: store } = await supabase
                .from('stores')
                .select('*')
                .eq('id', store_id)
                .single();

            if (!store) {
                return ResponseHandler.error(res, 404, 'Store not found');
            }

            // Validate access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (store.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot access store from different country');
                }
                if (req.admin?.city_id && store.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot access store from different city');
                }
            }

            let query = supabase
                .from('store_item_categories')
                .select(`
                    *,
                    stores (
                        name
                    ),
                    items:store_items (
                        count
                    )
                `, { count: 'exact' })
                .eq('store_id', store_id);

            // Apply filters
            if (search) {
                query = query.ilike('name', `%${search}%`);
            }
            if (typeof is_active === 'boolean') {
                query = query.eq('is_active', is_active);
            }

            // Apply pagination
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            // Apply sorting
            query = query.range(from, to).order(sort_by, { ascending: sort_order === 'asc' });

            const { data: categories, error, count } = await query;

            if (error) throw error;

            const totalPages = Math.ceil((count || 0) / limit);

            // Format response
            const categoryResponses = categories?.map(category => ({
                ...category,
                store_name: category.stores?.name,
                items_count: category.items?.[0]?.count || 0
            })) || [];

            const response: PaginatedStoreItemCategoryResponse = {
                categories: categoryResponses,
                total: count || 0,
                page,
                limit,
                totalPages
            };

            ResponseHandler.success(res, 200, 'Categories retrieved successfully', response);
        } catch (error) {
            logger.error('Get categories error:', error);
            ResponseHandler.error(res, 500, 'Failed to retrieve categories');
        }
    }

    static async createCategory(req: Request, res: Response) {
        try {
            const categoryData: StoreItemCategoryCreateDto = req.body;

            // Check store access
            const { data: store } = await supabase
                .from('stores')
                .select('*')
                .eq('id', categoryData.store_id)
                .single();

            if (!store) {
                return ResponseHandler.error(res, 404, 'Store not found');
            }

            // Validate access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (store.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot create category for store from different country');
                }
                if (req.admin?.city_id && store.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot create category for store from different city');
                }
            }

            // Generate slug from name
            const slug = this.generateSlug(categoryData.name);

            // Check if category name exists in store
            const { data: existing } = await supabase
                .from('store_item_categories')
                .select('id')
                .match({
                    store_id: categoryData.store_id,
                    name: categoryData.name
                })
                .single();

            if (existing) {
                return ResponseHandler.error(res, 409, 'Category with this name already exists in store');
            }

            const { data: category, error } = await supabase
                .from('store_item_categories')
                .insert([{
                    ...categoryData,
                    slug,
                    is_active: categoryData.is_active ?? true
                }])
                .select(`
                    *,
                    stores (
                        name
                    )
                `)
                .single();

            if (error) throw error;

            const categoryResponse: StoreItemCategoryResponse = {
                ...category,
                store_name: category.stores?.name,
                items_count: 0
            };

            ResponseHandler.success(res, 201, 'Category created successfully', categoryResponse);
        } catch (error) {
            logger.error('Create category error:', error);
            ResponseHandler.error(res, 500, 'Failed to create category');
        }
    }

    static async updateCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updateData: StoreItemCategoryUpdateDto = req.body;

            // Check if category exists and get store data
            const { data: existingCategory, error: fetchError } = await supabase
                .from('store_item_categories')
                .select(`
                    *,
                    stores!inner (
                        country_id,
                        city_id
                    )
                `)
                .eq('id', id)
                .single();

            if (fetchError || !existingCategory) {
                return ResponseHandler.error(res, 404, 'Category not found');
            }

            // Validate access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (existingCategory.stores.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot update category from different country');
                }
                if (req.admin?.city_id && existingCategory.stores.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot update category from different city');
                }
            }

            // If name is being updated, check uniqueness and generate new slug
            if (updateData.name) {
                const { data: existing } = await supabase
                    .from('store_item_categories')
                    .select('id')
                    .match({
                        store_id: existingCategory.store_id,
                        name: updateData.name
                    })
                    .neq('id', id)
                    .single();

                if (existing) {
                    return ResponseHandler.error(res, 409, 'Category with this name already exists in store');
                }

                updateData.slug = this.generateSlug(updateData.name);
            }

            const { data: category, error } = await supabase
                .from('store_item_categories')
                .update(updateData)
                .eq('id', id)
                .select(`
                    *,
                    stores (
                        name
                    ),
                    items:store_items (
                        count
                    )
                `)
                .single();

            if (error) throw error;

            const categoryResponse: StoreItemCategoryResponse = {
                ...category,
                store_name: category.stores?.name,
                items_count: category.items?.[0]?.count || 0
            };

            ResponseHandler.success(res, 200, 'Category updated successfully', categoryResponse);
        } catch (error) {
            logger.error('Update category error:', error);
            ResponseHandler.error(res, 500, 'Failed to update category');
        }
    }

    static async deleteCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // Check if category exists and get store data
            const { data: category, error: fetchError } = await supabase
                .from('store_item_categories')
                .select(`
                    *,
                    stores!inner (
                        country_id,
                        city_id
                    ),
                    items:store_items (
                        count
                    )
                `)
                .eq('id', id)
                .single();

            if (fetchError || !category) {
                return ResponseHandler.error(res, 404, 'Category not found');
            }

            // Validate access based on location
            if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
                if (category.stores.country_id !== req.admin?.country_id) {
                    return ResponseHandler.error(res, 403, 'Cannot delete category from different country');
                }
                if (req.admin?.city_id && category.stores.city_id !== req.admin.city_id) {
                    return ResponseHandler.error(res, 403, 'Cannot delete category from different city');
                }
            }

            // Check if category has items
            if (category.items?.[0]?.count > 0) {
                return ResponseHandler.error(res, 400, 'Cannot delete category that contains items');
            }

            const { error } = await supabase
                .from('store_item_categories')
                .delete()
                .eq('id', id);

            if (error) throw error;

            ResponseHandler.success(res, 200, 'Category deleted successfully', null);
        } catch (error) {
            logger.error('Delete category error:', error);
            ResponseHandler.error(res, 500, 'Failed to delete category');
        }
    }

    private static generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
} 