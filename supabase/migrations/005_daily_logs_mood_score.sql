-- daily_logs: mood_score カラムを追加
-- -2: とても辛い, -1: しんどい, 0: 普通, +1: 良かった, +2: 嬉しい・充実

ALTER TABLE public.daily_logs ADD COLUMN IF NOT EXISTS mood_score integer CHECK (mood_score BETWEEN -2 AND 2);
