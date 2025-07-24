import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { ResponseHandler } from '../utils/responseHandler';
import { 
  OrderCreateDto, 
  OrderUpdateDto, 
  OrderQueryParams,
  OrderStatus,
  PaymentStatus
} from '../types/order.types';
import { AdminRole } from '../types/admin.types';
import { PaymentService } from '../services/payment.service';
import logger from '../utils/logger';

export class OrderController {
  static async getOrders(req: Request, res: Response) {
    try {
      const {
        search,
        user_id,
        store_id,
        driver_id,
        payment_status,
        order_status,
        start_date,
        end_date,
        page = 1,
        limit = 10,
        sort_by = 'created_at',
        sort_order = 'desc'
      } = req.query as unknown as OrderQueryParams;

      let query = supabase
        .from('orders')
        .select(`
          *,
          stores (
            name
          ),
          drivers (
            name
          ),
          payment_options (
            *
          ),
          promo_codes (
            *
          )
        `, { count: 'exact' });

      // Apply filters
      if (search) {
        query = query.or(`id.ilike.%${search}%,extra_note.ilike.%${search}%`);
      }
      if (user_id) {
        query = query.eq('user_id', user_id);
      }
      if (store_id) {
        query = query.eq('store_id', store_id);
      }
      if (driver_id) {
        query = query.eq('driver_id', driver_id);
      }
      if (payment_status) {
        query = query.eq('payment_status', payment_status);
      }
      if (order_status) {
        query = query.eq('order_status', order_status);
      }
      if (start_date) {
        query = query.gte('created_at', start_date);
      }
      if (end_date) {
        query = query.lte('created_at', end_date);
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

      const { data: orders, error, count } = await query;

      if (error) throw error;

      const totalPages = Math.ceil((count || 0) / limit);

      // Format response
      const orderResponses = orders?.map(order => ({
        ...order,
        store_name: order.stores?.name,
        driver_name: order.drivers?.name,
        payment_option: order.payment_options,
        promo_code: order.promo_codes
      }));

      ResponseHandler.success(res, 200, 'Orders retrieved successfully', {
        orders: orderResponses,
        total: count || 0,
        page,
        limit,
        totalPages
      });
    } catch (error) {
      logger.error('Get orders error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve orders');
    }
  }

  static async getOrderById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          stores (
            name
          ),
          drivers (
            name
          ),
          payment_options (
            *
          ),
          promo_codes (
            *
          )
        `)
        .eq('id', id)
        .single();

      if (error || !order) {
        return ResponseHandler.error(res, 404, 'Order not found');
      }

      // Format response
      const response = {
        ...order,
        store_name: order.stores?.name,
        driver_name: order.drivers?.name,
        payment_option: order.payment_options,
        promo_code: order.promo_codes
      };

      ResponseHandler.success(res, 200, 'Order retrieved successfully', response);
    } catch (error) {
      logger.error('Get order error:', error);
      ResponseHandler.error(res, 500, 'Failed to retrieve order');
    }
  }

  static async createOrder(req: Request, res: Response) {
    try {
      const data: OrderCreateDto = req.body;

      // Validate store
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, is_active, is_busy')
        .eq('id', data.store_id)
        .single();

      if (storeError || !store) {
        return ResponseHandler.error(res, 400, 'Invalid store ID');
      }

      if (!store.is_active) {
        return ResponseHandler.error(res, 400, 'Store is not active');
      }

      if (store.is_busy) {
        return ResponseHandler.error(res, 400, 'Store is currently busy');
      }

      // Validate payment option if provided
      if (data.payment_option_id) {
        const { data: paymentOption, error: paymentError } = await supabase
          .from('payment_options')
          .select('id')
          .eq('id', data.payment_option_id)
          .eq('is_active', true)
          .single();

        if (paymentError || !paymentOption) {
          return ResponseHandler.error(res, 400, 'Invalid payment option ID');
        }
      }

      // Validate promo code if provided
      if (data.promo_code_id) {
        const { data: promoCode, error: promoError } = await supabase
          .from('promo_codes')
          .select('*')
          .eq('id', data.promo_code_id)
          .eq('is_active', true)
          .single();

        if (promoError || !promoCode) {
          return ResponseHandler.error(res, 400, 'Invalid promo code ID');
        }

        const now = new Date();
        if (promoCode.start_date && new Date(promoCode.start_date) > now) {
          return ResponseHandler.error(res, 400, 'Promo code is not yet active');
        }
        if (promoCode.end_date && new Date(promoCode.end_date) < now) {
          return ResponseHandler.error(res, 400, 'Promo code has expired');
        }
      }

      // Validate and get items details
      const itemIds = data.items.map(item => item.id);
      const { data: storeItems, error: itemsError } = await supabase
        .from('store_items')
        .select('id, name, price, options, extras')
        .in('id', itemIds)
        .eq('store_id', data.store_id)
        .eq('is_active', true);

      if (itemsError || !storeItems || storeItems.length !== itemIds.length) {
        return ResponseHandler.error(res, 400, 'Invalid item IDs');
      }

      // Calculate totals and prepare items array
      let totalItemQuantity = 0;
      let totalItemPrice = 0;
      const items = data.items.map(orderItem => {
        const storeItem = storeItems.find(item => item.id === orderItem.id)!;
        
        // Validate options
        if (orderItem.options) {
          const validOptions = orderItem.options.every(opt => 
            storeItem.options.some((itemOpt: any) => 
              itemOpt.items.some((item: any) => item.name === opt.name)
            )
          );
          if (!validOptions) {
            throw new Error(`Invalid options for item ${storeItem.name}`);
          }
        }

        // Validate and calculate extras
        let extrasCost = 0;
        if (orderItem.extras) {
          const validExtras = orderItem.extras.every(ext => {
            const storeExtra = storeItem.extras.find((e: any) => e.name === ext.name);
            return storeExtra && storeExtra.price === ext.price;
          });
          if (!validExtras) {
            throw new Error(`Invalid extras for item ${storeItem.name}`);
          }
          extrasCost = orderItem.extras.reduce((sum, ext) => sum + ext.price, 0);
        }

        totalItemQuantity += orderItem.quantity;
        const itemTotal = (storeItem.price + extrasCost) * orderItem.quantity;
        totalItemPrice += itemTotal;

        return {
          id: storeItem.id,
          name: storeItem.name,
          quantity: orderItem.quantity,
          options: orderItem.options || [],
          extras: orderItem.extras || []
        };
      });

      // Calculate discount if promo code provided
      let discountAmount = 0;
      if (data.promo_code_id) {
        const { data: promoCode } = await supabase
          .from('promo_codes')
          .select('*')
          .eq('id', data.promo_code_id)
          .single();

        if (promoCode) {
          discountAmount = promoCode.discount_type === 'percentage'
            ? (totalItemPrice * promoCode.discount_value / 100)
            : promoCode.discount_value;

          if (promoCode.max_discount) {
            discountAmount = Math.min(discountAmount, promoCode.max_discount);
          }
        }
      }

      const finalPrice = totalItemPrice - discountAmount;

      // Generate a temporary order ID for payment validation
      const tempOrderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Validate payment
      const paymentValidation = await PaymentService.validatePayment({
        amount: finalPrice,
        paymentOptionId: data.payment_option_id,
        userId: data.user_id,
        orderId: tempOrderId
      });

      // Create order with appropriate status based on payment validation
      const orderStatus: OrderStatus = paymentValidation.success ? 'pending' : 'cancelled';
      const paymentStatus: PaymentStatus = paymentValidation.status;

      // Create order
      const { data: order, error } = await supabase
        .from('orders')
        .insert([{
          user_id: data.user_id,
          store_id: data.store_id,
          payment_option_id: data.payment_option_id,
          promo_code_id: data.promo_code_id,
          items,
          total_item_quantity: totalItemQuantity,
          total_item_price: totalItemPrice,
          discount_amount: discountAmount,
          final_price: finalPrice,
          extra_note: data.extra_note,
          delivery_address: data.delivery_address,
          payment_status: paymentStatus,
          order_status: orderStatus,
          transaction_id: paymentValidation.transactionId
        }])
        .select(`
          *,
          stores (
            name
          ),
          payment_options (
            *
          ),
          promo_codes (
            *
          )
        `)
        .single();

      if (error) throw error;

      // Format response
      const response = {
        ...order,
        store_name: order.stores?.name,
        payment_option: order.payment_options,
        promo_code: order.promo_codes,
        payment_validation: {
          success: paymentValidation.success,
          message: paymentValidation.message
        }
      };

      ResponseHandler.success(
        res, 
        201, 
        paymentValidation.success ? 'Order created successfully' : 'Order created but payment failed',
        response
      );
    } catch (error) {
      logger.error('Create order error:', error);
      if (error instanceof Error) {
        ResponseHandler.error(res, 400, error.message);
      } else {
        ResponseHandler.error(res, 500, 'Failed to create order');
      }
    }
  }

  static async updateOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: OrderUpdateDto = req.body;

      // Check if order exists and get store details
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !existingOrder) {
        return ResponseHandler.error(res, 404, 'Order not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && existingOrder.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify order from different country');
        }
        if (req.admin?.city_id && existingOrder.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify order from different city');
        }
      }

      // Validate payment option if provided
      if (data.payment_option_id) {
        const { data: paymentOption, error: paymentError } = await supabase
          .from('payment_options')
          .select('id')
          .eq('id', data.payment_option_id)
          .eq('is_active', true)
          .single();

        if (paymentError || !paymentOption) {
          return ResponseHandler.error(res, 400, 'Invalid payment option ID');
        }
      }

      // Update order
      const { data: order, error } = await supabase
        .from('orders')
        .update(data)
        .eq('id', id)
        .select(`
          *,
          stores (
            name
          ),
          drivers (
            name
          ),
          payment_options (
            *
          ),
          promo_codes (
            *
          )
        `)
        .single();

      if (error) throw error;

      // Format response
      const response = {
        ...order,
        store_name: order.stores?.name,
        driver_name: order.drivers?.name,
        payment_option: order.payment_options,
        promo_code: order.promo_codes
      };

      ResponseHandler.success(res, 200, 'Order updated successfully', response);
    } catch (error) {
      logger.error('Update order error:', error);
      ResponseHandler.error(res, 500, 'Failed to update order');
    }
  }

  static async assignDriver(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { driver_id } = req.body;

      // Check if order exists and get store details
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !existingOrder) {
        return ResponseHandler.error(res, 404, 'Order not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && existingOrder.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify order from different country');
        }
        if (req.admin?.city_id && existingOrder.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify order from different city');
        }
      }

      // Validate driver when available
      // For now, just update the order
      const { data: order, error } = await supabase
        .from('orders')
        .update({ driver_id })
        .eq('id', id)
        .select(`
          *,
          stores (
            name
          ),
          drivers (
            name
          ),
          payment_options (
            *
          ),
          promo_codes (
            *
          )
        `)
        .single();

      if (error) throw error;

      // Format response
      const response = {
        ...order,
        store_name: order.stores?.name,
        driver_name: order.drivers?.name,
        payment_option: order.payment_options,
        promo_code: order.promo_codes
      };

      ResponseHandler.success(res, 200, 'Driver assigned successfully', response);
    } catch (error) {
      logger.error('Assign driver error:', error);
      ResponseHandler.error(res, 500, 'Failed to assign driver');
    }
  }

  static async updateOrderStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status }: { status: OrderStatus } = req.body;

      // Check if order exists and get store details
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !existingOrder) {
        return ResponseHandler.error(res, 404, 'Order not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && existingOrder.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify order from different country');
        }
        if (req.admin?.city_id && existingOrder.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify order from different city');
        }
      }

      // Validate status transition
      const validTransitions: Record<OrderStatus, OrderStatus[]> = {
        pending: ['preparing', 'cancelled'],
        preparing: ['done_preparing', 'cancelled'],
        done_preparing: ['on_way', 'cancelled'],
        on_way: ['delivered', 'cancelled'],
        delivered: [],
        cancelled: []
      };

      const currentStatus = existingOrder.order_status as OrderStatus;
      if (!validTransitions[currentStatus].includes(status)) {
        return ResponseHandler.error(res, 400, 'Invalid status transition');
      }

      // Update order status
      const { data: order, error } = await supabase
        .from('orders')
        .update({ order_status: status })
        .eq('id', id)
        .select(`
          *,
          stores (
            name
          ),
          drivers (
            name
          ),
          payment_options (
            *
          ),
          promo_codes (
            *
          )
        `)
        .single();

      if (error) throw error;

      // Format response
      const response = {
        ...order,
        store_name: order.stores?.name,
        driver_name: order.drivers?.name,
        payment_option: order.payment_options,
        promo_code: order.promo_codes
      };

      ResponseHandler.success(res, 200, 'Order status updated successfully', response);
    } catch (error) {
      logger.error('Update order status error:', error);
      ResponseHandler.error(res, 500, 'Failed to update order status');
    }
  }

  static async updatePaymentStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status }: { status: PaymentStatus } = req.body;

      // Check if order exists and get store details
      const { data: existingOrder, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !existingOrder) {
        return ResponseHandler.error(res, 404, 'Order not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && existingOrder.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify order from different country');
        }
        if (req.admin?.city_id && existingOrder.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot modify order from different city');
        }
      }

      // Update payment status
      const { data: order, error } = await supabase
        .from('orders')
        .update({ payment_status: status })
        .eq('id', id)
        .select(`
          *,
          stores (
            name
          ),
          drivers (
            name
          ),
          payment_options (
            *
          ),
          promo_codes (
            *
          )
        `)
        .single();

      if (error) throw error;

      // Format response
      const response = {
        ...order,
        store_name: order.stores?.name,
        driver_name: order.drivers?.name,
        payment_option: order.payment_options,
        promo_code: order.promo_codes
      };

      ResponseHandler.success(res, 200, 'Payment status updated successfully', response);
    } catch (error) {
      logger.error('Update payment status error:', error);
      ResponseHandler.error(res, 500, 'Failed to update payment status');
    }
  }

  static async deleteOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if order exists and get store details
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          stores (
            country_id,
            city_id
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError || !order) {
        return ResponseHandler.error(res, 404, 'Order not found');
      }

      // Check access rights
      if (req.admin?.role !== AdminRole.SUPER_ADMIN) {
        if (req.admin?.country_id && order.stores.country_id !== req.admin.country_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete order from different country');
        }
        if (req.admin?.city_id && order.stores.city_id !== req.admin.city_id) {
          return ResponseHandler.error(res, 403, 'Cannot delete order from different city');
        }
      }

      // Only allow deletion of pending orders
      if (order.order_status !== 'pending') {
        return ResponseHandler.error(res, 400, 'Can only delete pending orders');
      }

      // Delete order
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      ResponseHandler.success(res, 200, 'Order deleted successfully');
    } catch (error) {
      logger.error('Delete order error:', error);
      ResponseHandler.error(res, 500, 'Failed to delete order');
    }
  }
} 