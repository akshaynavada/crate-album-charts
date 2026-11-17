CREATE TABLE public.charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edit_token uuid NOT NULL DEFAULT gen_random_uuid(),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.charts TO service_role;
ALTER TABLE public.charts ENABLE ROW LEVEL SECURITY;