-- ═══════════════════════════════════════════════════════
-- PILATES PASSPORT — PART 2: STORAGE + SEED DATA
-- Run this AFTER Part 1 completes successfully
-- ═══════════════════════════════════════════════════════

-- ── STORAGE BUCKETS ──────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('class-photos',   'class-photos',   false),
  ('studio-photos',  'studio-photos',  true),
  ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "Class photos owner access"
  on storage.objects for all
  using (bucket_id = 'class-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Studio photos public read"
  on storage.objects for select
  using (bucket_id = 'studio-photos');

create policy "Studio photos authenticated upload"
  on storage.objects for insert
  with check (bucket_id = 'studio-photos' and auth.uid() is not null);

create policy "Profile photos public read"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

create policy "Profile photos owner write"
  on storage.objects for all
  using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ── SEED: BADGES ─────────────────────────────────────────
insert into badges (slug, name, description, unlock_copy, category, icon_name, criteria_metric, criteria_value) values
  ('first_class',     'First step',       'Log your first Pilates class',          'The beginning of something beautiful.',   'studio',      '✦',  'classes',      1),
  ('ten_classes',     'Committed',        'Log 10 classes',                         'This is a practice, not just a class.',   'consistency', '🎀', 'classes',      10),
  ('fifty_classes',   'Devoted',          'Log 50 classes',                         'Your body knows this by heart now.',      'consistency', '💪', 'classes',      50),
  ('hundred_classes', 'Centurion',        'Log 100 classes',                        'A hundred moments of intention.',         'consistency', '💎', 'classes',      100),
  ('first_studio',    'Studio debut',     'Visit your first studio',                'Your first pin on the map.',              'studio',      '🪷', 'studios',      1),
  ('five_studios',    'Studio collector', 'Visit 5 different studios',              'You know your studios.',                  'studio',      '🗂️', 'studios',      5),
  ('ten_studios',     'Connoisseur',      'Visit 10 different studios',             'A refined practice, widely explored.',    'studio',      '🏛️', 'studios',      10),
  ('first_city',      'First city',       'Log a class in any city',               'Your practice has a new home.',           'travel',      '📍', 'cities',       1),
  ('five_cities',     'Wanderer',         'Log classes in 5 different cities',      'Pilates, in five places.',               'travel',      '🌍', 'cities',       5),
  ('international',   'International',    'Log a class in a different country',     'Your passport just got stamped.',         'travel',      '✈️', 'countries',    2),
  ('three_countries', 'Pilates Passport', 'Log classes in 3 or more countries',     'You have earned your Pilates Passport.',  'travel',      '🛂', 'countries',    3),
  ('first_photo',     'Archivist',        'Upload your first class photo',          'Captured.',                               'memory',      '📸', 'photos',       1),
  ('five_photos',     'Memory keeper',    'Upload photos for 5 classes',            'A beautiful record of your practice.',    'memory',      '🖼️', 'photos',       5),
  ('early_bird',      'Early riser',      'Log 3 classes before 9am',              'The quiet mornings are yours.',           'consistency', '🌅', 'earlyClasses', 3),
  ('first_review',    'First voice',      'Submit your first studio review',        'Others will find the right studio because of you.', 'community', '⭐', 'reviews', 1),
  ('five_reviews',    'Trusted reviewer', 'Submit 5 studio reviews',               'Your perspective matters.',               'community',   '🌟', 'reviews',      5)
on conflict (slug) do nothing;

-- ── SEED: CHALLENGES ─────────────────────────────────────
insert into challenges (title, description, type, category, target_metric, target_value, duration_days, is_active, ends_at) values
  ('3 classes this week',  'Move your body three times.',               'community', 'consistency', 'classes_week',      3, 7,  true, now() + interval '7 days'),
  ('Try a new studio',     'Somewhere you have never been.',            'community', 'discovery',   'new_studios_month', 1, 30, true, now() + interval '30 days'),
  ('Log with photos',      '5 classes with memories captured.',         'community', 'memory',      'photo_classes',     5, 30, true, now() + interval '30 days'),
  ('Morning Pilates week', 'Log a class before 9am, 5 days.',          'community', 'consistency', 'early_classes',     5, 7,  true, now() + interval '14 days'),
  ('Write 2 reviews',      'Share your experience with the community.', 'community', 'community',   'reviews',           2, 30, true, now() + interval '30 days'),
  ('4-week streak',        'At least one class per week for 4 weeks.',  'community', 'consistency', 'weekly_streak',     4, 28, true, now() + interval '28 days'),
  ('International class',  'Take a class in a new country.',            'community', 'travel',      'countries',         2, 90, true, now() + interval '90 days')
on conflict do nothing;

-- ── SEED: SAMPLE STUDIOS ─────────────────────────────────
insert into studios (name, address, city, country, latitude, longitude, hero_emoji, is_verified, class_types, website, avg_rating, review_count) values
  ('The Pilates Studio', '148 Spring St',    'New York',  'USA',       40.7241,  -74.0004,  '🪷', true,  ARRAY['Reformer','Tower','Mat'],   'https://thepilatesstudio.com',   4.9, 124),
  ('Core & Grace',       '45 Perry St',      'New York',  'USA',       40.7354,  -74.0046,  '🌸', false, ARRAY['Mat','Reformer'],           'https://coreandgrace.com',       4.7, 89),
  ('Align Pilates',      '22 Franklin St',   'New York',  'USA',       40.7194,  -74.0083,  '🌿', true,  ARRAY['Tower','Reformer'],         'https://alignpilates.com',       4.8, 67),
  ('Studio Forme',       '12 Marylebone Ln', 'London',    'UK',        51.5172,  -0.1493,   '🕊️', true,  ARRAY['Reformer','Private'],       'https://studioforme.co.uk',      4.9, 211),
  ('Mouvement Paris',    '8 Rue du Bac',     'Paris',     'France',    48.8554,  2.3281,    '🥐', false, ARRAY['Reformer','Private'],       'https://mouvementparis.fr',      4.8, 55),
  ('Pilates Republic',   '88 Collins St',    'Melbourne', 'Australia', -37.8142, 144.9632,  '🌏', true,  ARRAY['Reformer','Mat','Group'],   'https://pilatesrepublic.com.au', 4.6, 143)
on conflict do nothing;
