CREATE TABLE public.monthly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  month_start date NOT NULL,   -- YYYY-MM-01
  content jsonb NOT NULL,      -- {summary, child_growth, top_tags, encouragement}
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month_start)
);

ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own monthly summaries" ON public.monthly_summaries
  FOR ALL USING (auth.uid() = user_id);
