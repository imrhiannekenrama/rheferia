-- ============================================================================
-- Rheferia schema, migration 0001
--
-- Design principles:
--   * Row-level security on EVERY user table; deny-by-default.
--   * auth.uid() based ownership; project membership gates shared access.
--   * Guest limits enforced durably (guest_usage, rate_limits).
--   * No secrets in this file.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. profiles — public account data, keyed to auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  full_name text,
  institution text,
  orcid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. user_settings — per-account preferences and honest feature flags
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_citation_style text not null default 'apa',
  locale text not null default 'en-US',
  save_search_history boolean not null default false,
  email_notifications boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_style_check
    check (default_citation_style in ('apa','mla','chicago','ieee','vancouver','harvard'))
);

-- 3. projects — private research projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. project_members — collaboration membership (owner + invited members)
create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member'
    constraint project_member_role_check check (role in ('owner','editor','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- 5. saved_sources — sources the user saved (denormalized snapshot + live ref)
create table public.saved_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  record_id text not null,            -- opaque provider id, e.g. "openalex:W123"
  title text not null,
  authors jsonb not null default '[]',
  year int,
  venue text,
  publisher text,
  doi text,
  resource_type text not null default 'other',
  abstract text,
  access_status text not null default 'unknown'
    constraint saved_source_access_check check (access_status in
      ('open-access','link-reported','source-access-required','metadata-only','unknown')),
  source_url text,
  providers jsonb not null default '[]',
  retrieved_at timestamptz,
  notes_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, record_id)
);
create index saved_sources_user_idx on public.saved_sources (user_id, created_at desc);
create index saved_sources_project_idx on public.saved_sources (project_id);

-- 6. notes — user notes attached to saved sources or projects
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  saved_source_id uuid references public.saved_sources (id) on delete cascade,
  body text not null,
  quote text,                          -- exact passage being annotated
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_target_check check (
    saved_source_id is not null or project_id is not null
  )
);
create index notes_source_idx on public.notes (saved_source_id, created_at desc);

-- 7. tags — user-owned labels
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- 8. source_tags — saved_source ↔ tag join
create table public.source_tags (
  saved_source_id uuid not null references public.saved_sources (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (saved_source_id, tag_id)
);

-- 9. citations — a user's editable citation records
create table public.citations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  saved_source_id uuid references public.saved_sources (id) on delete set null,
  style_data jsonb not null default '{}',   -- fields: authors, year, title, container, ...
  doi text,
  url text,
  is_verified boolean not null default false, -- user checked it against the original
  completeness_flag text,                    -- non-null = "review this" marker
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index citations_user_idx on public.citations (user_id, created_at desc);

-- 10. reference_lists — ordered, exportable lists
create table public.reference_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  name text not null,
  style text not null default 'apa'
    constraint reference_list_style_check check (style in
      ('apa','mla','chicago','ieee','vancouver','harvard')),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. reference_list_items — ordered membership in a list
create table public.reference_list_items (
  list_id uuid not null references public.reference_lists (id) on delete cascade,
  citation_id uuid not null references public.citations (id) on delete cascade,
  position int not null default 0,
  added_at timestamptz not null default now(),
  primary key (list_id, citation_id)
);

-- 12. citation_styles — per-user custom style overrides (phase 3)
create table public.citation_styles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  base_style text not null
    constraint citation_style_base_check check (base_style in
      ('apa','mla','chicago','ieee','vancouver','harvard')),
  name text not null,
  rules jsonb not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 13. search_history — only stored when the account opted in
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  query text not null,
  mode text not null default 'auto',
  result_count int not null default 0,
  created_at timestamptz not null default now()
);
create index search_history_user_idx on public.search_history (user_id, created_at desc);

-- 14. guest_usage — durable daily caps for anonymous users
create table public.guest_usage (
  ip_hash text primary key,             -- SHA-256, never the raw IP
  usage_date date not null default current_date,
  searches_used int not null default 0,
  conversions_used int not null default 0,
  updated_at timestamptz not null default now()
);

-- 15. rate_limits — fixed-window bucket counters (multi-instance safe)
create table public.rate_limits (
  bucket text primary key,              -- e.g. "guest-search:<hash>"
  window_start timestamptz not null,
  count int not null default 0
);

-- 16. conversions — cloud conversion records with lifecycle + honesty data
create table public.conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_slug text not null,
  original_name text not null,
  original_size_bytes bigint not null default 0,
  output_name text,
  output_size_bytes bigint,
  status text not null default 'pending'
    constraint conversion_status_check check (status in
      ('pending','processing','succeeded','failed','expired')),
  failure_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversions_user_idx on public.conversions (user_id, created_at desc);

