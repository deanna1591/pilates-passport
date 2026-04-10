-- ═══════════════════════════════════════════════════════════════════
-- PILATES PASSPORT — PART 4: FIX STORAGE BUCKET POLICIES
-- Run this in Supabase SQL Editor if photo uploads are failing.
-- ═══════════════════════════════════════════════════════════════════

-- Step 1: Ensure buckets exist (safe to run multiple times)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('class-photos',   'class-photos',   false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/heic']),
  ('studio-photos',  'studio-photos',  true,  10485760, array['image/jpeg','image/png','image/webp','image/gif']),
  ('profile-photos', 'profile-photos', true,  5242880,  array['image/jpeg','image/png','image/webp','image/gif','image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Step 2: Drop ALL existing storage policies to start clean
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where tablename = 'objects' and schemaname = 'storage'
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- Step 3: class-photos — authenticated users can manage their own files
create policy "class_photos_select"
  on storage.objects for select
  using (
    bucket_id = 'class-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "class_photos_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'class-photos'
    and auth.uid() is not null
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "class_photos_update"
  on storage.objects for update
  using (
    bucket_id = 'class-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "class_photos_delete"
  on storage.objects for delete
  using (
    bucket_id = 'class-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Step 4: profile-photos — public read, owner write
create policy "profile_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "profile_photos_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-photos'
    and auth.uid() is not null
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "profile_photos_update"
  on storage.objects for update
  using (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

create policy "profile_photos_delete"
  on storage.objects for delete
  using (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Step 5: studio-photos — public read, authenticated upload
create policy "studio_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'studio-photos');

create policy "studio_photos_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'studio-photos'
    and auth.uid() is not null
  );

create policy "studio_photos_delete"
  on storage.objects for delete
  using (
    bucket_id = 'studio-photos'
    and auth.uid() is not null
  );

-- Step 6: Also fix the users table RLS — must allow insert for new signups
drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- Step 7: Verify buckets were created
select id, name, public, file_size_limit from storage.buckets where id in ('class-photos','studio-photos','profile-photos');
