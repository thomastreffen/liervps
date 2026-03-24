
-- Add Phase 2 columns to order_form_submissions
ALTER TABLE public.order_form_submissions
  ADD COLUMN IF NOT EXISTS quality_score text DEFAULT 'green' CHECK (quality_score IN ('green', 'yellow', 'red')),
  ADD COLUMN IF NOT EXISTS quality_issues jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS converted_to_type text,
  ADD COLUMN IF NOT EXISTS converted_to_id uuid,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

-- Add missing_info_request type to comments
-- comment_type already exists, just ensure we can use 'missing_info_request' and 'system_note'
