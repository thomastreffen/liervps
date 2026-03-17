
-- Add contact_person_id to calculations table
ALTER TABLE public.calculations
ADD COLUMN contact_person_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX idx_calculations_contact_person_id ON public.calculations(contact_person_id);
