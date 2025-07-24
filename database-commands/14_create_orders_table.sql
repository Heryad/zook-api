-- Create order status enum
CREATE TYPE order_status AS ENUM (
    'pending',
    'preparing',
    'done_preparing',
    'on_way',
    'delivered',
    'cancelled'
);

-- Create payment status enum
CREATE TYPE payment_status AS ENUM (
    'paid',
    'not_paid'
);

-- Create orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id UUID NOT NULL REFERENCES countries(id),
    city_id UUID REFERENCES cities(id),
    store_id UUID NOT NULL REFERENCES stores(id),
    driver_id UUID REFERENCES drivers(id),
    payment_option_id UUID REFERENCES payment_options(id),
    promo_code_id UUID REFERENCES promo_codes(id),
    
    -- Customer Information
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255),
    
    -- Order Items
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_item_quantity INTEGER NOT NULL,
    total_item_price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    final_price DECIMAL(10,2) NOT NULL,
    
    -- Additional Info
    extra_note TEXT,
    delivery_address JSONB NOT NULL,
    
    -- Status
    payment_status payment_status NOT NULL DEFAULT 'not_paid',
    order_status order_status NOT NULL DEFAULT 'pending',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT orders_fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id),
    CONSTRAINT orders_fk_store_country FOREIGN KEY (store_id, country_id) REFERENCES stores(id, country_id),
    CONSTRAINT orders_fk_driver_country FOREIGN KEY (driver_id, country_id) REFERENCES drivers(id, country_id),
    -- Basic JSON validation
    CONSTRAINT orders_valid_items_type CHECK (
        items IS NOT NULL AND
        jsonb_typeof(items) = 'array'
    ),
    CONSTRAINT orders_valid_delivery_address CHECK (
        delivery_address IS NOT NULL AND
        jsonb_typeof(delivery_address) = 'object' AND
        delivery_address ? 'name' AND
        delivery_address ? 'type' AND
        delivery_address ? 'street' AND
        delivery_address ? 'city' AND
        delivery_address ? 'description' AND
        delivery_address ? 'latitude' AND
        delivery_address ? 'longitude'
    ),
    -- Business rules
    CONSTRAINT orders_valid_prices CHECK (
        total_item_price >= 0 AND
        discount_amount >= 0 AND
        final_price >= 0 AND
        final_price = total_item_price - discount_amount
    ),
    CONSTRAINT orders_valid_quantity CHECK (
        total_item_quantity > 0
    )
);

-- Create function to validate order items
CREATE OR REPLACE FUNCTION validate_order_items()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if all items exist in store
    IF NOT (
        SELECT bool_and(
            EXISTS (
                SELECT 1 FROM store_items 
                WHERE id = (item->>'id')::uuid 
                AND store_id = NEW.store_id
            )
        )
        FROM jsonb_array_elements(NEW.items) item
    ) THEN
        RAISE EXCEPTION 'Invalid store item reference';
    END IF;

    -- Validate item structure and calculate totals
    IF NOT (
        SELECT bool_and(
            jsonb_typeof(item->'id') = 'string' AND
            jsonb_typeof(item->'name') = 'string' AND
            jsonb_typeof(item->'quantity') = 'number' AND
            (item->>'quantity')::integer > 0 AND
            jsonb_typeof(item->'price') = 'number' AND
            (item->>'price')::decimal >= 0 AND
            (
                item->'options' IS NULL OR
                jsonb_typeof(item->'options') = 'array'
            ) AND
            (
                item->'extras' IS NULL OR
                jsonb_typeof(item->'extras') = 'array'
            )
        )
        FROM jsonb_array_elements(NEW.items) item
    ) THEN
        RAISE EXCEPTION 'Invalid item structure';
    END IF;

    -- Verify total quantity
    IF NEW.total_item_quantity != (
        SELECT sum((item->>'quantity')::integer)
        FROM jsonb_array_elements(NEW.items) item
    ) THEN
        RAISE EXCEPTION 'Invalid total quantity';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order items validation
CREATE TRIGGER validate_order_items
    BEFORE INSERT OR UPDATE OF items ON orders
    FOR EACH ROW
    EXECUTE FUNCTION validate_order_items();

-- Create indexes
CREATE INDEX idx_orders_country_id ON orders(country_id);
CREATE INDEX idx_orders_city_id ON orders(city_id);
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_driver_id ON orders(driver_id);
CREATE INDEX idx_orders_payment_option_id ON orders(payment_option_id);
CREATE INDEX idx_orders_promo_code_id ON orders(promo_code_id);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_order_status ON orders(order_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
-- Indexes for JSONB columns
CREATE INDEX idx_orders_items ON orders USING gin(items jsonb_path_ops);
CREATE INDEX idx_orders_delivery_address ON orders USING gin(delivery_address jsonb_path_ops);
-- Composite indexes for common queries
CREATE INDEX idx_orders_status_dates ON orders(order_status, created_at DESC);
CREATE INDEX idx_orders_driver_status ON orders(driver_id, order_status) 
    WHERE driver_id IS NOT NULL;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_orders_updated_at();

-- Add comments
COMMENT ON TABLE orders IS 'Customer orders';
COMMENT ON COLUMN orders.customer_name IS 'Name of the customer';
COMMENT ON COLUMN orders.customer_phone IS 'Phone number of the customer';
COMMENT ON COLUMN orders.customer_email IS 'Email of the customer (optional)';
COMMENT ON COLUMN orders.items IS 'JSON array of ordered items with their options and extras';
COMMENT ON COLUMN orders.total_item_quantity IS 'Total quantity of all items';
COMMENT ON COLUMN orders.total_item_price IS 'Total price before discount';
COMMENT ON COLUMN orders.discount_amount IS 'Discount amount from promo code';
COMMENT ON COLUMN orders.final_price IS 'Final price after discount';
COMMENT ON COLUMN orders.delivery_address IS 'JSON object with delivery address details';
COMMENT ON COLUMN orders.payment_status IS 'Payment status (paid/not paid)';
COMMENT ON COLUMN orders.order_status IS 'Current status of the order'; 