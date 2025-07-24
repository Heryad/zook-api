import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  CountryCreateDto, 
  CountryUpdateDto, 
  CountryQueryParams 
} from '../types/country.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class CountryController {
  static async getCountries(req: Request, res: Response) {
    try {
      const {
        search,
        is_active,
        page = 1,
        limit = 10,
        sort_by = 'name',
        sort_order = 'desc'
      } = req.query as unknown as CountryQueryParams;

      let query = supabase
        .from('countries')
        .select(`
          *,
          cities:cities(count),
          admins:admins(count),
          users:users(count)
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
      }
      if (typeof is_active === 'boolean') {
        query = query.eq('is_active', is_active);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order(sort_by, { ascending: sort_order === 'asc' });

      const { data: countries, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);

      // Format response
      const countryResponses = countries?.map(country => ({
        ...country,
        total_cities: country.cities[0].count,
        total_admins: country.admins[0].count,
        total_users: country.users[0].count
      }));

      ResponseHandler.success(res, 200, 'Countries retrieved successfully', {
        countries: countryResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get countries error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve countries');
    }
  }

  static async createCountry(req: Request, res: Response) {
    try {
      const countryData: CountryCreateDto = req.body;

      // Only super admin can create countries
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        return ResponseHandler.error(res, 403, 'Only super admin can create countries');
      }

      // Check if country code exists
      const { data: existing } = await supabase
        .from('countries')
        .select('code')
        .eq('code', countryData.code)
        .single();

      if (existing) {
        return ResponseHandler.error(res, 409, 'Country code already exists');
      }

      const { data: country, error } = await supabase
        .from('countries')
        .insert([{
          ...countryData,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 201, 'Country created successfully', country);
    } catch (error) {
      logger.error('Create country error:', error);
      ResponseHandler.error(res, 500, 'Failed to create country');
    }
  }

  static async updateCountry(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: CountryUpdateDto = req.body;

      // Only super admin can update countries
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        return ResponseHandler.error(res, 403, 'Only super admin can update countries');
      }

      // Check if country exists
      const { data: existingCountry, error: fetchError } = await supabase
        .from('countries')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingCountry) {
        return ResponseHandler.error(res, 404, 'Country not found');
      }

      const { data: country, error } = await supabase
        .from('countries')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Country updated successfully', country);
    } catch (error) {
      logger.error('Update country error:', error);
      ResponseHandler.error(res, 500, 'Failed to update country');
    }
  }

  static async deleteCountry(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Only super admin can delete countries
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        return ResponseHandler.error(res, 403, 'Only super admin can delete countries');
      }

      // Check if country exists and get its dependencies
      const { data: country, error: fetchError } = await supabase
        .from('countries')
        .select(`
          *,
          cities:cities(count),
          admins:admins(count),
          users:users(count)
        `)
        .eq('id', id)
        .single();

      if (fetchError || !country) {
        return ResponseHandler.error(res, 404, 'Country not found');
      }

      // Check for dependencies
      const hasDependencies = 
        country.cities[0].count > 0 || 
        country.admins[0].count > 0 || 
        country.users[0].count > 0;

      if (hasDependencies) {
        return ResponseHandler.error(
          res, 
          400, 
          'Cannot delete country with existing cities, admins, or users. Deactivate it instead.'
        );
      }

      const { error } = await supabase
        .from('countries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Country deleted successfully', null);
    } catch (error) {
      logger.error('Delete country error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete country');
    }
  }

  static async getCountryDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { data: country, error } = await supabase
        .from('countries')
        .select(`
          *,
          cities:cities(count),
          admins:admins(count),
          users:users(count)
        `)
        .eq('id', id)
        .single();

      if (error || !country) {
        return ResponseHandler.error(res, 404, 'Country not found');
      }

      ResponseHandler.success(res, 200, 'Country details retrieved successfully', {
        ...country,
        total_cities: country.cities[0].count,
        total_admins: country.admins[0].count,
        total_users: country.users[0].count
      });
    } catch (error) {
      logger.error('Get country details error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve country details');
    }
  }
} 