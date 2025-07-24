import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  CityCreateDto, 
  CityUpdateDto, 
  CityQueryParams,
  ZoneCreateDto,
  ZoneUpdateDto,
  ZoneValidation,
  Zone
} from '../types/city.types';
import { AdminRole } from '../types/admin.types';
import logger from '../utils/logger';

export class CityController {
  private static validateZone(zone: ZoneCreateDto | ZoneUpdateDto): ZoneValidation {
    const errors = [];

    if ('name' in zone && (!zone.name || zone.name.trim().length < 2)) {
      errors.push({ field: 'name', message: 'Zone name must be at least 2 characters' });
    }

    if ('latitude' in zone) {
      if (typeof zone.latitude !== 'number' || zone.latitude < -90 || zone.latitude > 90) {
        errors.push({ field: 'latitude', message: 'Latitude must be between -90 and 90' });
      }
    }

    if ('longitude' in zone) {
      if (typeof zone.longitude !== 'number' || zone.longitude < -180 || zone.longitude > 180) {
        errors.push({ field: 'longitude', message: 'Longitude must be between -180 and 180' });
      }
    }

    if ('delivery_price' in zone) {
      if (typeof zone.delivery_price !== 'number' || zone.delivery_price < 0) {
        errors.push({ field: 'delivery_price', message: 'Delivery price must be a positive number' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static async getCities(req: Request, res: Response) {
    try {
      const {
        search,
        country_id,
        is_active,
        page = 1,
        limit = 10,
        sort_by = 'name',
        sort_order = 'desc'
      } = req.query as unknown as CityQueryParams;

      let query = supabase
        .from('cities')
        .select(`
          *,
          countries (
            name
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.ilike('name', `%${search}%`);
      }
      if (typeof is_active === 'boolean') {
        query = query.eq('is_active', is_active);
      }

      // Apply location-based access control
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id) {
          query = query.eq('country_id', req.admin.country_id);
        }
        if (req.admin?.city_id) {
          query = query.eq('id', req.admin.city_id);
        }
      } else if (country_id) {
        query = query.eq('country_id', country_id);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order(sort_by, { ascending: sort_order === 'asc' });

      const { data: cities, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);

      // Format response
      const cityResponses = cities?.map(city => ({
        ...city,
        country_name: city.countries.name
      }));

      ResponseHandler.success(res, 200, 'Cities retrieved successfully', {
        cities: cityResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get cities error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve cities');
    }
  }

  static async createCity(req: Request, res: Response) {
    try {
      const cityData: CityCreateDto = req.body;

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (cityData.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot create city for different country');
        }
      }

      // Check if city name exists in country
      const { data: existing } = await supabase
        .from('cities')
        .select('name')
        .eq('country_id', cityData.country_id)
        .eq('name', cityData.name)
        .single();

      if (existing) {
        return ResponseHandler.error(res, 409, 'City name already exists in this country');
      }

      const { data: city, error } = await supabase
        .from('cities')
        .insert([{
          ...cityData,
          zones: cityData.zones || [],
          is_active: true
        }])
        .select(`
          *,
          countries (
            name
          )
        `)
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 201, 'City created successfully', {
        ...city,
        country_name: city.countries.name
      });
    } catch (error) {
      logger.error('Create city error:', error);
      ResponseHandler.error(res, 500, 'Failed to create city');
    }
  }

  static async updateCity(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: CityUpdateDto = req.body;

      // Check access rights
      const { data: existingCity, error: fetchError } = await supabase
        .from('cities')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingCity) {
        return ResponseHandler.error(res, 404, 'City not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (existingCity.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify city from different country');
        }
        if (req.admin?.city_id && id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Can only modify assigned city');
        }
      }

      // Check if new name conflicts with existing city in same country
      if (updateData.name && updateData.name !== existingCity.name) {
        const { data: existing } = await supabase
          .from('cities')
          .select('name')
          .eq('country_id', existingCity.country_id)
          .eq('name', updateData.name)
          .neq('id', id)
          .single();

        if (existing) {
          return ResponseHandler.error(res, 409, 'City name already exists in this country');
        }
      }

      const { data: city, error } = await supabase
        .from('cities')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          countries (
            name
          )
        `)
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 200, 'City updated successfully', {
        ...city,
        country_name: city.countries.name
      });
    } catch (error) {
      logger.error('Update city error:', error);
      ResponseHandler.error(res, 500, 'Failed to update city');
    }
  }

  static async deleteCity(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check access rights and city existence
      const { data: city, error: fetchError } = await supabase
        .from('cities')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !city) {
        return ResponseHandler.error(res, 404, 'City not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (city.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete city from different country');
        }
      }

      const { error } = await supabase
        .from('cities')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'City deleted successfully', null);
    } catch (error) {
      logger.error('Delete city error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete city');
    }
  }

