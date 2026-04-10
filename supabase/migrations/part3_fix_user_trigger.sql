-- ═══════════════════════════════════════════════════════
-- PILATES PASSPORT — PART 3: FIX USER TRIGGER
-- Run this in Supabase SQL Editor if users are showing
-- wrong names or missing display_name values.
-- ═══════════════════════════════════════════════════════

-- Improved trigger: properly captures display_name from signup metadata
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do update
    set
      email = excluded.email,
      display_name = coalesce(
        excluded.display_name,
        public.users.display_name
      );
  return new;
end;
$$ language plpgsql security definer;

-- Re-attach trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Fix any existing users whose display_name is null
-- This updates them from their auth metadata
update public.users u
set display_name = split_part(au.email, '@', 1)
from auth.users au
where u.id = au.id
  and (u.display_name is null or u.display_name = '');

-- Add missing RLS policy for insert (needed for upsert from app)
drop policy if exists "Users can insert their own profile" on users;
create policy "Users can insert their own profile"
  on users for insert
  with check (auth.uid() = id);
