-- ============================================================
-- Yori - Supabase Schema
-- ============================================================

-- profiles (auth.users の拡張)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  created_at timestamptz default now()
);

-- チャットセッション（1日1セッション）
create table if not exists public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date default current_date not null,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- メッセージ
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  created_at timestamptz default now()
);

-- 日次ログ（対話から自動抽出）
create table if not exists public.daily_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  session_id uuid references public.chat_sessions on delete set null,
  date date default current_date not null,
  events text,
  feelings text,
  tags text[],
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.daily_logs enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- chat_sessions
create policy "sessions_select_own" on public.chat_sessions
  for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.chat_sessions
  for insert with check (auth.uid() = user_id);

-- messages
create policy "messages_select_own" on public.messages
  for select using (auth.uid() = user_id);
create policy "messages_insert_own" on public.messages
  for insert with check (auth.uid() = user_id);

-- daily_logs
create policy "logs_select_own" on public.daily_logs
  for select using (auth.uid() = user_id);
create policy "logs_insert_own" on public.daily_logs
  for insert with check (auth.uid() = user_id);
create policy "logs_update_own" on public.daily_logs
  for update using (auth.uid() = user_id);

-- ============================================================
-- Trigger: ユーザー登録時にprofileを自動作成
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
