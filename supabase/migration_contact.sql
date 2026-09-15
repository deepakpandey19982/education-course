-- Add Contact Messages table for the Contact page
CREATE TABLE contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a message
CREATE POLICY "Anyone can submit a contact message" ON contact_messages
    FOR INSERT WITH CHECK (true);

-- Only admins can read messages
CREATE POLICY "Only admins can view contact messages" ON contact_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
