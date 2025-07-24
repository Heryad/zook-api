import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  CategoryCreateDto, 
  CategoryUpdateDto, 
  CategoryQueryParams 
} from '../types/category.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class CategoryController {
  static async getCategories(req: Request, res: Response) {
    try {
      const {
        search,
        country_id,
        city_id,
        is_active,
        page = 1,
        limit = 10,
        sort_by = 'position',
        sort_order = 'asc'
      } = req.query as unknown as CategoryQueryParams;

      let query = supabase
        .from('categories')
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          media (
            url,
            thumbnail_url,
            type
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (typeof is_active === 'boolean') {
        query = query.eq('is_active', is_active);
      }

      // Apply location-based access control
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id) {
          query = query.eq('country_id', req.admin.country_id);
          if (req.admin?.city_id) {
            query = query.or(`city_id.is.null,city_id.eq.${req.admin.city_id}`);
          }
        }
      } else {
        if (country_id) {
          query = query.eq('country_id', country_id);
          if (city_id) {
            query = query.eq('city_id', city_id);
          }
        }
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order(sort_by, { ascending: sort_order === 'asc' });

      const { data: categories, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);

      // Format response
      const categoryResponses = categories?.map(item => ({
        ...item,
        country_name: item.countries.name,
        city_name: item.cities?.name,
        media: item.media ? {
          url: item.media.url,
          thumbnail_url: item.media.thumbnail_url,
          type: item.media.type
        } : undefined
      }));

      ResponseHandler.success(res, 200, 'Categories retrieved successfully', {
        categories: categoryResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get categories error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve categories');
    }
  }

  static async createCategory(req: Request, res: Response) {
    try {
      const data: CategoryCreateDto = req.body;

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (data.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot create category for different country');
        }
        if (data.city_id && data.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot create category for different city');
        }
      }

      // Validate media if provided
      if (data.media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', data.media_id)
          .eq('purpose', 'category_image')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid media ID');
        }

        // Check media location matches category location
        if (media.country_id !== data.country_id || 
            (data.city_id && media.city_id !== data.city_id)) {
          return ResponseHandler.error(res, 400, 'Media location does not match category location');
        }
      }

      // Get max position if not provided
      if (data.position === undefined) {
        const { data: maxPos } = await supabase
          .from('categories')
          .select('position')
          .eq('country_id', data.country_id)
          .eq('city_id', data.city_id || null)
          .order('position', { ascending: false })
          .limit(1)
          .single();

        data.position = (maxPos?.position || 0) + 1;
      }

      const { data: category, error } = await supabase
        .from('categories')
        .insert([data])
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          media (
            url,
            thumbnail_url,
            type
          )
        `)
        .single();

      if (error) {
        if (error.code === '23505') {  // Unique violation
          return ResponseHandler.error(res, 400, 'Category name already exists in this location');
        }
        throw error;
      }

      ResponseHandler.success(res, 201, 'Category created successfully', {
        ...category,
        country_name: category.countries.name,
        city_name: category.cities?.name,
        media: category.media ? {
          url: category.media.url,
          thumbnail_url: category.media.thumbnail_url,
          type: category.media.type
        } : undefined
      });
    } catch (error) {
      logger.error('Create category error:', error);
      ResponseHandler.error(res, 500, 'Failed to create category');
    }
  }

  static async updateCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: CategoryUpdateDto = req.body;

      // Check if category exists and get its details
      const { data: existingCategory, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingCategory) {
        return ResponseHandler.error(res, 404, 'Category not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (existingCategory.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify category from different country');
        }
        if (existingCategory.city_id && existingCategory.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify category from different city');
        }
      }

      // Validate media if provided
      if (data.media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', data.media_id)
          .eq('purpose', 'category_image')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid media ID');
        }

        // Check media location matches category location
        if (media.country_id !== existingCategory.country_id || 
            (existingCategory.city_id && media.city_id !== existingCategory.city_id)) {
          return ResponseHandler.error(res, 400, 'Media location does not match category location');
        }
      }

      const { data: category, error } = await supabase
        .from('categories')
        .update(data)
        .eq('id', id)
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          media (
            url,
            thumbnail_url,
            type
          )
        `)
        .single();

      if (error) {
        if (error.code === '23505') {  // Unique violation
          return ResponseHandler.error(res, 400, 'Category name already exists in this location');
        }
        throw error;
      }

      ResponseHandler.success(res, 200, 'Category updated successfully', {
        ...category,
        country_name: category.countries.name,
        city_name: category.cities?.name,
        media: category.media ? {
          url: category.media.url,
          thumbnail_url: category.media.thumbnail_url,
          type: category.media.type
        } : undefined
      });
    } catch (error) {
      logger.error('Update category error:', error);
      ResponseHandler.error(res, 500, 'Failed to update category');
    }
  }

  static async deleteCategory(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if category exists and get its details
      const { data: category, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !category) {
        return ResponseHandler.error(res, 404, 'Category not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (category.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete category from different country');
        }
        if (category.city_id && category.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete category from different city');
        }
      }

      // Check if category is in use
      const { count: storeCount } = await supabase
        .from('store_categories')  // Assuming this table exists
        .select('*', { count: 'exact' })
        .eq('category_id', id);

      if (storeCount && storeCount > 0) {
        return ResponseHandler.error(res, 400, 'Cannot delete category that is in use by stores');
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Category deleted successfully');
    } catch (error) {
      logger.error('Delete category error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete category');
    }
  }

  static async updatePosition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { position } = req.body;

      if (typeof position !== 'number' || position < 0) {
        return ResponseHandler.error(res, 400, 'Invalid position value');
      }

      // Get category details
      const { data: category, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !category) {
        return ResponseHandler.error(res, 404, 'Category not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (category.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify category from different country');
        }
        if (category.city_id && category.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify category from different city');
        }
      }

      // Update positions
      const { error } = await supabase.rpc('update_category_position', {
        p_category_id: id,
        p_new_position: position,
        p_country_id: category.country_id,
        p_city_id: category.city_id
      });

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Category position updated successfully');
    } catch (error) {
      logger.error('Update category position error:', error);
      ResponseHandler.error(res, 500, 'Failed to update category position');
    }
  }
} 