-- profiles: parent_type カラムを追加
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS parent_type text CHECK (parent_type IN ('mama', 'papa'));

-- children テーブル（複数の子どもを管理）
CREATE TABLE IF NOT EXISTS public.children (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  nickname text,
  birthday date NOT NULL,
  gender text CHECK (gender IN ('boy', 'girl', 'other')) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "children_select_own" ON public.children
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "children_insert_own" ON public.children
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "children_update_own" ON public.children
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "children_delete_own" ON public.children
  FOR DELETE USING (auth.uid() = user_id);
