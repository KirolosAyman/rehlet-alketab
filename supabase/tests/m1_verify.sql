-- M1 acceptance check. Run in the Supabase SQL editor (or psql) AFTER the migration.
-- Expected: every row shows rls_on = true, forced = true, anon_select = false, auth_select = false.
select c.relname                                         as table_name,
       c.relrowsecurity                                  as rls_on,
       c.relforcerowsecurity                             as forced,
       has_table_privilege('anon',          c.oid, 'SELECT') as anon_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- Practical test as the anon role (must fail with "permission denied"):
-- set role anon; select * from public.students; reset role;
