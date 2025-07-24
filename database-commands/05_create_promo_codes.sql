-- Create promo code type enum
CREATE TYPE promo_code_type AS ENUM ('percentage', 'fixed');

-- Create promo codes table
CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID REFERENCES countries(id),
    city_id UUID REFERENCES cities(id),
    code VARCHAR(50) NOT NULL,
    type promo_code_type NOT NULL DEFAULT 'fixed',
    discount_amount DECIMAL(10,2) NOT NULL,
    minimum_order_amount DECIMAL(10,2),
    maximum_discount DECIMAL(10,2),
    usage_limit INTEGER,
    used_count INTEGER DEFAULT 0,
    description TEXT,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_discount_amount CHECK (discount_amount > 0),
    CONSTRAINT valid_maximum_discount CHECK (
        (type = 'fixed' AND (maximum_discount IS NULL OR maximum_discount >= discount_amount)) OR
        (type = 'percentage' AND (
            discount_amount <= 100 AND
            (maximum_discount IS NULL OR maximum_discount > 0)
        ))
    ),
    CONSTRAINT valid_minimum_order CHECK (minimum_order_amount IS NULL OR minimum_order_amount > 0),
    CONSTRAINT valid_usage_limit CHECK (usage_limit IS NULL OR usage_limit > 0),
    CONSTRAINT valid_dates CHECK (
        (start_date IS NULL AND end_date IS NULL) OR
        (start_date IS NOT NULL AND end_date IS NULL) OR
        (start_date IS NULL AND end_date IS NOT NULL) OR
        (start_date < end_date)
    ),
    CONSTRAINT valid_location CHECK (
        (country_id IS NOT NULL AND city_id IS NULL) OR
        (country_id IS NOT NULL AND city_id IS NOT NULL)
    ),
    CONSTRAINT fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id),
    CONSTRAINT unique_code_per_location UNIQUE (code, country_id, city_id)
);

-- Create indexes
CREATE INDEX idx_promo_codes_country ON promo_codes(country_id);
CREATE INDEX idx_promo_codes_city ON promo_codes(city_id);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active ON promo_codes(is_active);
CREATE INDEX idx_promo_codes_dates ON promo_codes(start_date, end_date) 
    WHERE start_date IS NOT NULL OR end_date IS NOT NULL;

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_promo_code_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp update
CREATE TRIGGER update_promo_code_timestamp
    BEFORE UPDATE ON promo_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_promo_code_timestamp(); 