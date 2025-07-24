import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  Store,
  StoreCreateDto, 
  StoreUpdateDto, 
  StoreFilters 
} from '../types/store.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';
import bcrypt from 'bcrypt';

export class StoreController {
  private static readonly SALT_ROUNDS = 10;

  static async getStores(req: Request, res: Response) {
    try {
      const {
        search,
        country_id,
        city_id,
        category_id,
        is_sponsored,
        is_active,
        is_busy,
        tags,
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query as unknown as StoreFilters;

      let query = supabase
        .from('stores')
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          categories (
            name
          ),
          logo:logo_media_id (
            url,
            thumbnail_url,
            type,
            metadata
          ),
          cover:cover_media_id (
            url,
            thumbnail_url,
            type,
            metadata
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (typeof is_sponsored === 'boolean') {
        query = query.eq('is_sponsored', is_sponsored);
      }
      if (typeof is_active === 'boolean') {
        query = query.eq('is_active', is_active);
      }
      if (typeof is_busy === 'boolean') {
        query = query.eq('is_busy', is_busy);
      }
      if (category_id) {
        query = query.eq('category_id', category_id);
      }
      if (tags?.length) {
        query = query.contains('tags', tags);
      }

      // Apply location-based access control
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id) {
          query = query.eq('country_id', req.admin.country_id);
          if (req.admin?.city_id) {
            query = query.eq('city_id', req.admin.city_id);
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

      const { data: stores, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);

      // Format response
      const storeResponses = stores?.map(store => ({
        ...store,
        country_name: store.countries.name,
        city_name: store.cities?.name,
        category_name: store.categories.name,
        logo: store.logo ? {
          url: store.logo.url,
          thumbnail_url: store.logo.thumbnail_url,
          type: store.logo.type,
          metadata: store.logo.metadata
        } : undefined,
        cover: store.cover ? {
          url: store.cover.url,
          thumbnail_url: store.cover.thumbnail_url,
          type: store.cover.type,
          metadata: store.cover.metadata
        } : undefined,
        // Remove sensitive data
        auth_details: undefined
      }));

      ResponseHandler.success(res, 200, 'Stores retrieved successfully', {
        stores: storeResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get stores error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve stores');
    }
  }

  static async getStoreById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { data: store, error } = await supabase
        .from('stores')
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          categories (
            name
          ),
          logo:logo_media_id (
            url,
            thumbnail_url,
            type,
            metadata
          ),
          cover:cover_media_id (
            url,
            thumbnail_url,
            type,
            metadata
          )
        `)
        .eq('id', id)
        .single();

      if (error || !store) {
        return ResponseHandler.error(res, 404, 'Store not found');
      }

      // Format response
      const response = {
        ...store,
        country_name: store.countries.name,
        city_name: store.cities?.name,
        category_name: store.categories.name,
        logo: store.logo ? {
          url: store.logo.url,
          thumbnail_url: store.logo.thumbnail_url,
          type: store.logo.type,
          metadata: store.logo.metadata
        } : undefined,
        cover: store.cover ? {
          url: store.cover.url,
          thumbnail_url: store.cover.thumbnail_url,
          type: store.cover.type,
          metadata: store.cover.metadata
        } : undefined,
        // Remove sensitive data
        auth_details: undefined
      };

      ResponseHandler.success(res, 200, 'Store retrieved successfully', response);
    } catch (error) {
      logger.error('Get store error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve store');
    }
  }

  static async createStore(req: Request, res: Response) {
    try {
      const data: StoreCreateDto = req.body;

      // Validate media if provided
      if (data.logo_media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', data.logo_media_id)
          .eq('purpose', 'store_logo')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid logo media ID');
        }
      }

      if (data.cover_media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', data.cover_media_id)
          .eq('purpose', 'store_cover')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid cover media ID');
        }
      }

      // Validate category
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('*')
        .eq('id', data.category_id)
        .eq('is_active', true)
        .single();

      if (categoryError || !category) {
        return ResponseHandler.error(res, 400, 'Invalid category ID');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.auth_details.password, this.SALT_ROUNDS);

      // Prepare store data
      const { auth_details, ...rest } = data;
      const store = {
        ...rest,
        auth_details: {
          username: auth_details.username,
          password_hash: passwordHash
        },
        slug: data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      };

      // Create store
      const { data: newStore, error } = await supabase
        .from('stores')
        .insert([store])
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          categories (
            name
          ),
          logo:logo_media_id (
            url,
            thumbnail_url,
            type,
            metadata
          ),
          cover:cover_media_id (
            url,
            thumbnail_url,
            type,
            metadata
          )
        `)
        .single();

      if (error) {
        if (error.code === '23505') {  // Unique violation
          return ResponseHandler.error(res, 400, 'Store name already exists in this location');
        }
        throw error;
      }

      // Format response
      const response = {
        ...newStore,
        country_name: newStore.countries.name,
        city_name: newStore.cities?.name,
        category_name: newStore.categories.name,
        logo: newStore.logo ? {
          url: newStore.logo.url,
          thumbnail_url: newStore.logo.thumbnail_url,
          type: newStore.logo.type,
          metadata: newStore.logo.metadata
        } : undefined,
        cover: newStore.cover ? {
          url: newStore.cover.url,
          thumbnail_url: newStore.cover.thumbnail_url,
          type: newStore.cover.type,
          metadata: newStore.cover.metadata
        } : undefined,
        // Remove sensitive data
        auth_details: undefined
      };

      ResponseHandler.success(res, 201, 'Store created successfully', response);
    } catch (error) {
      logger.error('Create store error:', error);
      ResponseHandler.error(res, 500, 'Failed to create store');
    }
  }

  static async updateStore(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: StoreUpdateDto = req.body;

      // Check if store exists
      const { data: existingStore, error: fetchError } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingStore) {
        return ResponseHandler.error(res, 404, 'Store not found');
      }

      // Validate media if provided
      if (data.logo_media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', data.logo_media_id)
          .eq('purpose', 'store_logo')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid logo media ID');
        }
      }

      if (data.cover_media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', data.cover_media_id)
          .eq('purpose', 'store_cover')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid cover media ID');
        }
      }

