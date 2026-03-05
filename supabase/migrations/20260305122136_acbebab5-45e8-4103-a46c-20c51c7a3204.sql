
-- Dashboard module configs per user
CREATE TABLE public.dashboard_module_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  column_placement text NOT NULL DEFAULT 'left' CHECK (column_placement IN ('left', 'right', 'full')),
  density text NOT NULL DEFAULT 'normal' CHECK (density IN ('compact', 'normal', 'expanded')),
  filter_config jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);

-- RLS
ALTER TABLE public.dashboard_module_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dashboard config"
  ON public.dashboard_module_configs
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
