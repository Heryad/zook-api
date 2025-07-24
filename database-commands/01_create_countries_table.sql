-- Create enum for delivery fee calculation types
CREATE TYPE delivery_fee_type AS ENUM ('zone', 'fixed', 'distance');

-- Create countries table (top level of hierarchy)
CREATE TABLE IF NOT EXISTS countries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(2) NOT NULL,  -- ISO 2-letter country code (e.g., US, UK)
    phone_code VARCHAR(5) NOT NULL, -- Country calling code (e.g., +1, +44)
    currency_code VARCHAR(3) NOT NULL, -- ISO currency code (e.g., USD, GBP)
    currency_symbol VARCHAR(5) NOT NULL, -- Currency symbol (e.g., $, £)
    timezone VARCHAR(50) NOT NULL, -- Default timezone (e.g., America/New_York)
    default_language VARCHAR(2) NOT NULL, -- ISO language code (e.g., en, ar)
    
    -- Franchise settings
    has_delivery BOOLEAN DEFAULT true,
    has_pickup BOOLEAN DEFAULT true,
    min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    delivery_fee_type delivery_fee_type NOT NULL DEFAULT 'zone',
    default_delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- App settings
    app_share_text TEXT,
    support_phone VARCHAR(20),
    support_email VARCHAR(255),
    facebook_url TEXT,
    instagram_url TEXT,
    twitter_url TEXT,
    
    -- Status and timestamps
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_country_code UNIQUE (code)
);

-- Create indexes
CREATE INDEX idx_countries_code ON countries (code);
CREATE INDEX idx_countries_is_active ON countries (is_active);
CREATE INDEX idx_countries_name ON countries (name);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_countries_updated_at
    BEFORE UPDATE ON countries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE countries IS 'Stores country information and franchise settings';
COMMENT ON COLUMN countries.code IS 'ISO 2-letter country code';
COMMENT ON COLUMN countries.phone_code IS 'Country calling code with plus sign';
COMMENT ON COLUMN countries.currency_code IS 'ISO currency code';
COMMENT ON COLUMN countries.timezone IS 'Default timezone for the country';
COMMENT ON COLUMN countries.default_language IS 'Default ISO language code';
COMMENT ON COLUMN countries.delivery_fee_type IS 'How delivery fees are calculated: by zone, fixed rate, or distance';
COMMENT ON COLUMN countries.min_order_amount IS 'Minimum order amount required for this country';
COMMENT ON COLUMN countries.is_active IS 'Whether this country is currently active in the system'; 