import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  BannerCreateDto, 
  BannerUpdateDto, 
  BannerQueryParams 
} from '../types/banner.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class BannerController {
  static async getBanners(req: Request, res: Response) {
    try {
      const {
        search,
        country_id,
        city_id,
        store_id,
        is_promotion,
        is_active,
        include_expired = false,
        page = 1,
        limit = 10,
        sort_by = 'position',
        sort_order = 'asc'
      } = req.query as unknown as BannerQueryParams;

      let query = supabase
        .from('banners')
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          stores (
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
      if (typeof is_promotion === 'boolean') {
        query = query.eq('is_promotion', is_promotion);
      }
      if (typeof is_active === 'boolean') {
        query = query.eq('is_active', is_active);
      }
      if (store_id) {
        query = query.eq('store_id', store_id);
      }
      if (!include_expired) {
        query = query.or(`end_date.is.null,end_date.gt.${new Date().toISOString()}`);
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

      const { data: banners, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);
      const now = new Date();

      // Format response
      const bannerResponses = banners?.map(item => ({
        ...item,
        country_name: item.countries.name,
        city_name: item.cities?.name,
        store_name: item.stores?.name,
        media: {
          url: item.media.url,
          thumbnail_url: item.media.thumbnail_url,
          type: item.media.type
        },
        is_expired: item.end_date ? new Date(item.end_date) < now : false
      }));

      ResponseHandler.success(res, 200, 'Banners retrieved successfully', {
        banners: bannerResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get banners error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve banners');
    }
  }

  static async createBanner(req: Request, res: Response) {
    try {
      const data: BannerCreateDto = req.body;

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (data.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot create banner for different country');
        }
        if (data.city_id && data.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot create banner for different city');
        }
      }

      // Validate media
      const { data: media, error: mediaError } = await supabase
        .from('media')
        .select('*')
        .eq('id', data.media_id)
        .eq('purpose', 'banner')
        .single();

      if (mediaError || !media) {
        return ResponseHandler.error(res, 400, 'Invalid media ID');
      }

      // Check media location matches banner location
      if (media.country_id !== data.country_id || 
          (data.city_id && media.city_id !== data.city_id)) {
        return ResponseHandler.error(res, 400, 'Media location does not match banner location');
      }

      // Validate store if provided
      if (data.store_id) {
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('country_id, city_id')
          .eq('id', data.store_id)
          .single();

        if (storeError || !store) {
          return ResponseHandler.error(res, 400, 'Invalid store ID');
        }

        // Check store location matches banner location
        if (store.country_id !== data.country_id || 
            (data.city_id && store.city_id !== data.city_id)) {
          return ResponseHandler.error(res, 400, 'Store location does not match banner location');
        }
      }

      // Get max position if not provided
      if (data.position === undefined) {
        const { data: maxPos } = await supabase
          .from('banners')
          .select('position')
          .eq('country_id', data.country_id)
          .eq('city_id', data.city_id || null)
          .order('position', { ascending: false })
          .limit(1)
          .single();

        data.position = (maxPos?.position || 0) + 1;
      }

      const { data: banner, error } = await supabase
        .from('banners')
        .insert([data])
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          stores (
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
          return ResponseHandler.error(res, 400, 'Banner name already exists in this location');
        }
        throw error;
      }

      ResponseHandler.success(res, 201, 'Banner created successfully', {
        ...banner,
        country_name: banner.countries.name,
        city_name: banner.cities?.name,
        store_name: banner.stores?.name,
        media: {
          url: banner.media.url,
          thumbnail_url: banner.media.thumbnail_url,
          type: banner.media.type
        },
        is_expired: banner.end_date ? new Date(banner.end_date) < new Date() : false
      });
    } catch (error) {
      logger.error('Create banner error:', error);
      ResponseHandler.error(res, 500, 'Failed to create banner');
    }
  }

  static async updateBanner(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: BannerUpdateDto = req.body;

      // Check if banner exists and get its details
      const { data: existingBanner, error: fetchError } = await supabase
        .from('banners')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingBanner) {
        return ResponseHandler.error(res, 404, 'Banner not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (existingBanner.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify banner from different country');
        }
        if (existingBanner.city_id && existingBanner.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify banner from different city');
        }
      }

      // Validate media if provided
      if (data.media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', data.media_id)
          .eq('purpose', 'banner')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid media ID');
        }

        // Check media location matches banner location
        if (media.country_id !== existingBanner.country_id || 
            (existingBanner.city_id && media.city_id !== existingBanner.city_id)) {
          return ResponseHandler.error(res, 400, 'Media location does not match banner location');
        }
      }

      // Validate store if provided
      if (data.store_id) {
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('country_id, city_id')
          .eq('id', data.store_id)
          .single();

        if (storeError || !store) {
          return ResponseHandler.error(res, 400, 'Invalid store ID');
        }

        // Check store location matches banner location
        if (store.country_id !== existingBanner.country_id || 
            (existingBanner.city_id && store.city_id !== existingBanner.city_id)) {
          return ResponseHandler.error(res, 400, 'Store location does not match banner location');
        }
      }

      const { data: banner, error } = await supabase
        .from('banners')
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
          stores (
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
          return ResponseHandler.error(res, 400, 'Banner name already exists in this location');
        }
        throw error;
      }

      ResponseHandler.success(res, 200, 'Banner updated successfully', {
        ...banner,
        country_name: banner.countries.name,
        city_name: banner.cities?.name,
        store_name: banner.stores?.name,
        media: {
          url: banner.media.url,
          thumbnail_url: banner.media.thumbnail_url,
          type: banner.media.type
        },
        is_expired: banner.end_date ? new Date(banner.end_date) < new Date() : false
      });
    } catch (error) {
      logger.error('Update banner error:', error);
      ResponseHandler.error(res, 500, 'Failed to update banner');
    }
  }

  static async deleteBanner(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if banner exists and get its details
      const { data: banner, error: fetchError } = await supabase
        .from('banners')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !banner) {
        return ResponseHandler.error(res, 404, 'Banner not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (banner.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete banner from different country');
        }
        if (banner.city_id && banner.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete banner from different city');
        }
      }

      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Banner deleted successfully');
    } catch (error) {
      logger.error('Delete banner error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete banner');
    }
  }

  static async updatePosition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { position } = req.body;

      if (typeof position !== 'number' || position < 0) {
        return ResponseHandler.error(res, 400, 'Invalid position value');
      }

      // Get banner details
      const { data: banner, error: fetchError } = await supabase
        .from('banners')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !banner) {
        return ResponseHandler.error(res, 404, 'Banner not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (banner.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify banner from different country');
        }
        if (banner.city_id && banner.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify banner from different city');
        }
      }

      // Update positions
      const { error } = await supabase.rpc('update_banner_position', {
        p_banner_id: id,
        p_new_position: position,
        p_country_id: banner.country_id,
        p_city_id: banner.city_id
      });

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Banner position updated successfully');
    } catch (error) {
      logger.error('Update banner position error:', error);
      ResponseHandler.error(res, 500, 'Failed to update banner position');
    }
  }
} 