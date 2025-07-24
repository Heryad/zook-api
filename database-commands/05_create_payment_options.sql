-- Create payment option type enum
CREATE TYPE payment_option_type AS ENUM ('cash', 'card', 'wallet');

-- Create payment option status enum
CREATE TYPE payment_option_status AS ENUM ('active', 'disabled', 'testing');

-- Create payment options table
CREATE TABLE payment_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_id UUID REFERENCES countries(id),
    name VARCHAR(100) NOT NULL,
    type payment_option_type NOT NULL,
    logo_media_id UUID REFERENCES media(id),
    
    -- Configuration
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    test_config JSONB DEFAULT NULL,
    
    -- Business Rules
    minimum_amount DECIMAL(10,2),
    maximum_amount DECIMAL(10,2),
    transaction_fee DECIMAL(10,2) DEFAULT 0,
    fee_type VARCHAR(20) DEFAULT 'fixed',  -- 'fixed' or 'percentage'
    processing_time VARCHAR(50),  -- e.g., "instant", "1-2 hours"
    
    -- Status
    status payment_option_status DEFAULT 'testing',
    is_default BOOLEAN DEFAULT false,
    position INTEGER DEFAULT 0,  -- For custom sorting
    
    -- Metadata
    description TEXT,
    instructions TEXT,
    support_phone VARCHAR(20),
    support_email VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_name_per_country UNIQUE(country_id, name),
    CONSTRAINT valid_amount_range CHECK (
        (minimum_amount IS NULL AND maximum_amount IS NULL) OR
        (minimum_amount IS NULL AND maximum_amount IS NOT NULL) OR
        (minimum_amount IS NOT NULL AND maximum_amount IS NULL) OR
        (minimum_amount < maximum_amount)
    ),
    CONSTRAINT valid_fee CHECK (transaction_fee >= 0),
    CONSTRAINT valid_fee_type CHECK (fee_type IN ('fixed', 'percentage')),
    -- Note: logo media validation will be enforced at the application level
    CONSTRAINT fk_logo_media_country FOREIGN KEY (logo_media_id, country_id) REFERENCES media(id, country_id)
);

-- Create indexes
CREATE INDEX idx_payment_options_country ON payment_options(country_id);
CREATE INDEX idx_payment_options_type ON payment_options(type);
CREATE INDEX idx_payment_options_status ON payment_options(status);
CREATE INDEX idx_payment_options_logo_media ON payment_options(logo_media_id);

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_payment_option_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp update
CREATE TRIGGER update_payment_option_timestamp
    BEFORE UPDATE ON payment_options
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_option_timestamp(); 