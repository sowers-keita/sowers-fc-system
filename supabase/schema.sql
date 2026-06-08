
-- Sowers FC System / Supabase setup
-- 1. Supabase SQL EditorでこのSQLを実行
-- 2. Authentication > Users で先生のメールとパスワードを作成
-- 3. 作成したuser idをprofilesに登録

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  school_id text,
  role text default 'teacher',
  created_at timestamptz default now()
);

create table if not exists invoice_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id text not null,
  target_month text not null,
  invoice_date text,
  invoice_no text,
  issuer text,
  bank_info text,
  notes text,
  people jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, school_id, target_month)
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id text not null,
  page_no int not null default 1,
  full_name text not null,
  join_month text,
  class_name text,
  status text default 'active',          -- active=在籍 / suspended=休会 / withdrawn=退会
  enrollment_fee numeric default 0,      -- 入会金
  monthly_fee numeric default 0,         -- 月謝
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 既存テーブルがある場合の追加カラム（再実行しても安全）
alter table students add column if not exists enrollment_fee numeric default 0;
alter table students add column if not exists monthly_fee numeric default 0;

alter table profiles enable row level security;
alter table invoice_months enable row level security;
alter table students enable row level security;

drop policy if exists "read own profile" on profiles;
create policy "read own profile"
on profiles for select
using (auth.uid() = id);

-- アプリ内の新規登録・プロフィール編集のために自分の行を作成/更新できるようにする
drop policy if exists "insert own profile" on profiles;
create policy "insert own profile"
on profiles for insert
with check (auth.uid() = id);

drop policy if exists "update own profile" on profiles;
create policy "update own profile"
on profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "insert own invoices" on invoice_months;
create policy "insert own invoices"
on invoice_months for insert
with check (auth.uid() = user_id);

drop policy if exists "read own invoices" on invoice_months;
create policy "read own invoices"
on invoice_months for select
using (auth.uid() = user_id);

drop policy if exists "update own invoices" on invoice_months;
create policy "update own invoices"
on invoice_months for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own invoices" on invoice_months;
create policy "delete own invoices"
on invoice_months for delete
using (auth.uid() = user_id);

drop policy if exists "insert own students" on students;
create policy "insert own students"
on students for insert
with check (auth.uid() = user_id);

drop policy if exists "read own students" on students;
create policy "read own students"
on students for select
using (auth.uid() = user_id);

drop policy if exists "update own students" on students;
create policy "update own students"
on students for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "delete own students" on students;
create policy "delete own students"
on students for delete
using (auth.uid() = user_id);
