-- daily_logs: user_id,date のユニーク制約を session_id のユニーク制約に変更
-- 1日に複数セッション分の記録を保存できるようにする

ALTER TABLE public.daily_logs DROP CONSTRAINT IF EXISTS daily_logs_user_id_date_key;
ALTER TABLE public.daily_logs ADD CONSTRAINT daily_logs_session_id_key UNIQUE (session_id);
