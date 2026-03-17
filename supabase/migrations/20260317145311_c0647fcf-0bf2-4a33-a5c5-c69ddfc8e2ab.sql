
-- 1. Add CRM fields to calculations table
ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS next_step_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now();

-- 2. Add 'in_dialogue' to calculation_status enum
ALTER TYPE public.calculation_status ADD VALUE IF NOT EXISTS 'in_dialogue' AFTER 'sent';

-- 3. Create offer_comments table for chat-like activity feed
CREATE TABLE public.offer_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id uuid NOT NULL REFERENCES public.calculations(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.internal_companies(id),
  author_id uuid REFERENCES auth.users(id),
  comment_type text NOT NULL DEFAULT 'comment',
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offer_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for offer_comments
CREATE POLICY "Authenticated users can view offer comments"
  ON public.offer_comments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create offer comments"
  ON public.offer_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can update their own comments"
  ON public.offer_comments FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own comments"
  ON public.offer_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- Trigger for updated_at
CREATE TRIGGER update_offer_comments_updated_at
  BEFORE UPDATE ON public.offer_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_offer_comments_calculation_id ON public.offer_comments(calculation_id);
CREATE INDEX idx_calculations_responsible_user ON public.calculations(responsible_user_id);
CREATE INDEX idx_calculations_next_step_at ON public.calculations(next_step_at);

-- Enable realtime for offer_comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.offer_comments;