-- 17. feedback — "we missed something" reports from the search UI
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null default 'coverage'
    constraint feedback_kind_check check (kind in
      ('coverage','access','citation','broken-link','other')),
  query text,
  details text,
  record_id text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Triggers
-- ============================================================================

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger saved_sources_touch before update on public.saved_sources
  for each row execute function public.touch_updated_at();
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();
create trigger citations_touch before update on public.citations
  for each row execute function public.touch_updated_at();
create trigger reference_lists_touch before update on public.reference_lists
  for each row execute function public.touch_updated_at();
create trigger citation_styles_touch before update on public.citation_styles
  for each row execute function public.touch_updated_at();
create trigger conversions_touch before update on public.conversions
  for each row execute function public.touch_updated_at();

-- Auto-create profile + settings + default favorites on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(coalesce(new.email, ''), '@', 1),
      'Researcher'
    ),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.projects (owner_id, name)
  values (new.id, 'My first project');
  insert into public.project_members (project_id, user_id, role)
  select p.id, new.id, 'owner' from public.projects p
  where p.owner_id = new.id
  order by p.created_at limit 1;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- notes_count maintenance on saved_sources
create or replace function public.update_notes_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.saved_source_id is not null) then
    update public.saved_sources set notes_count = notes_count + 1
      where id = new.saved_source_id;
  elsif (tg_op = 'DELETE' and old.saved_source_id is not null) then
    update public.saved_sources set notes_count = greatest(notes_count - 1, 0)
      where id = old.saved_source_id;
  end if;
  return coalesce(new, old);
end $$;

create trigger notes_count_trigger
  after insert or delete on public.notes
  for each row execute function public.update_notes_count();

-- ============================================================================
-- Row-level security: enable everywhere, deny by default
-- ============================================================================
alter table public.profiles          enable row level security;
alter table public.user_settings     enable row level security;
alter table public.projects          enable row level security;
alter table public.project_members   enable row level security;
alter table public.saved_sources     enable row level security;
alter table public.notes             enable row level security;
alter table public.tags              enable row level security;
alter table public.source_tags       enable row level security;
alter table public.citations         enable row level security;
alter table public.reference_lists   enable row level security;
alter table public.reference_list_items enable row level security;
alter table public.citation_styles   enable row level security;
alter table public.search_history   enable row level security;
alter table public.guest_usage       enable row level security;
alter table public.rate_limits       enable row level security;
alter table public.conversions       enable row level security;
alter table public.feedback          enable row level security;

-- Helper: is the caller a member of this project?
create or replace function public.is_project_member(target_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_members
    where project_id = target_project
      and user_id = auth.uid()
  );
$$;

-- profiles: public read of basic profile, self-write only
create policy profiles_select on public.profiles
  for select using (true);
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- user_settings: strictly private
create policy user_settings_all on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- projects: owner or member read; owner write; member update (non-destructive)
create policy projects_select on public.projects
  for select using (owner_id = auth.uid() or public.is_project_member(id));
create policy projects_insert on public.projects
  for insert with check (owner_id = auth.uid());
create policy projects_update on public.projects
  for update using (owner_id = auth.uid() or public.is_project_member(id));
create policy projects_delete on public.projects
  for delete using (owner_id = auth.uid());

-- project_members: visible to project members; owner manages membership
create policy project_members_select on public.project_members
  for select using (
    public.is_project_member(project_id)
    or exists (select 1 from public.projects p
               where p.id = project_id and p.owner_id = auth.uid())
  );
create policy project_members_insert on public.project_members
  for insert with check (
    exists (select 1 from public.projects p
            where p.id = project_id and p.owner_id = auth.uid())
  );
create policy project_members_delete on public.project_members
  for delete using (
    exists (select 1 from public.projects p
            where p.id = project_id and p.owner_id = auth.uid())
    or user_id = auth.uid()
  );

-- saved_sources: owner full control; project members can read
create policy saved_sources_select on public.saved_sources
  for select using (
    user_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
  );
create policy saved_sources_insert on public.saved_sources
  for insert with check (user_id = auth.uid());
create policy saved_sources_update on public.saved_sources
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_sources_delete on public.saved_sources
  for delete using (user_id = auth.uid());

-- notes: owner full control; project members read project notes
create policy notes_select on public.notes
  for select using (
    user_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
  );
create policy notes_insert on public.notes
  for insert with check (user_id = auth.uid());
create policy notes_update on public.notes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notes_delete on public.notes
  for delete using (user_id = auth.uid());

-- tags, source_tags: owner-scoped through ownership chain
create policy tags_all on public.tags
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy source_tags_all on public.source_tags
  for all using (
    exists (select 1 from public.saved_sources s
            where s.id = saved_source_id and s.user_id = auth.uid())
    and exists (select 1 from public.tags t
                where t.id = tag_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.saved_sources s
            where s.id = saved_source_id and s.user_id = auth.uid())
    and exists (select 1 from public.tags t
                where t.id = tag_id and t.user_id = auth.uid())
  );

