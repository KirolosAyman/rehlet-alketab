-- Quiz availability is controlled by its Cairo-local date, not an opening hour.
update public.quizzes
set opens_at = null
where opens_at is not null;
