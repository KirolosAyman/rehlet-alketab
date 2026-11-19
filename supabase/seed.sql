-- Test data for local/dev checks (D-008). NEVER run on the production project.
-- Dates are relative to "today" in Africa/Cairo, so the seed stays useful any day.
-- Idempotent via fixed UUIDs + on conflict do nothing.

-- Students: all with pass_hash NULL → each must choose a password on first login.
insert into public.students(id, username, username_norm, display_name) values
  ('00000000-0000-0000-0000-000000000001', 'مينا',  'مينا',  'مينا'),
  ('00000000-0000-0000-0000-000000000002', 'أحمد',  'احمد',  'أحمد'),
  ('00000000-0000-0000-0000-000000000003', 'مريم',  'مريم',  'مريم')
on conflict do nothing;

-- Quizzes
--  Q1 today, published, opens 19:00 → waiting/open depending on Cairo time
--  Q2 yesterday, published → missed, except for مينا (unlocked)
--  Q3 two days ago, published, authored by مريم → "author" state for her
--  Q4 today, draft → hidden (proves drafts can share a date with a published quiz)
insert into public.quizzes(id, quiz_date, book, chapter, opens_at, status, author_id, questions) values
 ('10000000-0000-0000-0000-000000000001', (now() at time zone 'Africa/Cairo')::date,     'صموئيل الثاني', '1', '19:00', 'published', null,
  '[{"type":"mcq","q":"من أخبر داود بموت شاول؟","options":["غلام عماليقي","يوآب","أبنير"],"answer":0},
    {"type":"tf","q":"رثى داود شاول ويوناثان.","options":["صح","خطأ"],"answer":0},
    {"type":"essay","q":"اكتب باختصار ماذا فعل داود عندما سمع الخبر.","options":[],"answer":0,"model":"مزق ثيابه وناح وبكى وصام.","grading":"ai"}]'),
 ('10000000-0000-0000-0000-000000000002', (now() at time zone 'Africa/Cairo')::date - 1, 'صموئيل الثاني', '2', null, 'published', null,
  '[{"type":"mcq","q":"أين مُسح داود ملكًا على بيت يهوذا؟","options":["حبرون","أورشليم","بيت لحم"],"answer":0},
    {"type":"essay","q":"ماذا طلب داود من رجال يابيش جلعاد؟","options":[],"answer":0,"model":"باركهم لأنهم دفنوا شاول.","grading":"manual"}]'),
 ('10000000-0000-0000-0000-000000000003', (now() at time zone 'Africa/Cairo')::date - 2, 'صموئيل الثاني', '3', null, 'published',
  '00000000-0000-0000-0000-000000000003',
  '[{"type":"fill","q":"قتل ______ أبنير في حبرون.","options":["يوآب","أبيشاي","عسائيل"],"answer":0}]'),
 ('10000000-0000-0000-0000-000000000004', (now() at time zone 'Africa/Cairo')::date,     'صموئيل الثاني', '1', null, 'draft', null, '[]')
on conflict do nothing;

insert into public.quiz_unlocks(quiz_id, student_id) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- Assignment: أحمد writes questions for chapter 4, due today.
insert into public.assignments(id, student_id, book, chapter, day) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'صموئيل الثاني', '4', (now() at time zone 'Africa/Cairo')::date)
on conflict do nothing;
