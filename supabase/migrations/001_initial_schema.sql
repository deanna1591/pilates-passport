-- ═══════════════════════════════════════════════════════════════════════════
-- PILATES PASSPORT — SUPABASE SCHEMA
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension (already enabled by default in Supabase)
create extension if not exists "uuid-ossp";
create extension if not exists "postgis"; -- for geospatial queries (optional)

-- ─── HELPER: updated_at trigger ─────────────────────────────────────────────
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ════════════════════════════════════════════════════════════════════════════
-- 1. COUNTRIES
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists countries (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  iso_code    char(2) not null unique,
  flag_emoji  text,
  created_at  timestamptz default now()
);


-- ════════════════════════════════════════════════════════════════════════════
-- 2. CITIES
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists cities (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  country_id  uuid references countries(id) on delete set null,
  latitude    decimal(10, 7),
  longitude   decimal(10, 7),
  created_at  timestamptz default now()
);

create index if not exists idx_cities_country on cities(country_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 3. USERS (extends Supabase auth.users)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text,
  display_name        text,
  profile_photo_url   text,
  home_city_id        uuid references cities(id) on delete set null,
  bio                 text,
  visibility          text default 'private' check (visibility in ('public', 'private')),
  health_kit_authorized boolean default false,
  location_permission text default 'denied' check (location_permission in ('always', 'when_in_use', 'denied')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create trigger users_updated_at
  before update on users
  for each row execute function handle_updated_at();

-- Auto-create user profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS
alter table users enable row level security;

create policy "Users can view public profiles"
  on users for select
  using (visibility = 'public' or auth.uid() = id);

create policy "Users can update their own profile"
  on users for update
  using (auth.uid() = id);


-- ════════════════════════════════════════════════════════════════════════════
-- 4. USER FOLLOWS
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists user_follows (
  id            uuid primary key default uuid_generate_v4(),
  follower_id   uuid not null references users(id) on delete cascade,
  following_id  uuid not null references users(id) on delete cascade,
  created_at    timestamptz default now(),
  unique(follower_id, following_id)
);

create index if not exists idx_follows_follower   on user_follows(follower_id);
create index if not exists idx_follows_following  on user_follows(following_id);

alter table user_follows enable row level security;

create policy "Anyone can view follows"
  on user_follows for select using (true);

create policy "Users manage their own follows"
  on user_follows for all
  using (auth.uid() = follower_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 5. STUDIOS
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists studios (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  address             text,
  city                text,
  country             text,
  city_id             uuid references cities(id) on delete set null,
  latitude            decimal(10, 7),
  longitude           decimal(10, 7),
  google_place_id     text unique,
  phone               text,
  website             text,
  instagram_handle    text,
  hero_emoji          text default '🪷',
  is_verified         boolean default false,
  class_types         text[] default '{}',
  avg_rating          decimal(3, 2) default 0,
  review_count        integer default 0,
  created_by_user_id  uuid references users(id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create trigger studios_updated_at
  before update on studios
  for each row execute function handle_updated_at();

create index if not exists idx_studios_city    on studios(city);
create index if not exists idx_studios_rating  on studios(avg_rating desc);
create index if not exists idx_studios_location on studios(latitude, longitude);

alter table studios enable row level security;

create policy "Anyone can view studios"
  on studios for select using (true);

create policy "Authenticated users can submit studios"
  on studios for insert
  with check (auth.uid() is not null);


-- ════════════════════════════════════════════════════════════════════════════
-- 6. STUDIO TAGS
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists studio_tags (
  id          uuid primary key default uuid_generate_v4(),
  studio_id   uuid not null references studios(id) on delete cascade,
  tag         text not null,
  count       integer default 1,
  updated_at  timestamptz default now(),
  unique(studio_id, tag)
);

create index if not exists idx_studio_tags_studio on studio_tags(studio_id);

alter table studio_tags enable row level security;
create policy "Anyone can view studio tags" on studio_tags for select using (true);


-- ════════════════════════════════════════════════════════════════════════════
-- 7. STUDIO PHOTOS
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists studio_photos (
  id                  uuid primary key default uuid_generate_v4(),
  studio_id           uuid not null references studios(id) on delete cascade,
  user_id             uuid not null references users(id) on delete cascade,
  url                 text not null,
  storage_path        text,
  moderation_status   text default 'pending' check (moderation_status in ('pending', 'approved', 'removed')),
  created_at          timestamptz default now()
);

create index if not exists idx_studio_photos_studio on studio_photos(studio_id);

alter table studio_photos enable row level security;

create policy "Anyone can view approved studio photos"
  on studio_photos for select
  using (moderation_status = 'approved' or auth.uid() = user_id);

create policy "Authenticated users can upload studio photos"
  on studio_photos for insert
  with check (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 8. WORKOUTS (from Apple HealthKit)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists workouts (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users(id) on delete cascade,
  apple_workout_uuid  text unique,
  start_time          timestamptz,
  end_time            timestamptz,
  duration_minutes    integer,
  calories_burned     decimal(8, 2),
  avg_heart_rate      decimal(6, 2),
  max_heart_rate      decimal(6, 2),
  workout_type        text,
  source              text,
  latitude            decimal(10, 7),
  longitude           decimal(10, 7),
  matched_to_log      boolean default false,
  created_at          timestamptz default now()
);

create index if not exists idx_workouts_user      on workouts(user_id);
create index if not exists idx_workouts_start     on workouts(start_time desc);

alter table workouts enable row level security;

create policy "Users manage their own workouts"
  on workouts for all
  using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 9. CLASS LOGS
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists class_logs (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users(id) on delete cascade,
  studio_id           uuid references studios(id) on delete set null,
  studio_name_manual  text,           -- if studio not in DB yet
  date                date not null,
  start_time          time,
  end_time            time,
  duration_minutes    integer,
  city                text,
  country             text,
  latitude            decimal(10, 7),
  longitude           decimal(10, 7),
  class_type          text,
  class_type_custom   text,
  instructor          text,
  notes               text,
  rating              smallint check (rating between 1 and 5),
  is_new_studio       boolean default false,
  is_travel_class     boolean default false,
  workout_id          uuid references workouts(id) on delete set null,
  visibility          text default 'private' check (visibility in ('private', 'public')),
  source              text default 'manual' check (source in ('manual', 'auto_detected')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create trigger class_logs_updated_at
  before update on class_logs
  for each row execute function handle_updated_at();

create index if not exists idx_class_logs_user    on class_logs(user_id);
create index if not exists idx_class_logs_date    on class_logs(date desc);
create index if not exists idx_class_logs_studio  on class_logs(studio_id);
create index if not exists idx_class_logs_city    on class_logs(city);

alter table class_logs enable row level security;

create policy "Users manage their own logs"
  on class_logs for all
  using (auth.uid() = user_id);

create policy "Public logs visible to all"
  on class_logs for select
  using (visibility = 'public' or auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 10. CLASS PHOTOS
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists class_photos (
  id            uuid primary key default uuid_generate_v4(),
  class_log_id  uuid not null references class_logs(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  url           text not null,
  storage_path  text,
  caption       text,
  visibility    text default 'private' check (visibility in ('private', 'public')),
  created_at    timestamptz default now()
);

create index if not exists idx_class_photos_log on class_photos(class_log_id);

alter table class_photos enable row level security;

create policy "Users manage their own photos"
  on class_photos for all
  using (auth.uid() = user_id);

create policy "Public photos visible to all"
  on class_photos for select
  using (visibility = 'public' or auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 11. REVIEWS
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists reviews (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users(id) on delete cascade,
  studio_id           uuid not null references studios(id) on delete cascade,
  class_log_id        uuid references class_logs(id) on delete set null,
  rating              smallint not null check (rating between 1 and 5),
  body                text check (char_length(body) <= 500),
  tags                text[] default '{}',
  is_visible          boolean default true,
  moderation_status   text default 'approved' check (moderation_status in ('approved', 'pending', 'removed')),
  created_at          timestamptz default now(),
  unique(user_id, studio_id)  -- one review per user per studio
);

create index if not exists idx_reviews_studio on reviews(studio_id);
create index if not exists idx_reviews_user   on reviews(user_id);

alter table reviews enable row level security;

create policy "Anyone can view approved reviews"
  on reviews for select
  using (moderation_status = 'approved' and is_visible = true);

create policy "Users manage their own reviews"
  on reviews for all
  using (auth.uid() = user_id);

-- Auto-update studio avg_rating when a review is added/updated/deleted
create or replace function update_studio_rating()
returns trigger as $$
begin
  update studios
  set
    avg_rating = (
      select round(avg(rating)::numeric, 2)
      from reviews
      where studio_id = coalesce(new.studio_id, old.studio_id)
        and moderation_status = 'approved'
        and is_visible = true
    ),
    review_count = (
      select count(*)
      from reviews
      where studio_id = coalesce(new.studio_id, old.studio_id)
        and moderation_status = 'approved'
        and is_visible = true
    )
  where id = coalesce(new.studio_id, old.studio_id);
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger reviews_update_studio_rating
  after insert or update or delete on reviews
  for each row execute function update_studio_rating();


-- ════════════════════════════════════════════════════════════════════════════
-- 12. SAVED STUDIOS (wishlist)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists saved_studios (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id) on delete cascade,
  studio_id   uuid not null references studios(id) on delete cascade,
  note        text,
  list_type   text default 'wishlist' check (list_type in ('wishlist', 'favorite', 'revisit')),
  created_at  timestamptz default now(),
  unique(user_id, studio_id)
);

create index if not exists idx_saved_studios_user on saved_studios(user_id);

alter table saved_studios enable row level security;

create policy "Users manage their own saved studios"
  on saved_studios for all
  using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 13. BADGES
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists badges (
  id               uuid primary key default uuid_generate_v4(),
  slug             text unique not null,
  name             text not null,
  description      text,
  unlock_copy      text,
  category         text not null check (category in ('travel', 'studio', 'consistency', 'memory', 'community')),
  icon_name        text,
  criteria_metric  text not null,
  criteria_value   integer not null,
  created_at       timestamptz default now()
);

alter table badges enable row level security;
create policy "Anyone can view badges" on badges for select using (true);


-- ════════════════════════════════════════════════════════════════════════════
-- 14. USER BADGES
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists user_badges (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references users(id) on delete cascade,
  badge_id          uuid not null references badges(id) on delete cascade,
  unlocked_at       timestamptz default now(),
  progress_current  integer default 0,
  progress_target   integer default 1,
  unique(user_id, badge_id)
);

create index if not exists idx_user_badges_user on user_badges(user_id);

alter table user_badges enable row level security;

create policy "Users manage their own badges"
  on user_badges for all
  using (auth.uid() = user_id);

create policy "Public badge display"
  on user_badges for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from users
      where users.id = user_badges.user_id
        and users.visibility = 'public'
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 15. CHALLENGES
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists challenges (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  description      text,
  type             text default 'community' check (type in ('personal', 'community', 'adaptive')),
  category         text check (category in ('consistency', 'travel', 'memory', 'community', 'discovery')),
  target_metric    text not null,
  target_value     integer not null,
  duration_days    integer not null default 7,
  badge_reward_id  uuid references badges(id) on delete set null,
  is_active        boolean default true,
  starts_at        timestamptz default now(),
  ends_at          timestamptz,
  created_at       timestamptz default now()
);

alter table challenges enable row level security;
create policy "Anyone can view active challenges"
  on challenges for select
  using (is_active = true);


-- ════════════════════════════════════════════════════════════════════════════
-- 16. USER CHALLENGES (progress)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists user_challenges (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references users(id) on delete cascade,
  challenge_id      uuid not null references challenges(id) on delete cascade,
  started_at        timestamptz default now(),
  ends_at           timestamptz,
  current_progress  integer default 0,
  status            text default 'active' check (status in ('active', 'completed', 'expired')),
  completed_at      timestamptz,
  unique(user_id, challenge_id, status)
);

create index if not exists idx_user_challenges_user on user_challenges(user_id);

alter table user_challenges enable row level security;

create policy "Users manage their own challenge progress"
  on user_challenges for all
  using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- 17. STORAGE BUCKETS
-- Run these separately in the Supabase Dashboard → Storage
-- ════════════════════════════════════════════════════════════════════════════
-- Create these buckets in Dashboard → Storage → New bucket:
--
-- Bucket name: class-photos     | Public: NO  (private per user, served via signed URLs)
-- Bucket name: studio-photos    | Public: YES (moderated community photos)
-- Bucket name: profile-photos   | Public: YES (avatar images)
--
-- Storage policies (set via Dashboard or via SQL):

insert into storage.buckets (id, name, public) values
  ('class-photos',   'class-photos',   false),
  ('studio-photos',  'studio-photos',  true),
  ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- class-photos: only owner can read/write
create policy "Class photos owner access"
  on storage.objects for all
  using (bucket_id = 'class-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- studio-photos: authenticated upload, public read
create policy "Studio photos public read"
  on storage.objects for select
  using (bucket_id = 'studio-photos');

create policy "Studio photos authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'studio-photos' and auth.uid() is not null);

-- profile-photos: owner write, public read
create policy "Profile photos public read"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "Profile photos owner write"
  on storage.objects for all
  using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);


-- ════════════════════════════════════════════════════════════════════════════
-- 18. SEED DATA — Badges
-- ════════════════════════════════════════════════════════════════════════════
insert into badges (slug, name, description, unlock_copy, category, icon_name, criteria_metric, criteria_value) values
  ('first_class',    'First step',        'Log your first Pilates class',         'The beginning of something beautiful.',        'studio',      '✦',  'classes',      1),
  ('ten_classes',    'Committed',         'Log 10 classes',                        'This is a practice, not just a class.',        'consistency', '🎀', 'classes',      10),
  ('fifty_classes',  'Devoted',           'Log 50 classes',                        'Your body knows this by heart now.',           'consistency', '💪', 'classes',      50),
  ('hundred_classes','Centurion',         'Log 100 classes',                       'A hundred moments of intention.',              'consistency', '💎', 'classes',      100),
  ('first_studio',   'Studio debut',      'Visit your first studio',               'Your first pin on the map.',                   'studio',      '🪷', 'studios',      1),
  ('five_studios',   'Studio collector',  'Visit 5 different studios',             'You know your studios.',                       'studio',      '🗂️', 'studios',      5),
  ('ten_studios',    'Connoisseur',       'Visit 10 different studios',            'A refined practice, widely explored.',         'studio',      '🏛️', 'studios',      10),
  ('first_city',     'First city',        'Log a class in any city',               'Your practice has a new home.',                'travel',      '📍', 'cities',       1),
  ('five_cities',    'Wanderer',          'Log classes in 5 different cities',     'Pilates, in five places.',                     'travel',      '🌍', 'cities',       5),
  ('international',  'International',     'Log a class in a different country',    'Your passport just got stamped.',              'travel',      '✈️', 'countries',    2),
  ('three_countries','Pilates Passport',  'Log classes in 3+ countries',           'You have earned your Pilates Passport.',        'travel',      '🛂', 'countries',    3),
  ('first_photo',    'Archivist',         'Upload your first class photo',         'Captured.',                                    'memory',      '📸', 'photos',       1),
  ('five_photos',    'Memory keeper',     'Upload photos for 5 classes',           'A beautiful record of your practice.',         'memory',      '🖼️', 'photos',       5),
  ('early_bird',     'Early riser',       'Log 3 classes before 9am',              'The quiet mornings are yours.',                'consistency', '🌅', 'earlyClasses', 3),
  ('first_review',   'First voice',       'Submit your first studio review',       'Others will find the right studio because of you.', 'community', '⭐', 'reviews', 1),
  ('five_reviews',   'Trusted reviewer',  'Submit 5 studio reviews',               'Your perspective matters.',                    'community',   '🌟', 'reviews',      5)
on conflict (slug) do nothing;


-- ════════════════════════════════════════════════════════════════════════════
-- 19. SEED DATA — Challenges
-- ════════════════════════════════════════════════════════════════════════════
insert into challenges (title, description, type, category, target_metric, target_value, duration_days, is_active, ends_at) values
  ('3 classes this week',    'Move your body three times.',              'community', 'consistency', 'classes_week',       3, 7,  true, now() + interval '7 days'),
  ('Try a new studio',       'Somewhere you have never been.',           'community', 'discovery',   'new_studios_month',  1, 30, true, now() + interval '30 days'),
  ('Log with photos',        '5 classes with memories captured.',        'community', 'memory',      'photo_classes',      5, 30, true, now() + interval '30 days'),
  ('Morning Pilates week',   'Log a class before 9am, 5 days.',         'community', 'consistency', 'early_classes',      5, 7,  true, now() + interval '14 days'),
  ('Write 2 reviews',        'Share your experience with the community.','community', 'community',   'reviews',            2, 30, true, now() + interval '30 days'),
  ('4-week streak',          'At least one class per week for 4 weeks.', 'community', 'consistency', 'weekly_streak',      4, 28, true, now() + interval '28 days'),
  ('International class',    'Take a class in a new country.',           'community', 'travel',      'countries',          2, 90, true, now() + interval '90 days')
on conflict do nothing;


-- ════════════════════════════════════════════════════════════════════════════
-- 20. SEED DATA — Sample studios (London, Paris, NYC, Melbourne)
-- ════════════════════════════════════════════════════════════════════════════
insert into studios (name, address, city, country, latitude, longitude, hero_emoji, is_verified, class_types, website, avg_rating, review_count) values
  ('The Pilates Studio',  '148 Spring St',       'New York',  'USA',       40.7241, -74.0004, '🪷', true,  ARRAY['Reformer','Tower','Mat'],  'https://thepilatesstudio.com',   4.9, 124),
  ('Core & Grace',        '45 Perry St',         'New York',  'USA',       40.7354, -74.0046, '🌸', false, ARRAY['Mat','Reformer'],          'https://coreandgrace.com',       4.7, 89),
  ('Align Pilates',       '22 Franklin St',      'New York',  'USA',       40.7194, -74.0083, '🌿', true,  ARRAY['Tower','Reformer'],        'https://alignpilates.com',       4.8, 67),
  ('Studio Forme',        '12 Marylebone Ln',    'London',    'UK',        51.5172, -0.1493,  '🕊️', true,  ARRAY['Reformer','Private'],     'https://studioforme.co.uk',      4.9, 211),
  ('Mouvement Paris',     '8 Rue du Bac',        'Paris',     'France',    48.8554, 2.3281,   '🥐', false, ARRAY['Reformer','Private'],      'https://mouvementparis.fr',      4.8, 55),
  ('Pilates Republic',    '88 Collins St',       'Melbourne', 'Australia', -37.8142, 144.9632,'🌏', true,  ARRAY['Reformer','Mat','Group'],  'https://pilatesrepublic.com.au', 4.6, 143)
on conflict do nothing;
