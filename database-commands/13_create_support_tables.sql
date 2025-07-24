-- Create enums for ticket system
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'reopened');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE ticket_category AS ENUM ('general', 'technical', 'billing', 'feature_request', 'complaint');

-- Create support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_id UUID NOT NULL,
    city_id UUID,
    user_id UUID NOT NULL,
    assigned_to UUID,
    ticket_number VARCHAR(20) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ticket_category NOT NULL DEFAULT 'general',
    priority ticket_priority NOT NULL DEFAULT 'medium',
    status ticket_status NOT NULL DEFAULT 'open',
    resolution_note TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT fk_country FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE,
    CONSTRAINT fk_city_country FOREIGN KEY (city_id, country_id) REFERENCES cities(id, country_id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_assigned_to FOREIGN KEY (assigned_to) REFERENCES admins(id) ON DELETE SET NULL,
    CONSTRAINT unique_ticket_number UNIQUE (ticket_number),
    -- Ensure resolution note is provided when status is resolved
    CONSTRAINT valid_resolution CHECK (
        (status != 'resolved' AND resolution_note IS NULL) OR
        (status = 'resolved' AND resolution_note IS NOT NULL)
    ),
    -- Ensure resolved_at is set when status is resolved
    CONSTRAINT valid_resolved_at CHECK (
        (status != 'resolved' AND resolved_at IS NULL) OR
        (status = 'resolved' AND resolved_at IS NOT NULL)
    ),
    -- Ensure closed_at is set when status is closed
    CONSTRAINT valid_closed_at CHECK (
        (status != 'closed' AND closed_at IS NULL) OR
        (status = 'closed' AND closed_at IS NOT NULL)
    )
);

-- Create support messages table for chat functionality
CREATE TABLE IF NOT EXISTS support_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID NOT NULL,
    sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'admin')),
    sender_id UUID NOT NULL,
    message TEXT NOT NULL,
    attachments JSONB,
    is_internal BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT fk_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    -- Note: sender validation will be enforced through triggers
    -- Ensure read_at is set when is_read is true
    CONSTRAINT valid_read_at CHECK (
        (is_read = false AND read_at IS NULL) OR
        (is_read = true AND read_at IS NOT NULL)
    )
);

-- Create function to validate sender
CREATE OR REPLACE FUNCTION validate_message_sender()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sender_type = 'user' AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.sender_id) THEN
        RAISE EXCEPTION 'Invalid user ID for sender';
    END IF;
    
    IF NEW.sender_type = 'admin' AND NOT EXISTS (SELECT 1 FROM admins WHERE id = NEW.sender_id) THEN
        RAISE EXCEPTION 'Invalid admin ID for sender';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for sender validation
CREATE TRIGGER validate_message_sender
    BEFORE INSERT OR UPDATE ON support_messages
    FOR EACH ROW
    EXECUTE FUNCTION validate_message_sender();

-- Create indexes
CREATE INDEX idx_tickets_country_id ON support_tickets(country_id);
CREATE INDEX idx_tickets_city_id ON support_tickets(city_id);
CREATE INDEX idx_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_tickets_status ON support_tickets(status);
CREATE INDEX idx_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_tickets_category ON support_tickets(category);
CREATE INDEX idx_tickets_created_at ON support_tickets(created_at);
CREATE INDEX idx_tickets_ticket_number ON support_tickets(ticket_number);

CREATE INDEX idx_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX idx_messages_sender ON support_messages(sender_type, sender_id);
CREATE INDEX idx_messages_created_at ON support_messages(created_at);
CREATE INDEX idx_messages_is_read ON support_messages(is_read);

-- Create function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS trigger AS $$
DECLARE
    year_prefix VARCHAR(4);
    sequence_number INTEGER;
BEGIN
    year_prefix := to_char(CURRENT_DATE, 'YYYY');
    
    -- Get the latest sequence number for this year
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 6) AS INTEGER)), 0) + 1
    INTO sequence_number
    FROM support_tickets
    WHERE ticket_number LIKE year_prefix || '-%';
    
    -- Format: YYYY-XXXXX (e.g., 2024-00001)
    NEW.ticket_number := year_prefix || '-' || LPAD(sequence_number::text, 5, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ticket number generation
CREATE TRIGGER generate_ticket_number_trigger
    BEFORE INSERT ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_number();

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_support_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_support_updated_at();

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON support_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_support_updated_at();

-- Add comments
COMMENT ON TABLE support_tickets IS 'Stores support tickets with their status and assignment';
COMMENT ON TABLE support_messages IS 'Stores messages exchanged within support tickets';

COMMENT ON COLUMN support_tickets.ticket_number IS 'Unique human-readable ticket identifier (YYYY-XXXXX)';
COMMENT ON COLUMN support_tickets.subject IS 'Brief description of the ticket';
COMMENT ON COLUMN support_tickets.description IS 'Detailed description of the issue';
COMMENT ON COLUMN support_tickets.category IS 'Type of support request';
COMMENT ON COLUMN support_tickets.priority IS 'Ticket priority level';
COMMENT ON COLUMN support_tickets.status IS 'Current status of the ticket';
COMMENT ON COLUMN support_tickets.resolution_note IS 'Note explaining how the ticket was resolved';

COMMENT ON COLUMN support_messages.sender_type IS 'Type of sender (user or admin)';
COMMENT ON COLUMN support_messages.is_internal IS 'Whether the message is internal note (only visible to admins)';
COMMENT ON COLUMN support_messages.attachments IS 'JSON array of attachment metadata';
COMMENT ON COLUMN support_messages.is_read IS 'Whether the message has been read by the recipient'; 