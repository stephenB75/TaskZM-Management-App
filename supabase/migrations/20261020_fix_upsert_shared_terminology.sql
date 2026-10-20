-- upsert_shared_terminology runs with an empty search_path, so table references must be
-- schema-qualified; the unqualified name failed with 42P01 (PostgREST 404) on every call.
-- Only the edge function (service_role) calls it, so it runs as the caller.

create or replace function public.upsert_shared_terminology(
  p_domain text,
  p_term_type text,
  p_term text,
  p_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_term_lower text := lower(trim(p_term));
begin
  insert into public.shared_terminology as st (domain, term_type, term, term_lower, created_by, usage_count, last_used_at)
  values (p_domain, p_term_type, trim(p_term), v_term_lower, p_user_id, 1, now())
  on conflict (domain, term_type, term_lower)
  do update set
    usage_count = st.usage_count + 1,
    last_used_at = now(),
    updated_at = now();
end;
$$;

revoke execute on function public.upsert_shared_terminology(text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.upsert_shared_terminology(text, text, text, uuid) to service_role;
