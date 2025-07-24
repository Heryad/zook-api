import { PaymentOption } from './payment-option.types';
import { PromoCode } from './promo-code.types';

export type OrderStatus = 'pending' | 'preparing' | 'done_preparing' | 'on_way' | 'delivered' | 'cancelled';

export type PaymentStatus = 'not_paid' | 'paid' | 'failed' | 'refunded';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  options?: Array<{
    name: string;
    value?: string;
  }>;
  extras?: Array<{
    name: string;
    price: number;
  }>;
}

export interface OrderCreateDto {
  user_id: string;
  store_id: string;
  payment_option_id?: string;
  promo_code_id?: string;
  items: Array<{
    id: string;
    quantity: number;
    options?: Array<{
      name: string;
      value?: string;
    }>;
    extras?: Array<{
      name: string;
      price: number;
    }>;
  }>;
  extra_note?: string;
  delivery_address: {
    address: string;
    latitude: number;
    longitude: number;
    details?: string;
  };
}

export interface OrderUpdateDto {
  payment_option_id?: string;
  extra_note?: string;
  delivery_address?: {
    address: string;
    latitude: number;
    longitude: number;
    details?: string;
  };
  driver_id?: string;
  order_status?: OrderStatus;
  payment_status?: PaymentStatus;
  transaction_id?: string;
}

export interface OrderQueryParams {
  search?: string;
  user_id?: string;
  store_id?: string;
  driver_id?: string;
  payment_status?: PaymentStatus;
  order_status?: OrderStatus;
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
} 