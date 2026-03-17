
-- Absence requests table
CREATE TABLE public.absence_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.internal_companies(id),
  absence_type text NOT NULL CHECK (absence_type IN ('ferie', 'egenmelding', 'sykemelding', 'avspasering', 'permisjon', 'kurs', 'annet')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time,
  end_time time,
  is_full_day boolean NOT NULL DEFAULT true,
  comment text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid REFERENCES auth.users(id),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.absence_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view absence requests"
  ON public.absence_requests FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert absence requests"
  ON public.absence_requests FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update absence requests"
  ON public.absence_requests FOR UPDATE TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_absence_requests_updated_at
  BEFORE UPDATE ON public.absence_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_absence_requests_person ON public.absence_requests(person_id);
CREATE INDEX idx_absence_requests_company ON public.absence_requests(company_id);
CREATE INDEX idx_absence_requests_status ON public.absence_requests(status);
CREATE INDEX idx_absence_requests_dates ON public.absence_requests(start_date, end_date);