      // Validate category if provided
      if (data.category_id) {
        const { data: category, error: categoryError } = await supabase
          .from('categories')
          .select('*')
          .eq('id', data.category_id)
          .eq('is_active', true)
          .single();

        if (categoryError || !category) {
          return ResponseHandler.error(res, 400, 'Invalid category ID');
        }
      }

      // Prepare update data
      const updates: any = { ...data };
      delete updates.auth_details;

      // Handle auth details update
      if (data.auth_details) {
        if (data.auth_details.password) {
          const passwordHash = await bcrypt.hash(data.auth_details.password, this.SALT_ROUNDS);
          updates.auth_details = {
            ...existingStore.auth_details,
            ...data.auth_details,
            password_hash: passwordHash
          };
          delete updates.auth_details.password;
        } else {
          updates.auth_details = {
            ...existingStore.auth_details,
            ...data.auth_details
          };
        }
      }

      // Handle name update
      if (data.name) {
        updates.slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }

      // Update store
      const { data: updatedStore, error } = await supabase
        .from('stores')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          categories (
            name
          ),
          logo:logo_media_id (
            url,
            thumbnail_url,
            type,
            metadata
          ),
          cover:cover_media_id (
            url,
            thumbnail_url,
            type,
            metadata
          )
        `)
        .single();

      if (error) {
        if (error.code === '23505') {  // Unique violation
          return ResponseHandler.error(res, 400, 'Store name already exists in this location');
        }
        throw error;
      }

      // Format response
      const response = {
        ...updatedStore,
        country_name: updatedStore.countries.name,
        city_name: updatedStore.cities?.name,
        category_name: updatedStore.categories.name,
        logo: updatedStore.logo ? {
          url: updatedStore.logo.url,
          thumbnail_url: updatedStore.logo.thumbnail_url,
          type: updatedStore.logo.type,
          metadata: updatedStore.logo.metadata
        } : undefined,
        cover: updatedStore.cover ? {
          url: updatedStore.cover.url,
          thumbnail_url: updatedStore.cover.thumbnail_url,
          type: updatedStore.cover.type,
          metadata: updatedStore.cover.metadata
        } : undefined,
        // Remove sensitive data
        auth_details: undefined
      };

      ResponseHandler.success(res, 200, 'Store updated successfully', response);
    } catch (error) {
      logger.error('Update store error:', error);
      ResponseHandler.error(res, 500, 'Failed to update store');
    }
  }

  static async deleteStore(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if store exists
      const { data: store, error: fetchError } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !store) {
        return ResponseHandler.error(res, 404, 'Store not found');
      }

      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Store deleted successfully');
    } catch (error) {
      logger.error('Delete store error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete store');
    }
  }

  static async toggleBusyStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if store exists
      const { data: store, error: fetchError } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !store) {
        return ResponseHandler.error(res, 404, 'Store not found');
      }

      const { data: updatedStore, error } = await supabase
        .from('stores')
        .update({ is_busy: !store.is_busy })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 200, `Store is now ${updatedStore.is_busy ? 'busy' : 'available'}`);
    } catch (error) {
      logger.error('Toggle store busy status error:', error);
      ResponseHandler.error(res, 500, 'Failed to toggle store busy status');
    }
  }

  static async toggleActiveStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if store exists
      const { data: store, error: fetchError } = await supabase
        .from('stores')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !store) {
        return ResponseHandler.error(res, 404, 'Store not found');
      }

      const { data: updatedStore, error } = await supabase
        .from('stores')
        .update({ is_active: !store.is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 200, `Store is now ${updatedStore.is_active ? 'active' : 'inactive'}`);
    } catch (error) {
      logger.error('Toggle store active status error:', error);
      ResponseHandler.error(res, 500, 'Failed to toggle store active status');
    }
  }
} 