  static async addZone(req: Request, res: Response) {
    try {
      const { cityId } = req.params;
      const zoneData: ZoneCreateDto = req.body;

      // Check access rights
      const { data: city, error: fetchError } = await supabase
        .from('cities')
        .select('*')
        .eq('id', cityId)
        .single();

      if (fetchError || !city) {
        return ResponseHandler.error(res, 404, 'City not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (city.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify city from different country');
        }
        if (req.admin?.city_id && cityId !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Can only modify assigned city');
        }
      }

      // Validate zone data
      const validation = CityController.validateZone(zoneData);
      if (!validation.isValid) {
        return ResponseHandler.error(res, 400, 'Invalid zone data');
      }

      // Check if zone name exists in city
      const existingZones = city.zones || [];
      if (existingZones.some((z: Zone) => z.name === zoneData.name)) {
        return ResponseHandler.error(res, 409, 'Zone name already exists in this city');
      }

      // Add new zone
      const newZone = {
        id: crypto.randomUUID(),
        ...zoneData
      };

      const { data: updatedCity, error } = await supabase
        .from('cities')
        .update({
          zones: [...existingZones, newZone]
        })
        .eq('id', cityId)
        .select()
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 201, 'Zone added successfully', newZone);
    } catch (error) {
      logger.error('Add zone error:', error);
      ResponseHandler.error(res, 500, 'Failed to add zone');
    }
  }

  static async updateZone(req: Request, res: Response) {
    try {
      const { cityId, zoneId } = req.params;
      const zoneData: ZoneUpdateDto = req.body;

      // Check access rights
      const { data: city, error: fetchError } = await supabase
        .from('cities')
        .select('*')
        .eq('id', cityId)
        .single();

      if (fetchError || !city) {
        return ResponseHandler.error(res, 404, 'City not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (city.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify city from different country');
        }
        if (req.admin?.city_id && cityId !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Can only modify assigned city');
        }
      }

      // Validate zone data
      const validation = CityController.validateZone(zoneData);
      if (!validation.isValid) {
        return ResponseHandler.error(res, 400, 'Invalid zone data');
      }

      // Find and update zone
      const zones = city.zones || [];
      const zoneIndex = zones.findIndex((z: Zone) => z.id === zoneId);

      if (zoneIndex === -1) {
        return ResponseHandler.error(res, 404, 'Zone not found');
      }

      // Check if new name conflicts with existing zones
      if (zoneData.name && zoneData.name !== zones[zoneIndex].name) {
        if (zones.some((z: Zone, i: number) => i !== zoneIndex && z.name === zoneData.name)) {
          return ResponseHandler.error(res, 409, 'Zone name already exists in this city');
        }
      }

      // Update zone
      const updatedZone = {
        ...zones[zoneIndex],
        ...zoneData
      };
      zones[zoneIndex] = updatedZone;

      const { data: updatedCity, error } = await supabase
        .from('cities')
        .update({ zones })
        .eq('id', cityId)
        .select()
        .single();

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Zone updated successfully', updatedZone);
    } catch (error) {
      logger.error('Update zone error:', error);
      ResponseHandler.error(res, 500, 'Failed to update zone');
    }
  }

  static async deleteZone(req: Request, res: Response) {
    try {
      const { cityId, zoneId } = req.params;

      // Check access rights
      const { data: city, error: fetchError } = await supabase
        .from('cities')
        .select('*')
        .eq('id', cityId)
        .single();

      if (fetchError || !city) {
        return ResponseHandler.error(res, 404, 'City not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (city.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify city from different country');
        }
        if (req.admin?.city_id && cityId !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Can only modify assigned city');
        }
      }

      // Remove zone
      const zones = city.zones || [];
      const updatedZones = zones.filter((z: Zone) => z.id !== zoneId);

      if (zones.length === updatedZones.length) {
        return ResponseHandler.error(res, 404, 'Zone not found');
      }

      const { error } = await supabase
        .from('cities')
        .update({ zones: updatedZones })
        .eq('id', cityId);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Zone deleted successfully', null);
    } catch (error) {
      logger.error('Delete zone error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete zone');
    }
  }

  static async getZones(req: Request, res: Response) {
    try {
      const { cityId } = req.params;

      // Check access rights and get city
      const { data: city, error: fetchError } = await supabase
        .from('cities')
        .select('*')
        .eq('id', cityId)
        .single();

      if (fetchError || !city) {
        return ResponseHandler.error(res, 404, 'City not found');
      }

      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (city.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot access city from different country');
        }
      }

      ResponseHandler.success(res, 200, 'Zones retrieved successfully', city.zones || []);
    } catch (error) {
      logger.error('Get zones error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve zones');
    }
  }
} 