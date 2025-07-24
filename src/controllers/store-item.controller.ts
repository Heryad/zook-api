import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  StoreItemCreateDto, 
  StoreItemUpdateDto, 
  StoreItemQueryParams,
  StoreItemPhoto
} from '../types/store-item.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class StoreItemController {
  static async getStoreItems(req: Request, res: Response) {
    try {
      const {
        search,
        store_id,
        category_id,
        is_active,
        min_price,
        max_price,
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query as unknown as StoreItemQueryParams;

      let query = supabase
        .from('store_items')
        .select(`
          *,
          stores (
            name,
            country_id,
            city_id
          ),
          store_item_categories (
            name
          ),
          photos:store_item_photos (
            id,
            position,
            media:media_id (
              url,
              thumbnail_url,
              type,
              metadata
            )
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (store_id) {
        query = query.eq('store_id', store_id);
      }
      if (category_id) {
        query = query.eq('category_id', category_id);
      }
      if (typeof is_active === 'boolean') {
        query = query.eq('is_active', is_active);
      }
      if (min_price !== undefined) {
        query = query.gte('price', min_price);
      }
      if (max_price !== undefined) {
        query = query.lte('price', max_price);
      }

      // Apply location-based access control
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id) {
          query = query.eq('stores.country_id', req.admin.country_id);
          if (req.admin?.city_id) {
            query = query.eq('stores.city_id', req.admin.city_id);
          }
        }
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order(sort_by, { ascending: sort_order === 'asc' });

      const { data: items, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);

      // Format response
      const itemResponses = items?.map(item => ({
        ...item,
        store_name: item.stores.name,
        category_name: item.store_item_categories.name,
        photos: (item.photos as StoreItemPhoto[])
          .sort((a: StoreItemPhoto, b: StoreItemPhoto) => a.position - b.position)
          .map((photo: StoreItemPhoto) => ({
            id: photo.id,
            position: photo.position,
            media: photo.media
          }))
      }));

      ResponseHandler.success(res, 200, 'Store items retrieved successfully', {
        items: itemResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get store items error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve store items');
    }
  }

  static async getStoreItemById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { data: item, error } = await supabase
        .from('store_items')
        .select(`
          *,
          stores (
            name,
            country_id,
            city_id
          ),
          store_item_categories (
            name
          ),
          photos:store_item_photos (
            id,
            position,
            media:media_id (
              url,
              thumbnail_url,
              type,
              metadata
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error || !item) {
        return ResponseHandler.error(res, 404, 'Store item not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && item.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot access store item from different country');
        }
        if (req.admin?.city_id && item.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot access store item from different city');
        }
      }

      // Format response
      const response = {
        ...item,
        store_name: item.stores.name,
        category_name: item.store_item_categories.name,
        photos: (item.photos as StoreItemPhoto[])
          .sort((a: StoreItemPhoto, b: StoreItemPhoto) => a.position - b.position)
          .map((photo: StoreItemPhoto) => ({
            id: photo.id,
            position: photo.position,
            media: photo.media
          }))
      };

      ResponseHandler.success(res, 200, 'Store item retrieved successfully', response);
    } catch (error) {
      logger.error('Get store item error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve store item');
    }
  }

  static async createStoreItem(req: Request, res: Response) {
    try {
      const data: StoreItemCreateDto = req.body;

      // Validate store ownership and access rights
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('country_id, city_id')
        .eq('id', data.store_id)
        .single();

      if (storeError || !store) {
        return ResponseHandler.error(res, 400, 'Invalid store ID');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && store.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot create store item for different country');
        }
        if (req.admin?.city_id && store.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot create store item for different city');
        }
      }

      // Validate category
      const { data: category, error: categoryError } = await supabase
        .from('store_item_categories')
        .select('id')
        .eq('id', data.category_id)
        .eq('store_id', data.store_id)
        .single();

      if (categoryError || !category) {
        return ResponseHandler.error(res, 400, 'Invalid category ID');
      }

      // Validate media if provided
      if (data.photo_media_ids?.length) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('id')
          .in('id', data.photo_media_ids)
          .eq('purpose', 'store_item_photo');

        if (mediaError || !media || media.length !== data.photo_media_ids.length) {
          return ResponseHandler.error(res, 400, 'Invalid media IDs');
        }
      }

      // Create store item
      const { photo_media_ids, ...itemData } = data;
      const { data: item, error } = await supabase
        .from('store_items')
        .insert([itemData])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {  // Unique violation
          return ResponseHandler.error(res, 400, 'Item name already exists in this store');
        }
        throw error;
      }

      // Add photos if provided
      if (photo_media_ids?.length) {
        const photos = photo_media_ids.map((media_id, index) => ({
          store_item_id: item.id,
          media_id,
          position: index
        }));

        const { error: photoError } = await supabase
          .from('store_item_photos')
          .insert(photos);

        if (photoError) throw photoError;
      }

      // Get complete item with relations
      const { data: completeItem, error: fetchError } = await supabase
        .from('store_items')
        .select(`
          *,
          stores (
            name
          ),
          store_item_categories (
            name
          ),
          photos:store_item_photos (
            id,
            position,
            media:media_id (
              url,
              thumbnail_url,
              type,
              metadata
            )
          )
        `)
        .eq('id', item.id)
        .single();

      if (fetchError) throw fetchError;

      // Format response
      const response = {
        ...completeItem,
        store_name: completeItem.stores.name,
        category_name: completeItem.store_item_categories.name,
        photos: (completeItem.photos as StoreItemPhoto[])
          .sort((a: StoreItemPhoto, b: StoreItemPhoto) => a.position - b.position)
          .map((photo: StoreItemPhoto) => ({
            id: photo.id,
            position: photo.position,
            media: photo.media
          }))
      };

      ResponseHandler.success(res, 201, 'Store item created successfully', response);
    } catch (error) {
      logger.error('Create store item error:', error);
      ResponseHandler.error(res, 500, 'Failed to create store item');
    }
  }

  static async updateStoreItem(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: StoreItemUpdateDto = req.body;

      // Check if item exists and get store details
      const { data: existingItem, error: fetchError } = await supabase
        .from('store_items')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !existingItem) {
        return ResponseHandler.error(res, 404, 'Store item not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && existingItem.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different country');
        }
        if (req.admin?.city_id && existingItem.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different city');
        }
      }

      // Validate category if provided
      if (data.category_id) {
        const { data: category, error: categoryError } = await supabase
          .from('store_item_categories')
          .select('id')
          .eq('id', data.category_id)
          .eq('store_id', existingItem.store_id)
          .single();

        if (categoryError || !category) {
          return ResponseHandler.error(res, 400, 'Invalid category ID');
        }
      }

      // Validate media if provided
      if (data.photo_media_ids?.length) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('id')
          .in('id', data.photo_media_ids)
          .eq('purpose', 'store_item_photo');

        if (mediaError || !media || media.length !== data.photo_media_ids.length) {
          return ResponseHandler.error(res, 400, 'Invalid media IDs');
        }
      }

      // Update item
      const { photo_media_ids, ...itemData } = data;
      const { error: updateError } = await supabase
        .from('store_items')
        .update(itemData)
        .eq('id', id);

      if (updateError) {
        if (updateError.code === '23505') {  // Unique violation
          return ResponseHandler.error(res, 400, 'Item name already exists in this store');
        }
        throw updateError;
      }

      // Update photos if provided
      if (photo_media_ids?.length) {
        // Delete existing photos
        await supabase
          .from('store_item_photos')
          .delete()
          .eq('store_item_id', id);

        // Add new photos
        const photos = photo_media_ids.map((media_id, index) => ({
          store_item_id: id,
          media_id,
          position: index
        }));

        const { error: photoError } = await supabase
          .from('store_item_photos')
          .insert(photos);

        if (photoError) throw photoError;
      }

      // Get updated item with relations
      const { data: updatedItem, error } = await supabase
        .from('store_items')
        .select(`
          *,
          stores (
            name
          ),
          store_item_categories (
            name
          ),
          photos:store_item_photos (
            id,
            position,
            media:media_id (
              url,
              thumbnail_url,
              type,
              metadata
            )
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Format response
      const response = {
        ...updatedItem,
        store_name: updatedItem.stores.name,
        category_name: updatedItem.store_item_categories.name,
        photos: (updatedItem.photos as StoreItemPhoto[])
          .sort((a: StoreItemPhoto, b: StoreItemPhoto) => a.position - b.position)
          .map((photo: StoreItemPhoto) => ({
            id: photo.id,
            position: photo.position,
            media: photo.media
          }))
      };

      ResponseHandler.success(res, 200, 'Store item updated successfully', response);
    } catch (error) {
      logger.error('Update store item error:', error);
      ResponseHandler.error(res, 500, 'Failed to update store item');
    }
  }

  static async deleteStoreItem(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if item exists and get store details
      const { data: item, error: fetchError } = await supabase
        .from('store_items')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !item) {
        return ResponseHandler.error(res, 404, 'Store item not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && item.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete store item from different country');
        }
        if (req.admin?.city_id && item.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete store item from different city');
        }
      }

      // Delete item (photos will be deleted automatically due to ON DELETE CASCADE)
      const { error } = await supabase
        .from('store_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Store item deleted successfully');
    } catch (error) {
      logger.error('Delete store item error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete store item');
    }
  }

  static async toggleActiveStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if item exists and get store details
      const { data: item, error: fetchError } = await supabase
        .from('store_items')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !item) {
        return ResponseHandler.error(res, 404, 'Store item not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && item.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different country');
        }
        if (req.admin?.city_id && item.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different city');
        }
      }

      // Toggle active status
      const { data: updatedItem, error } = await supabase
        .from('store_items')
        .update({ is_active: !item.is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 200, `Store item is now ${updatedItem.is_active ? 'active' : 'inactive'}`);
    } catch (error) {
      logger.error('Toggle store item active status error:', error);
      ResponseHandler.error(res, 500, 'Failed to toggle store item active status');
    }
  }

  static async addPhotos(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { media_ids, positions }: { media_ids: string[], positions?: number[] } = req.body;

      // Check if item exists and get store details
      const { data: item, error: fetchError } = await supabase
        .from('store_items')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !item) {
        return ResponseHandler.error(res, 404, 'Store item not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && item.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different country');
        }
        if (req.admin?.city_id && item.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different city');
        }
      }

      // Validate media IDs
      const { data: media, error: mediaError } = await supabase
        .from('media')
        .select('id')
        .in('id', media_ids)
        .eq('purpose', 'store_item_photo');

      if (mediaError || !media || media.length !== media_ids.length) {
        return ResponseHandler.error(res, 400, 'Invalid media IDs');
      }

      // Get current max position if needed
      let startPosition = 0;
      if (!positions) {
        const { data: maxPos } = await supabase
          .from('store_item_photos')
          .select('position')
          .eq('store_item_id', id)
          .order('position', { ascending: false })
          .limit(1)
          .single();

        startPosition = (maxPos?.position || -1) + 1;
      }

      // Add photos
      const photos = media_ids.map((media_id, index) => ({
        store_item_id: id,
        media_id,
        position: positions?.[index] ?? (startPosition + index)
      }));

      const { error } = await supabase
        .from('store_item_photos')
        .insert(photos);

      if (error) throw error;

      // Get updated photos
      const { data: updatedPhotos, error: photosError } = await supabase
        .from('store_item_photos')
        .select(`
          id,
          position,
          media:media_id (
            url,
            thumbnail_url,
            type,
            metadata
          )
        `)
        .eq('store_item_id', id)
        .order('position');

      if (photosError) throw photosError;

      ResponseHandler.success(res, 200, 'Photos added successfully', updatedPhotos);
    } catch (error) {
      logger.error('Add store item photos error:', error);
      ResponseHandler.error(res, 500, 'Failed to add photos');
    }
  }

  static async updatePhotoPosition(req: Request, res: Response) {
    try {
      const { id, photoId } = req.params;
      const { position }: { position: number } = req.body;

      // Check if item exists and get store details
      const { data: item, error: fetchError } = await supabase
        .from('store_items')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !item) {
        return ResponseHandler.error(res, 404, 'Store item not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && item.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different country');
        }
        if (req.admin?.city_id && item.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different city');
        }
      }

      // Check if photo exists and belongs to item
      const { data: photo, error: photoError } = await supabase
        .from('store_item_photos')
        .select('id')
        .eq('id', photoId)
        .eq('store_item_id', id)
        .single();

      if (photoError || !photo) {
        return ResponseHandler.error(res, 404, 'Photo not found');
      }

      // Update position
      const { error } = await supabase
        .from('store_item_photos')
        .update({ position })
        .eq('id', photoId);

      if (error) throw error;

      // Get updated photos
      const { data: updatedPhotos, error: photosError } = await supabase
        .from('store_item_photos')
        .select(`
          id,
          position,
          media:media_id (
            url,
            thumbnail_url,
            type,
            metadata
          )
        `)
        .eq('store_item_id', id)
        .order('position');

      if (photosError) throw photosError;

      ResponseHandler.success(res, 200, 'Photo position updated successfully', updatedPhotos);
    } catch (error) {
      logger.error('Update store item photo position error:', error);
      ResponseHandler.error(res, 500, 'Failed to update photo position');
    }
  }

  static async deletePhoto(req: Request, res: Response) {
    try {
      const { id, photoId } = req.params;

      // Check if item exists and get store details
      const { data: item, error: fetchError } = await supabase
        .from('store_items')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !item) {
        return ResponseHandler.error(res, 404, 'Store item not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && item.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different country');
        }
        if (req.admin?.city_id && item.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify store item from different city');
        }
      }

      // Check if photo exists and belongs to item
      const { data: photo, error: photoError } = await supabase
        .from('store_item_photos')
        .select('id')
        .eq('id', photoId)
        .eq('store_item_id', id)
        .single();

      if (photoError || !photo) {
        return ResponseHandler.error(res, 404, 'Photo not found');
      }

      // Delete photo
      const { error } = await supabase
        .from('store_item_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Photo deleted successfully');
    } catch (error) {
      logger.error('Delete store item photo error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete photo');
    }
  }
} 