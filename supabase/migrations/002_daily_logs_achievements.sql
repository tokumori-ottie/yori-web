-- daily_logs: achievements カラムを追加
-- 子どもの成長・できるようになったことを記録するフィールド

ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS achievements text;
