import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  MediaUploadDto, 
  MediaUpdateDto, 
  MediaQueryParams,
  MediaType,
  MediaValidationResult
} from '../types/media.types';
import { AdminRole } from '../types/admin.types';
import MediaService from '../services/media.service';
import logger from '../utils/logger';

export class MediaController {
  static async getMedia(req: Request, res: Response) {
    try {
      const {
        search,
        country_id,
        city_id,
        type,
        purpose,
        uploaded_by,
        is_active,
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query as unknown as MediaQueryParams;

      let query = supabase
        .from('media')
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          admins (
            username,
            full_name
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,file_name.ilike.%${search}%`);
      }
      if (type) {
        query = query.eq('type', type);
      }
      if (purpose) {
        query = query.eq('purpose', purpose);
      }
      if (uploaded_by) {
        query = query.eq('uploaded_by', uploaded_by);
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

      const { data: media, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);

      // Format response
      const mediaResponses = media?.map(item => ({
        ...item,
        country_name: item.countries.name,
        city_name: item.cities?.name,
        uploaded_by_name: item.admins.full_name || item.admins.username,
        file_size_formatted: MediaService.formatFileSize(item.size_in_bytes)
      }));

      ResponseHandler.success(res, 200, 'Media retrieved successfully', {
        media: mediaResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get media error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve media');
    }
  }

  static async uploadMedia(req: Request, res: Response) {
    try {
      const { country_id, city_id, purpose, alt_text, title, description } = req.body;
      
      // Check if file exists
      if (!req.file) {
        return ResponseHandler.error(res, 400, 'No file uploaded');
      }
      const file = req.file;

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot upload media for different country');
        }
        if (city_id && city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot upload media for different city');
        }
      }

      // Validate and process file
      const validation: MediaValidationResult = await MediaService.validateAndProcessFile(file);
      if (!validation.isValid || !validation.metadata) {
        // Clean up uploaded file
        await MediaService.deleteFile(file.path);
        return ResponseHandler.error(res, 400, 'Invalid file', validation.errors);
      }

      const { metadata } = validation;
      const fileType = file.mimetype.startsWith('image/') ? MediaType.IMAGE : MediaType.VIDEO;

      // Save media record
      const { data: media, error } = await supabase
        .from('media')
        .insert([{
          country_id,
          city_id,
          purpose,
          alt_text,
          title,
          description,
          file_name: file.filename,
          original_name: file.originalname,
          type: fileType,
          mime_type: file.mimetype,
          url: `/uploads/${fileType === MediaType.IMAGE ? 'images' : 'videos'}/${file.filename}`,
          thumbnail_url: fileType === MediaType.VIDEO ? `/uploads/thumbnails/thumb_${file.filename}.jpg` : null,
          size_in_bytes: metadata.size_in_bytes,
          width: metadata.width,
          height: metadata.height,
          duration: metadata.duration,
          folder_path: file.destination,
          uploaded_by: req.admin?.id
        }])
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          admins (
            username,
            full_name
          )
        `)
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 201, 'Media uploaded successfully', {
        ...media,
        country_name: media.countries.name,
        city_name: media.cities?.name,
        uploaded_by_name: media.admins.full_name || media.admins.username,
        file_size_formatted: MediaService.formatFileSize(media.size_in_bytes)
      });
    } catch (error) {
      logger.error('Upload media error:', error);
      ResponseHandler.error(res, 500, 'Failed to upload media');
    }
  }

  static async updateMedia(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: MediaUpdateDto = req.body;

      // Check access rights
      const { data: existingMedia, error: fetchError } = await supabase
        .from('media')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingMedia) {
        return ResponseHandler.error(res, 404, 'Media not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (existingMedia.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify media from different country');
        }
        if (existingMedia.city_id && existingMedia.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify media from different city');
        }
      }

      const { data: media, error } = await supabase
        .from('media')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          admins (
            username,
            full_name
          )
        `)
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Media updated successfully', {
        ...media,
        country_name: media.countries.name,
        city_name: media.cities?.name,
        uploaded_by_name: media.admins.full_name || media.admins.username,
        file_size_formatted: MediaService.formatFileSize(media.size_in_bytes)
      });
    } catch (error) {
      logger.error('Update media error:', error);
      ResponseHandler.error(res, 500, 'Failed to update media');
    }
  }

  static async deleteMedia(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check access rights and get media details
      const { data: media, error: fetchError } = await supabase
        .from('media')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !media) {
        return ResponseHandler.error(res, 404, 'Media not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (media.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete media from different country');
        }
        if (media.city_id && media.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete media from different city');
        }
      }

      // Delete physical files
      const filePath = media.url.startsWith('/') ? media.url.slice(1) : media.url;
      const thumbnailPath = media.thumbnail_url 
        ? (media.thumbnail_url.startsWith('/') ? media.thumbnail_url.slice(1) : media.thumbnail_url)
        : undefined;

      await MediaService.deleteFile(filePath, thumbnailPath);

      // Delete database record
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Media deleted successfully', null);
    } catch (error) {
      logger.error('Delete media error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete media');
    }
  }
} 