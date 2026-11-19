-- Atomic rate-limit counter (D-004). Callable only by the service role.
-- Idempotent.
create or replace function public.rate_limit_hit(p_key text, p_window_start timestamptz)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare n int;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into n;

  -- Opportunistic cleanup of old windows (cheap thanks to the index).
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return n;
end $$;

revoke all on function public.rate_limit_hit(text, timestamptz) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, timestamptz) to service_role;
