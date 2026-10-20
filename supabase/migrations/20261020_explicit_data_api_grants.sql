-- Explicit Data API grants for the public schema.
--
-- Supabase no longer grants Data API access to new public tables automatically.
-- TaskZM reaches its data through the edge function using service_role. The only
-- direct client read is calendar_events SELECT (Apple calendar view), which is
-- limited to the caller's own rows by RLS. Every other table is server-only.
--
-- New tables: enable RLS, then grant service_role explicitly. Grant anon or
-- authenticated only for direct client access, with matching own-row policies.

-- 1. Stop automatic grants on objects created later in public.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- 2. Remove policies that apply to every role with USING (true).
--    service_role bypasses RLS, so these never served the edge function.
drop policy if exists "Service role has full access" on public.calendar_events;
drop policy if exists "Service role has full access to calendar events" on public.calendar_events;
drop policy if exists "Users can update shared terminology usage" on public.shared_terminology;

-- 3. Replace inherited blanket grants with explicit per-table grants.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'calendar_events',
    'kv_store_65e6e67f',
    'profiles',
    'push_device_tokens',
    'shared_terminology',
    'tags',
    'tasks',
    'user_awards',
    'user_settings'
  ]
  loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('grant select, insert, update, delete on table public.%I to service_role', t);
    end if;
  end loop;
end
$$;

grant select on table public.calendar_events to authenticated;

drop policy if exists "Users can view their own calendar events" on public.calendar_events;
create policy "Users can view their own calendar events"
  on public.calendar_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 4. SECURITY DEFINER functions are server-only.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end
$$;
