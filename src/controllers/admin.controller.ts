import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  AdminRole, 
  AdminLoginDto, 
  AdminCreateDto, 
  AdminUpdateDto,
  AdminQueryParams,
  AdminResponse,
  PaginatedAdminResponse
} from '../types/admin.types';
import logger from '../utils/logger';

export class AdminController {
  private static readonly SALT_ROUNDS = 10;
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private static readonly JWT_EXPIRES_IN = '24h';

  static async login(req: Request, res: Response) {
    try {
      console.log('=== CONTROLLER DEBUG ===');
      console.log('req.body:', req.body);
      console.log('req.body type:', typeof req.body);
      console.log('req.body keys:', Object.keys(req.body || {}));
      console.log('req.headers:', req.headers);
      console.log('content-type:', req.headers['content-type']);
      console.log('========================');
      
      const { username, password }: AdminLoginDto = req.body;
      
      const { data: admin, error } = await supabase
        .from('admins')
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          media:photo_media_id (
            url
          )
        `)
        .eq('username', username)
        .eq('is_active', true)
        .single();

      console.log('=== CONTROLLER DEBUG ===');
      console.log('admin:', admin);
      console.log('error:', error);
      console.log('========================');

      if (error || !admin) {
        return ResponseHandler.error(res, 401, 'Invalid credentials');
      }

      const isValidPassword = await bcrypt.compare(password, admin.password);
      if (!isValidPassword) {
        return ResponseHandler.error(res, 401, 'Invalid credentials');
      }

      // Update last login timestamp
      await supabase
        .from('admins')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', admin.id);

      const token = jwt.sign(
        { 
          id: admin.id, 
          role: admin.role,
          country_id: admin.country_id,
          city_id: admin.city_id
        },
        AdminController.JWT_SECRET,
        { expiresIn: AdminController.JWT_EXPIRES_IN }
      );

      const adminResponse: AdminResponse = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        country_id: admin.country_id,
        country_name: admin.countries?.name,
        city_id: admin.city_id,
        city_name: admin.cities?.name,
        full_name: admin.full_name,
        phone_number: admin.phone_number,
        photo_media_id: admin.photo_media_id,
        photo_url: admin.media?.url,
        is_active: admin.is_active,
        last_login_at: admin.last_login_at,
        created_at: admin.created_at,
        updated_at: admin.updated_at
      };

      ResponseHandler.success(res, 200, 'Login successful', {
        admin: adminResponse,
        token
      });
    } catch (error) {
      logger.error('Login error:', error);
      ResponseHandler.error(res, 500, 'Login failed');
    }
  }

  static async getAllAdmins(req: Request, res: Response) {
    try {
      const {
        search,
        role,
        country_id,
        city_id,
        is_active,
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query as unknown as AdminQueryParams;

      let query = supabase
        .from('admins')
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          media:photo_media_id (
            url
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(
          `username.ilike.%${search}%,` +
          `email.ilike.%${search}%,` +
          `full_name.ilike.%${search}%`
        );
      }
      if (role) query = query.eq('role', role);
      if (typeof is_active === 'boolean') query = query.eq('is_active', is_active);

      // Apply access control based on requesting admin's role and location
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id) {
          query = query.eq('country_id', req.admin.country_id);
        }
        if (req.admin?.city_id) {
          query = query.eq('city_id', req.admin.city_id);
        }
      } else {
        // Super admin can filter by location if requested
        if (country_id) query = query.eq('country_id', country_id);
        if (city_id) query = query.eq('city_id', city_id);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      // Apply sorting
      query = query.range(from, to).order(sort_by, { ascending: sort_order === 'asc' });

      const { data: admins, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);

      // Format response
      const adminResponses = admins?.map(admin => ({
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        country_id: admin.country_id,
        country_name: admin.countries?.name,
        city_id: admin.city_id,
        city_name: admin.cities?.name,
        full_name: admin.full_name,
        phone_number: admin.phone_number,
        photo_media_id: admin.photo_media_id,
        photo_url: admin.media?.url,
        is_active: admin.is_active,
        last_login_at: admin.last_login_at,
        created_at: admin.created_at,
        updated_at: admin.updated_at
      })) || [];

      const response: PaginatedAdminResponse = {
        admins: adminResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      };

      ResponseHandler.success(res, 200, 'Admins retrieved successfully', response);
    } catch (error) {
      logger.error('Get all admins error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve admins');
    }
  }

  static async createAdmin(req: Request, res: Response) {
    try {
      const adminData: AdminCreateDto = req.body;

      // Check if username exists
      const { data: existing } = await supabase
        .from('admins')
        .select('username')
        .eq('username', adminData.username)
        .single();

      if (existing) {
        return ResponseHandler.error(res, 409, 'Username already exists');
      }

      // Validate country and city access
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        // Regular admins can only create for their country/city
        if (adminData.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot create admin for different country');
        }
        if (req.admin?.city_id && adminData.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot create admin for different city');
        }
        // Regular admins cannot create super admins
        if (adminData.role === AdminRole.SUPER_ADMIN) {
          return ResponseHandler.error(res, 403, 'Cannot create super admin');
        }
      }

      // Validate photo_media_id if provided
      if (adminData.photo_media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', adminData.photo_media_id)
          .eq('purpose', 'profile_photo')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid photo media ID');
        }

        // Ensure media belongs to the correct country
        if (media.country_id !== adminData.country_id) {
          return ResponseHandler.error(res, 400, 'Photo media must belong to the same country');
        }
      }

      const hashedPassword = await bcrypt.hash(
        adminData.password,
        AdminController.SALT_ROUNDS
      );

      const { data: newAdmin, error } = await supabase
        .from('admins')
        .insert([{
          ...adminData,
          password: hashedPassword,
          is_active: true
        }])
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          media:photo_media_id (
            url
          )
        `)
        .single();

      if (error) throw error;

      const adminResponse: AdminResponse = {
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        country_id: newAdmin.country_id,
        country_name: newAdmin.countries?.name,
        city_id: newAdmin.city_id,
        city_name: newAdmin.cities?.name,
        full_name: newAdmin.full_name,
        phone_number: newAdmin.phone_number,
        photo_media_id: newAdmin.photo_media_id,
        photo_url: newAdmin.media?.url,
        is_active: newAdmin.is_active,
        last_login_at: newAdmin.last_login_at,
        created_at: newAdmin.created_at,
        updated_at: newAdmin.updated_at
      };

      ResponseHandler.success(res, 201, 'Admin created successfully', adminResponse);
    } catch (error) {
      logger.error('Create admin error:', error);
      ResponseHandler.error(res, 500, 'Failed to create admin');
    }
  }

  static async updateAdmin(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData: AdminUpdateDto = req.body;

      // Check access rights
      const { data: existingAdmin, error: fetchError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingAdmin) {
        return ResponseHandler.error(res, 404, 'Admin not found');
      }

      // Access control checks
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        // Cannot update super admin
        if (existingAdmin.role === AdminRole.SUPER_ADMIN) {
          return ResponseHandler.error(res, 403, 'Cannot modify super admin');
        }
        // Cannot update admin from different country
        if (existingAdmin.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify admin from different country');
        }
        // City admin can only update their city's admins
        if (req.admin?.city_id && existingAdmin.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify admin from different city');
        }
        // Cannot change country or make someone super admin
        if (updateData.country_id || updateData.role === AdminRole.SUPER_ADMIN) {
          return ResponseHandler.error(res, 403, 'Invalid update parameters');
        }
      }

      // If updating username, check if it exists
      if (updateData.username) {
        const { data: existing } = await supabase
          .from('admins')
          .select('username')
          .eq('username', updateData.username)
          .neq('id', id)
          .single();

        if (existing) {
          return ResponseHandler.error(res, 409, 'Username already exists');
        }
      }

      // Validate photo_media_id if provided
      if (updateData.photo_media_id) {
        const { data: media, error: mediaError } = await supabase
          .from('media')
          .select('*')
          .eq('id', updateData.photo_media_id)
          .eq('purpose', 'profile_photo')
          .single();

        if (mediaError || !media) {
          return ResponseHandler.error(res, 400, 'Invalid photo media ID');
        }

        // Ensure media belongs to the correct country
        if (media.country_id !== existingAdmin.country_id) {
          return ResponseHandler.error(res, 400, 'Photo media must belong to the same country');
        }
      }

      // Hash password if it's being updated
      if (updateData.password) {
        updateData.password = await bcrypt.hash(
          updateData.password,
          AdminController.SALT_ROUNDS
        );
      }

      const { data: updatedAdmin, error } = await supabase
        .from('admins')
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
          media:photo_media_id (
            url
          )
        `)
        .single();

      if (error) throw error;

      const adminResponse: AdminResponse = {
        id: updatedAdmin.id,
        username: updatedAdmin.username,
        email: updatedAdmin.email,
        role: updatedAdmin.role,
        country_id: updatedAdmin.country_id,
        country_name: updatedAdmin.countries?.name,
        city_id: updatedAdmin.city_id,
        city_name: updatedAdmin.cities?.name,
        full_name: updatedAdmin.full_name,
        phone_number: updatedAdmin.phone_number,
        photo_media_id: updatedAdmin.photo_media_id,
        photo_url: updatedAdmin.media?.url,
        is_active: updatedAdmin.is_active,
        last_login_at: updatedAdmin.last_login_at,
        created_at: updatedAdmin.created_at,
        updated_at: updatedAdmin.updated_at
      };

      ResponseHandler.success(res, 200, 'Admin updated successfully', adminResponse);
    } catch (error) {
      logger.error('Update admin error:', error);
      ResponseHandler.error(res, 500, 'Failed to update admin');
    }
  }

  static async deleteAdmin(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check access rights
      const { data: adminToDelete, error: fetchError } = await supabase
        .from('admins')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !adminToDelete) {
        return ResponseHandler.error(res, 404, 'Admin not found');
      }

      // Access control checks
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        // Cannot delete super admin
        if (adminToDelete.role === AdminRole.SUPER_ADMIN) {
          return ResponseHandler.error(res, 403, 'Cannot delete super admin');
        }
        // Cannot delete admin from different country
        if (adminToDelete.country_id !== req.admin?.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete admin from different country');
        }
        // City admin can only delete their city's admins
        if (req.admin?.city_id && adminToDelete.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete admin from different city');
        }
      }

      // Prevent self-deletion
      if (id === req.admin?.id) {
        return ResponseHandler.error(res, 400, 'Cannot delete your own account');
      }

      const { error } = await supabase
        .from('admins')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Admin deleted successfully', null);
    } catch (error) {
      logger.error('Delete admin error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete admin');
    }
  }

  static async getProfile(req: Request, res: Response) {
    try {
      const adminId = req.admin?.id;

      const { data: admin, error } = await supabase
        .from('admins')
        .select(`
          *,
          countries (
            name
          ),
          cities (
            name
          ),
          media:photo_media_id (
            url
          )
        `)
        .eq('id', adminId)
        .single();

      if (error || !admin) {
        return ResponseHandler.error(res, 404, 'Admin not found');
      }

      const adminResponse: AdminResponse = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        country_id: admin.country_id,
        country_name: admin.countries?.name,
        city_id: admin.city_id,
        city_name: admin.cities?.name,
        full_name: admin.full_name,
        phone_number: admin.phone_number,
        photo_media_id: admin.photo_media_id,
        photo_url: admin.media?.url,
        is_active: admin.is_active,
        last_login_at: admin.last_login_at,
        created_at: admin.created_at,
        updated_at: admin.updated_at
      };

      ResponseHandler.success(res, 200, 'Profile retrieved successfully', adminResponse);
    } catch (error) {
      logger.error('Get profile error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve profile');
    }
  }
} 