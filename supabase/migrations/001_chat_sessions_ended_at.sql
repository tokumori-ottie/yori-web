-- chat_sessions: unique制約を削除し ended_at カラムを追加
-- 同日複数セッションを可能にする（1日の途中で「終える」→「また話す」に対応）

-- unique制約を削除
ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_date_key;

-- ended_at カラムを追加
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- chat_sessions の update ポリシーを追加（ended_at 更新のために必要）
DROP POLICY IF EXISTS "sessions_update_own" ON public.chat_sessions;
CREATE POLICY "sessions_update_own" ON public.chat_sessions
  FOR UPDATE USING (auth.uid() = user_id);
