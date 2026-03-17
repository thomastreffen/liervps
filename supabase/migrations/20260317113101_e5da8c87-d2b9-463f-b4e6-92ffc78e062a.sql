-- Add assignment-specific notes field to events, separate from project description
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS assignment_notes text;