-- citations: owner full control; project members read
create policy citations_select on public.citations
  for select using (
    user_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
  );
create policy citations_insert on public.citations
  for insert with check (user_id = auth.uid());
create policy citations_update on public.citations
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy citations_delete on public.citations
  for delete using (user_id = auth.uid());

-- reference_lists + items: owner full control; members read
create policy reference_lists_select on public.reference_lists
  for select using (
    user_id = auth.uid()
    or (project_id is not null and public.is_project_member(project_id))
  );
create policy reference_lists_all_owner on public.reference_lists
  for insert with check (user_id = auth.uid());
create policy reference_lists_update on public.reference_lists
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reference_lists_delete on public.reference_lists
  for delete using (user_id = auth.uid());

create policy reference_list_items_select on public.reference_list_items
  for select using (
    exists (select 1 from public.reference_lists l
            where l.id = list_id
              and (l.user_id = auth.uid()
                   or (l.project_id is not null
                       and public.is_project_member(l.project_id))))
  );
create policy reference_list_items_all_owner on public.reference_list_items
  for all using (
    exists (select 1 from public.reference_lists l
            where l.id = list_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.reference_lists l
            where l.id = list_id and l.user_id = auth.uid())
    and exists (select 1 from public.citations c
                where c.id = citation_id and c.user_id = auth.uid())
  );

-- citation_styles: strictly private
create policy citation_styles_all on public.citation_styles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- search_history: strictly private, opt-in only
create policy search_history_all on public.search_history
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- conversions: strictly private
create policy conversions_all on public.conversions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- feedback: anyone signed-in can submit; only staff/service reads
create policy feedback_insert on public.feedback
  for insert with check (
    user_id = auth.uid()
    or (user_id is null and auth.uid() is null)  -- guests via server with service key
  );

-- guest_usage / rate_limits: NO client policies at all.
-- Access is exclusively through the service role key on the server.

-- ============================================================================
-- Guest limits: atomic fixed-window counter (server calls via service key)
-- ============================================================================
create or replace function public.bump_rate_limit(
  p_bucket text,
  p_limit int,
  p_window_seconds int
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_start timestamptz;
  v_count int;
begin
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_now, 1)
  on conflict (bucket) do update set
    window_start = case
      when public.rate_limits.window_start
           < v_now - (p_window_seconds || ' seconds')::interval
        then v_now
        else public.rate_limits.window_start
    end,
    count = case
      when public.rate_limits.window_start
           < v_now - (p_window_seconds || ' seconds')::interval
        then 1
        else public.rate_limits.count + 1
    end
  returning window_start, count into v_start, v_count;

  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'count', v_count,
    'retry_after_seconds',
      greatest(0, ceil(extract(epoch from
        (v_start + (p_window_seconds || ' seconds')::interval - v_now)))
      )::int
  );
end $$;

-- Daily guest usage: increment and report (server, service key)
create or replace function public.bump_guest_usage(
  p_ip_hash text,
  p_field text,                        -- 'searches' or 'conversions'
  p_daily_limit int
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
  v_searches int;
  v_conversions int;
begin
  insert into public.guest_usage (ip_hash, usage_date, searches_used, conversions_used)
  values (p_ip_hash, current_date, case when p_field = 'searches' then 1 else 0 end,
                              case when p_field = 'conversions' then 1 else 0 end)
  on conflict (ip_hash) do update set
    usage_date = case
      when public.guest_usage.usage_date < current_date then current_date
      else public.guest_usage.usage_date
    end,
    searches_used = case
      when public.guest_usage.usage_date < current_date then
        case when p_field = 'searches' then 1 else 0 end
      else public.guest_usage.searches_used + case when p_field = 'searches' then 1 else 0 end
    end,
    conversions_used = case
      when public.guest_usage.usage_date < current_date then
        case when p_field = 'conversions' then 1 else 0 end
      else public.guest_usage.conversions_used + case when p_field = 'conversions' then 1 else 0 end
    end,
    updated_at = v_now
  returning searches_used, conversions_used into v_searches, v_conversions;

  declare
    v_used int := case when p_field = 'searches' then v_searches else v_conversions end;
  begin
    return jsonb_build_object(
      'allowed', v_used <= p_daily_limit,
      'used', v_used,
      'limit', p_daily_limit
    );
  end;
end $$;

-- Revoke default execute from anon/authenticated on the helpers:
-- they are for the service role only.
revoke execute on function public.bump_rate_limit(text, int, int) from anon, authenticated;
revoke execute on function public.bump_guest_usage(text, text, int) from anon, authenticated;
