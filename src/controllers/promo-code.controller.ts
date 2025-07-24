import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  PromoCodeCreateDto, 
  PromoCodeUpdateDto, 
  PromoCodeQueryParams,
  PromoCodeValidationResult,
  PromoCodeType
} from '../types/promo-code.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class PromoCodeController {
  private static validatePromoCode(
    data: PromoCodeCreateDto | PromoCodeUpdateDto,
    isUpdate = false
  ): PromoCodeValidationResult {
    const errors = [];

    if (!isUpdate) {
      if (!data.code || data.code.trim().length < 3) {
        errors.push({ field: 'code', message: 'Code must be at least 3 characters' });
      }
      if (!data.country_id) {
        errors.push({ field: 'country_id', message: 'Country is required' });
      }
    }

    if ('discount_amount' in data && data.discount_amount !== undefined) {
      if (data.discount_amount <= 0) {
        errors.push({ field: 'discount_amount', message: 'Discount amount must be greater than 0' });
      }
      if (data.type === PromoCodeType.PERCENTAGE && data.discount_amount > 100) {
        errors.push({ field: 'discount_amount', message: 'Percentage discount cannot exceed 100%' });
      }
    }

    if ('minimum_order_amount' in data && data.minimum_order_amount !== undefined) {
      if (data.minimum_order_amount <= 0) {
        errors.push({ field: 'minimum_order_amount', message: 'Minimum order amount must be greater than 0' });
      }
    }

    if ('maximum_discount' in data && data.maximum_discount !== undefined) {
      if (data.maximum_discount <= 0) {
        errors.push({ field: 'maximum_discount', message: 'Maximum discount must be greater than 0' });
      }
      if (data.type === PromoCodeType.FIXED && data.discount_amount && data.maximum_discount < data.discount_amount) {
        errors.push({ field: 'maximum_discount', message: 'Maximum discount cannot be less than discount amount for fixed discounts' });
      }
    }

    if ('usage_limit' in data && data.usage_limit !== undefined && data.usage_limit <= 0) {
      errors.push({ field: 'usage_limit', message: 'Usage limit must be greater than 0' });
    }

    if ('start_date' in data && data.start_date && 'end_date' in data && data.end_date) {
      if (new Date(data.start_date) >= new Date(data.end_date)) {
        errors.push({ field: 'dates', message: 'Start date must be before end date' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static async getPromoCodes(req: Request, res: Response) {
    try {
      const {
        search,
        country_id,
        city_id,
        type,
        is_active,
        is_expired,
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query as unknown as PromoCodeQueryParams;

      let query = supabase
        .from('promo_codes')
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`code.ilike.%${search}%,description.ilike.%${search}%`);
      }
      if (type) {
        query = query.eq('type', type);
      }
      if (typeof is_active === 'boolean') {
        query = query.eq('is_active', is_active);
      }
      if (is_expired === true) {
        query = query.lt('end_date', new Date().toISOString());
      } else if (is_expired === false) {
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

      const { data: promoCodes, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);
      const now = new Date();

      // Format response
      const promoCodeResponses = promoCodes?.map(code => ({
        ...code,
        country_name: code.countries.name,
        city_name: code.cities?.name,
        is_expired: code.end_date ? new Date(code.end_date) < now : false,
        is_started: code.start_date ? new Date(code.start_date) <= now : true,
        is_limit_reached: code.usage_limit ? code.used_count >= code.usage_limit : false
      }));

      ResponseHandler.success(res, 200, 'Promo codes retrieved successfully', {
        promo_codes: promoCodeResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get promo codes error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve promo codes');
    }
  }

  static async createPromoCode(req: Request, res: Response) {
    try {
      const promoData: PromoCodeCreateDto = req.body;

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (promoData.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot create promo code for different country');
        }
        if (promoData.city_id && promoData.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot create promo code for different city');
        }
      }

      // Validate promo code data
      const validation = PromoCodeController.validatePromoCode(promoData);
      if (!validation.isValid) {
        return ResponseHandler.error(res, 400, 'Invalid promo code data');
      }

      // Check if code exists in country/city
      const { data: existing } = await supabase
        .from('promo_codes')
        .select('code')
        .eq('country_id', promoData.country_id)
        .eq('code', promoData.code)
        .is('city_id', promoData.city_id || null)
        .single();

      if (existing) {
        return ResponseHandler.error(res, 409, 'Promo code already exists for this location');
      }

      const { data: promoCode, error } = await supabase
        .from('promo_codes')
        .insert([{
          ...promoData,
          type: promoData.type || PromoCodeType.FIXED,
          used_count: 0
        }])
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          )
        `)
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 201, 'Promo code created successfully', {
        ...promoCode,
        country_name: promoCode.countries.name,
        city_name: promoCode.cities?.name,
        is_expired: false,
        is_started: !promoCode.start_date || new Date(promoCode.start_date) <= new Date(),
        is_limit_reached: false
      });
    } catch (error) {
      logger.error('Create promo code error:', error);
      ResponseHandler.error(res, 500, 'Failed to create promo code');
    }
  }

  static async updatePromoCode(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: PromoCodeUpdateDto = req.body;

      // Check access rights
      const { data: existingCode, error: fetchError } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingCode) {
        return ResponseHandler.error(res, 404, 'Promo code not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (existingCode.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify promo code from different country');
        }
        if (existingCode.city_id && existingCode.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify promo code from different city');
        }
      }

      // Validate update data
      const validation = PromoCodeController.validatePromoCode(updateData, true);
      if (!validation.isValid) {
        return ResponseHandler.error(res, 400, 'Invalid promo code data');
      }

      // Check if new code conflicts
      if (updateData.code && updateData.code !== existingCode.code) {
        const { data: existing } = await supabase
          .from('promo_codes')
          .select('code')
          .eq('country_id', existingCode.country_id)
          .eq('code', updateData.code)
          .is('city_id', existingCode.city_id)
          .neq('id', id)
          .single();

        if (existing) {
          return ResponseHandler.error(res, 409, 'Promo code already exists for this location');
        }
      }

      const { data: promoCode, error } = await supabase
        .from('promo_codes')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          )
        `)
        .single();

      if (error) throw error;

      const now = new Date();
      ResponseHandler.success(res, 200, 'Promo code updated successfully', {
        ...promoCode,
        country_name: promoCode.countries.name,
        city_name: promoCode.cities?.name,
        is_expired: promoCode.end_date ? new Date(promoCode.end_date) < now : false,
        is_started: promoCode.start_date ? new Date(promoCode.start_date) <= now : true,
        is_limit_reached: promoCode.usage_limit ? promoCode.used_count >= promoCode.usage_limit : false
      });
    } catch (error) {
      logger.error('Update promo code error:', error);
      ResponseHandler.error(res, 500, 'Failed to update promo code');
    }
  }

  static async deletePromoCode(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check access rights
      const { data: promoCode, error: fetchError } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !promoCode) {
        return ResponseHandler.error(res, 404, 'Promo code not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (promoCode.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete promo code from different country');
        }
        if (promoCode.city_id && promoCode.city_id !== req.admin?.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete promo code from different city');
        }
      }

      // Check if promo code has been used
      if (promoCode.used_count > 0) {
        return ResponseHandler.error(
          res, 
          400, 
          'Cannot delete promo code that has been used. Deactivate it instead.'
        );
      }

      const { error } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Promo code deleted successfully', null);
    } catch (error) {
      logger.error('Delete promo code error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete promo code');
    }
  }
} 