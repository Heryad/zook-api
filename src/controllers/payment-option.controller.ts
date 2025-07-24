import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  PaymentOptionCreateDto, 
  PaymentOptionUpdateDto, 
  PaymentOptionQueryParams,
  PaymentOptionStatus
} from '../types/payment-option.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class PaymentOptionController {
  static async getPaymentOptions(req: Request, res: Response) {
    try {
      const {
        search,
        country_id,
        type,
        status,
        is_default,
        page = 1,
        limit = 10,
        sort_by = 'position',
        sort_order = 'asc'
      } = req.query as unknown as PaymentOptionQueryParams;

      let query = supabase
        .from('payment_options')
        .select(`
          *,
          countries (
            name
          ),
          media:logo_media_id (
            url
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.ilike('name', `%${search}%`);
      }
      if (type) {
        query = query.eq('type', type);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (typeof is_default === 'boolean') {
        query = query.eq('is_default', is_default);
      }

      // Apply location-based access control
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id) {
          query = query.eq('country_id', req.admin.country_id);
        }
      } else if (country_id) {
        query = query.eq('country_id', country_id);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order(sort_by, { ascending: sort_order === 'asc' });

      const { data: paymentOptions, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);

      // Format response
      const paymentOptionResponses = paymentOptions?.map(option => ({
        ...option,
        country_name: option.countries.name,
        logo_url: option.media?.url
      }));

      ResponseHandler.success(res, 200, 'Payment options retrieved successfully', {
        payment_options: paymentOptionResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get payment options error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve payment options');
    }
  }

  static async createPaymentOption(req: Request, res: Response) {
    try {
      const paymentData: PaymentOptionCreateDto = req.body;

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (paymentData.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot create payment option for different country');
        }
      }

      // Check if name exists in country
      const { data: existing } = await supabase
        .from('payment_options')
        .select('name')
        .eq('country_id', paymentData.country_id)
        .eq('name', paymentData.name)
        .single();

      if (existing) {
        return ResponseHandler.error(res, 409, 'Payment option name already exists in this country');
      }

      // Validate logo_media_id if provided
      if (paymentData.logo_media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', paymentData.logo_media_id)
          .eq('purpose', 'payment_logo')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid logo media ID');
        }

        // Ensure media belongs to the correct country
        if (media.country_id !== paymentData.country_id) {
          return ResponseHandler.error(res, 400, 'Logo media must belong to the same country');
        }
      }

      // If setting as default, unset other defaults for this country and type
      if (paymentData.is_default) {
        await supabase
          .from('payment_options')
          .update({ is_default: false })
          .eq('country_id', paymentData.country_id)
          .eq('type', paymentData.type);
      }

      // Get max position for this country
      const { data: maxPos } = await supabase
        .from('payment_options')
        .select('position')
        .eq('country_id', paymentData.country_id)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      const position = maxPos ? maxPos.position + 1 : 0;

      const { data: paymentOption, error } = await supabase
        .from('payment_options')
        .insert([{
          ...paymentData,
          position,
          status: paymentData.status || PaymentOptionStatus.TESTING
        }])
        .select(`
          *,
          countries (
            name
          ),
          media:logo_media_id (
            url
          )
        `)
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 201, 'Payment option created successfully', {
        ...paymentOption,
        country_name: paymentOption.countries.name,
        logo_url: paymentOption.media?.url
      });
    } catch (error) {
      logger.error('Create payment option error:', error);
      ResponseHandler.error(res, 500, 'Failed to create payment option');
    }
  }

  static async updatePaymentOption(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: PaymentOptionUpdateDto = req.body;

      // Check access rights
      const { data: existingOption, error: fetchError } = await supabase
        .from('payment_options')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingOption) {
        return ResponseHandler.error(res, 404, 'Payment option not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (existingOption.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify payment option from different country');
        }
      }

      // Check if new name conflicts
      if (updateData.name && updateData.name !== existingOption.name) {
        const { data: existing } = await supabase
          .from('payment_options')
          .select('name')
          .eq('country_id', existingOption.country_id)
          .eq('name', updateData.name)
          .neq('id', id)
          .single();

        if (existing) {
          return ResponseHandler.error(res, 409, 'Payment option name already exists in this country');
        }
      }

      // Validate logo_media_id if provided
      if (updateData.logo_media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', updateData.logo_media_id)
          .eq('purpose', 'payment_logo')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid logo media ID');
        }

        // Ensure media belongs to the correct country
        if (media.country_id !== existingOption.country_id) {
          return ResponseHandler.error(res, 400, 'Logo media must belong to the same country');
        }
      }

      // If setting as default, unset other defaults
      if (updateData.is_default) {
        await supabase
          .from('payment_options')
          .update({ is_default: false })
          .eq('country_id', existingOption.country_id)
          .eq('type', existingOption.type)
          .neq('id', id);
      }

      const { data: paymentOption, error } = await supabase
        .from('payment_options')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          countries (
            name
          ),
          media:logo_media_id (
            url
          )
        `)
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Payment option updated successfully', {
        ...paymentOption,
        country_name: paymentOption.countries.name,
        logo_url: paymentOption.media?.url
      });
    } catch (error) {
      logger.error('Update payment option error:', error);
      ResponseHandler.error(res, 500, 'Failed to update payment option');
    }
  }

  static async deletePaymentOption(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check access rights
      const { data: paymentOption, error: fetchError } = await supabase
        .from('payment_options')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !paymentOption) {
        return ResponseHandler.error(res, 404, 'Payment option not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (paymentOption.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete payment option from different country');
        }
      }

      // Prevent deleting active default option
      if (paymentOption.is_default && paymentOption.status === PaymentOptionStatus.ACTIVE) {
        return ResponseHandler.error(
          res, 
          400, 
          'Cannot delete active default payment option. Make another option default first.'
        );
      }

      const { error } = await supabase
        .from('payment_options')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Payment option deleted successfully', null);
    } catch (error) {
      logger.error('Delete payment option error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete payment option');
    }
  }

  static async updatePosition(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { position } = req.body;

      if (typeof position !== 'number') {
        return ResponseHandler.error(res, 400, 'Position must be a number');
      }

      // Check access rights and get payment option
      const { data: paymentOption, error: fetchError } = await supabase
        .from('payment_options')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !paymentOption) {
        return ResponseHandler.error(res, 404, 'Payment option not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (paymentOption.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify payment option from different country');
        }
      }

      // Update position
      const { data: updatedOption, error } = await supabase
        .from('payment_options')
        .update({ position })
        .eq('id', id)
        .select(`
          *,
          countries (
            name
          ),
          media:logo_media_id (
            url
          )
        `)
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Payment option position updated successfully', {
        ...updatedOption,
        country_name: updatedOption.countries.name,
        logo_url: updatedOption.media?.url
      });
    } catch (error) {
      logger.error('Update payment option position error:', error);
      ResponseHandler.error(res, 500, 'Failed to update payment option position');
    }
  }
} 