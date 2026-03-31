-- weekly_summaries: 週次サマリーをキャッシュするテーブル

CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  week_start date NOT NULL,  -- その週の月曜日
  content jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_summaries_select_own" ON public.weekly_summaries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "weekly_summaries_insert_own" ON public.weekly_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "weekly_summaries_update_own" ON public.weekly_summaries
  FOR UPDATE USING (auth.uid() = user_id);
