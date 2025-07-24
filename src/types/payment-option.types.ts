export enum PaymentOptionType {
  CASH = 'cash',
  CARD = 'card',
  WALLET = 'wallet'
}

export enum PaymentOptionStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  TESTING = 'testing'
}

export enum PaymentFeeType {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage'
}

// Base configuration interface
interface BaseConfig {
  merchant_id?: string;
  merchant_name?: string;
  environment: 'live' | 'test';
}

// Type-specific configurations
interface CashConfig extends BaseConfig {
  receipt_prefix?: string;
  collection_points?: string[];
}

interface CardConfig extends BaseConfig {
  provider: string;          // e.g., 'stripe', 'square'
  api_key: string;
  api_secret: string;
  webhook_secret?: string;
  supported_cards?: string[]; // e.g., ['visa', 'mastercard']
}

interface WalletConfig extends BaseConfig {
  provider: string;          // e.g., 'apple_pay', 'google_pay'
  api_key: string;
  api_secret?: string;
  merchant_identifier?: string;
}

// Configuration type based on payment type
export type PaymentConfig = 
  | { type: PaymentOptionType.CASH; config: CashConfig }
  | { type: PaymentOptionType.CARD; config: CardConfig }
  | { type: PaymentOptionType.WALLET; config: WalletConfig };

export interface PaymentOption {
  id: string;
  country_id: string;
  name: string;
  type: PaymentOptionType;
  logo_media_id?: string;
  logo_url?: string; // From media table join

  // Configuration
  config: PaymentConfig['config'];
  test_config?: PaymentConfig['config'];

  // Business Rules
  minimum_amount?: number;
  maximum_amount?: number;
  transaction_fee: number;
  fee_type: PaymentFeeType;
  processing_time?: string;

  // Status
  status: PaymentOptionStatus;
  is_default: boolean;
  position: number;

  // Metadata
  description?: string;
  instructions?: string;
  support_phone?: string;
  support_email?: string;

  created_at: Date;
  updated_at: Date;
}

export interface PaymentOptionCreateDto {
  country_id: string;
  name: string;
  type: PaymentOptionType;
  logo_media_id?: string;
  config: PaymentConfig['config'];
  test_config?: PaymentConfig['config'];
  minimum_amount?: number;
  maximum_amount?: number;
  transaction_fee?: number;
  fee_type?: PaymentFeeType;
  processing_time?: string;
  status?: PaymentOptionStatus;
  is_default?: boolean;
  position?: number;
  description?: string;
  instructions?: string;
  support_phone?: string;
  support_email?: string;
}

export interface PaymentOptionUpdateDto extends Partial<PaymentOptionCreateDto> {}

export interface PaymentOptionQueryParams {
  search?: string;          // Search by name
  country_id?: string;      // Filter by country
  type?: PaymentOptionType; // Filter by type
  status?: PaymentOptionStatus; // Filter by status
  is_default?: boolean;     // Filter default options
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'position' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

// Response types
export interface PaymentOptionResponse extends PaymentOption {
  country_name: string;
}

export interface PaginatedPaymentOptionResponse {
  payment_options: PaymentOptionResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
} 