-- daily_logs に子どもの特性・困りごとフィールドを追加
alter table public.daily_logs
  add column if not exists difficulties text;
