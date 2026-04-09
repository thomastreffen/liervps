
-- Participants table for order form conversations
CREATE TABLE public.order_form_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.order_form_submissions(id) ON DELETE CASCADE,
  participant_type text NOT NULL DEFAULT 'internal_user',
  user_id uuid NULL,
  name text NOT NULL,
  email text NULL,
  role_label text NULL,
  receives_notifications boolean NOT NULL DEFAULT true,
  can_reply boolean NOT NULL DEFAULT true,
  is_visible_to_customer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT valid_participant_type CHECK (participant_type IN ('internal_user', 'customer_contact', 'external_email'))
);

CREATE INDEX idx_ofp_submission_id ON public.order_form_participants(submission_id);
CREATE INDEX idx_ofp_user_id ON public.order_form_participants(user_id);

ALTER TABLE public.order_form_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view participants for accessible orders"
  ON public.order_form_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_form_submissions ofs
      WHERE ofs.id = submission_id
        AND (
          public.is_company_member(auth.uid(), ofs.company_id)
          OR public.has_cross_company_order_access(auth.uid(), ofs.id)
        )
    )
  );

CREATE POLICY "Authenticated users can manage participants"
  ON public.order_form_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_form_submissions ofs
      WHERE ofs.id = submission_id
        AND (
          public.is_company_member(auth.uid(), ofs.company_id)
          OR public.has_cross_company_order_access(auth.uid(), ofs.id)
        )
    )
  );

CREATE POLICY "Authenticated users can update participants"
  ON public.order_form_participants FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_form_submissions ofs
      WHERE ofs.id = submission_id
        AND (
          public.is_company_member(auth.uid(), ofs.company_id)
          OR public.has_cross_company_order_access(auth.uid(), ofs.id)
        )
    )
  );

CREATE POLICY "Authenticated users can delete participants"
  ON public.order_form_participants FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_form_submissions ofs
      WHERE ofs.id = submission_id
        AND (
          public.is_company_member(auth.uid(), ofs.company_id)
          OR public.has_cross_company_order_access(auth.uid(), ofs.id)
        )
    )
  );

-- Extend order_form_messages with visibility, source, and addressed_to
ALTER TABLE public.order_form_messages
  ADD COLUMN visibility text NOT NULL DEFAULT 'internal',
  ADD COLUMN source text NOT NULL DEFAULT 'app',
  ADD COLUMN addressed_to_participant_id uuid NULL REFERENCES public.order_form_participants(id) ON DELETE SET NULL,
  ADD COLUMN sender_participant_id uuid NULL REFERENCES public.order_form_participants(id) ON DELETE SET NULL;

ALTER TABLE public.order_form_messages
  ADD CONSTRAINT valid_visibility CHECK (visibility IN ('internal', 'shared')),
  ADD CONSTRAINT valid_source CHECK (source IN ('app', 'email', 'system'));
