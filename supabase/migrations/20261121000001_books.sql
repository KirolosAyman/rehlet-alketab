-- Bible books catalog & grouping
-- Idempotent

create table if not exists public.books (
  id          uuid primary key default gen_random_uuid(),
  testament   text not null check (testament in ('old', 'new')),
  name        text not null unique,
  name_norm   text not null unique,
  chapters    int  not null check (chapters > 0),
  sort_order  int  not null default 0,
  board_open  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists books_testament_sort_idx on public.books(testament, sort_order);

-- RLS: deny all by default, service-role only
alter table public.books enable row level security;
revoke all on public.books from anon, authenticated;

-- Add book_id to quizzes and assignments
alter table public.quizzes add column if not exists book_id uuid references public.books(id) on delete set null;
alter table public.assignments add column if not exists book_id uuid references public.books(id) on delete set null;

create index if not exists quizzes_book_id_idx on public.quizzes(book_id);
create index if not exists assignments_book_id_idx on public.assignments(book_id);

-- Seed 66 canonical books (39 Old Testament + 27 New Testament)
insert into public.books (testament, name, name_norm, chapters, sort_order, board_open) values
  -- Old Testament (39)
  ('old', 'التكوين', 'التكوين', 50, 1, false),
  ('old', 'الخروج', 'الخروج', 40, 2, false),
  ('old', 'اللاويين', 'اللاويين', 27, 3, false),
  ('old', 'العدد', 'العدد', 36, 4, false),
  ('old', 'التثنية', 'التثنيه', 34, 5, false),
  ('old', 'يشوع', 'يشوع', 24, 6, false),
  ('old', 'القضاة', 'القضاه', 21, 7, false),
  ('old', 'راعوث', 'راعوث', 4, 8, false),
  ('old', 'صموئيل الأول', 'صموئيل الاول', 31, 9, false),
  ('old', 'صموئيل الثاني', 'صموئيل الثاني', 24, 10, false),
  ('old', 'الملوك الأول', 'الملوك الاول', 22, 11, false),
  ('old', 'الملوك الثاني', 'الملوك الثاني', 25, 12, false),
  ('old', 'أخبار الأيام الأول', 'اخبار الايام الاول', 29, 13, false),
  ('old', 'أخبار الأيام الثاني', 'اخبار الايام الثاني', 36, 14, false),
  ('old', 'عزرا', 'عزرا', 10, 15, false),
  ('old', 'نحميا', 'نحميا', 13, 16, false),
  ('old', 'أستير', 'استير', 10, 17, false),
  ('old', 'أيوب', 'ايوب', 42, 18, false),
  ('old', 'المزامير', 'المزامير', 150, 19, false),
  ('old', 'الأمثال', 'الامثال', 31, 20, false),
  ('old', 'الجامعة', 'الجامعه', 12, 21, false),
  ('old', 'نشيد الأنشاد', 'نشيد الانشاد', 8, 22, false),
  ('old', 'إشعياء', 'اشعياء', 66, 23, false),
  ('old', 'إرميا', 'ارميا', 52, 24, false),
  ('old', 'مراثي إرميا', 'مراثي ارميا', 5, 25, false),
  ('old', 'حزقيال', 'حزقيال', 48, 26, false),
  ('old', 'دانيال', 'دانيال', 12, 27, false),
  ('old', 'هوشع', 'هوشع', 14, 28, false),
  ('old', 'يوئيل', 'يوئيل', 3, 29, false),
  ('old', 'عاموس', 'عاموس', 9, 30, false),
  ('old', 'عوبديا', 'عوبديا', 1, 31, false),
  ('old', 'يونان', 'يونان', 4, 32, false),
  ('old', 'ميخا', 'ميخا', 7, 33, false),
  ('old', 'ناحوم', 'ناحوم', 3, 34, false),
  ('old', 'حبقوق', 'حبقوق', 3, 35, false),
  ('old', 'صفنيا', 'صفنيا', 3, 36, false),
  ('old', 'حجي', 'حجي', 2, 37, false),
  ('old', 'زكريا', 'زكريا', 14, 38, false),
  ('old', 'ملاخي', 'ملاخي', 4, 39, false),

  -- New Testament (27)
  ('new', 'متى', 'متي', 28, 40, false),
  ('new', 'مرقس', 'مرقس', 16, 41, false),
  ('new', 'لوقا', 'لوقا', 24, 42, false),
  ('new', 'يوحنا', 'يوحنا', 21, 43, false),
  ('new', 'أعمال الرسل', 'اعمال الرسل', 28, 44, false),
  ('new', 'رومية', 'روميه', 16, 45, false),
  ('new', 'كورنثوس الأولى', 'كورنثوس الاولي', 16, 46, false),
  ('new', 'كورنثوس الثانية', 'كورنثوس الثانيه', 13, 47, false),
  ('new', 'غلاطية', 'غلاطيه', 6, 48, false),
  ('new', 'أفسس', 'افسس', 6, 49, false),
  ('new', 'فيلبي', 'فيلبي', 4, 50, false),
  ('new', 'كولوسي', 'كولوسي', 4, 51, false),
  ('new', 'تسالونيكي الأولى', 'تسالونيكي الاولي', 5, 52, false),
  ('new', 'تسالونيكي الثانية', 'تسالونيكي الثانيه', 3, 53, false),
  ('new', 'تيموثاوس الأولى', 'تيموثاوس الاولي', 6, 54, false),
  ('new', 'تيموثاوس الثانية', 'تيموثاوس الثانيه', 4, 55, false),
  ('new', 'تيطس', 'تيطس', 3, 56, false),
  ('new', 'فليمون', 'فليمون', 1, 57, false),
  ('new', 'العبرانيين', 'العبرانيين', 13, 58, false),
  ('new', 'يعقوب', 'يعقوب', 5, 59, false),
  ('new', 'بطرس الأولى', 'بطرس الاولي', 5, 60, false),
  ('new', 'بطرس الثانية', 'بطرس الثانيه', 3, 61, false),
  ('new', 'يوحنا الأولى', 'يوحنا الاولي', 5, 62, false),
  ('new', 'يوحنا الثانية', 'يوحنا الثانيه', 1, 63, false),
  ('new', 'يوحنا الثالثة', 'يوحنا الثالثه', 1, 64, false),
  ('new', 'يهوذا', 'يهوذا', 1, 65, false),
  ('new', 'الرؤيا', 'الرؤيا', 22, 66, false)
on conflict (name) do nothing;

-- Link existing quizzes and assignments to books by name
update public.quizzes q
set book_id = b.id
from public.books b
where q.book_id is null
  and (b.name = q.book or b.name_norm = lower(regexp_replace(q.book, '\s+', ' ', 'g')));

update public.assignments a
set book_id = b.id
from public.books b
where a.book_id is null
  and (b.name = a.book or b.name_norm = lower(regexp_replace(a.book, '\s+', ' ', 'g')));
