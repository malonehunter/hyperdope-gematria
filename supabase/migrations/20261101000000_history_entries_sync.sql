-- =====================================================================
-- Atomic saved-history reconciliation
--
-- Ordinary client saves call this function with the complete supported
-- snapshot. The caller identity always comes from the verified session; no
-- user id is accepted from the client. Safe to re-run.
-- =====================================================================

create or replace function public.history_entries_sync(phrases text[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  phrase_count integer;
begin
  if caller_id is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if phrases is null then
    raise exception 'History snapshot is required.' using errcode = '22023';
  end if;

  phrase_count := cardinality(phrases);
  if cardinality(phrases) > 2000 then
    raise exception 'History snapshot exceeds 2000 phrases.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(phrases) as candidate(phrase)
    where candidate.phrase is null
       or length(btrim(candidate.phrase)) = 0
       or length(candidate.phrase) > 2000
  ) then
    raise exception 'History contains an invalid phrase.' using errcode = '22023';
  end if;

  -- Serialize reconciliation for this member so two tabs cannot interleave
  -- their delete/upsert phases into a mixed snapshot.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );

  select count(distinct candidate.phrase)::integer
  into phrase_count
  from unnest(phrases) as candidate(phrase);

  with incoming as (
    select candidate.phrase, (min(candidate.ordinality) - 1)::integer as position
    from unnest(phrases) with ordinality as candidate(phrase, ordinality)
    group by candidate.phrase
  )
  delete from public.history_entries as saved
  where saved.user_id = caller_id
    and not exists (
      select 1 from incoming where incoming.phrase = saved.phrase
    );

  with incoming as (
    select candidate.phrase, (min(candidate.ordinality) - 1)::integer as position
    from unnest(phrases) with ordinality as candidate(phrase, ordinality)
    group by candidate.phrase
  )
  insert into public.history_entries (user_id, phrase, position)
  select caller_id, incoming.phrase, incoming.position
  from incoming
  on conflict (user_id, phrase) do update
    set position = excluded.position;

  return phrase_count;
end
$function$;

revoke all on function public.history_entries_sync(text[]) from public, anon, authenticated;
grant execute on function public.history_entries_sync(text[]) to authenticated;
