-- Technician Supply Request Portal — initial schema
-- Team isolation is enforced with Row Level Security. Public (technician) access
-- never touches tables directly: it goes through server routes using the service
-- role and the service-role-only functions defined below.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_name(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text check (full_name is null or char_length(full_name) <= 100),
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{3,63}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  notify_new_requests boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on public.team_members (user_id);

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  name_key text not null,
  archived_at timestamptz,
  last_request_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, name_key),
  unique (id, team_id)
);

create or replace function public.technicians_set_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  new.name_key := public.normalize_name(new.name);
  return new;
end;
$$;
create trigger technicians_set_key before insert or update of name on public.technicians
  for each row execute function public.technicians_set_key();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, team_id)
);
create unique index categories_team_name_idx on public.categories (team_id, lower(name));

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  category_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  image_url text check (image_url is null or (image_url ~ '^https?://' and char_length(image_url) <= 1000)),
  grainger_sku text check (grainger_sku is null or char_length(grainger_sku) <= 40),
  grainger_url text check (grainger_url is null or (grainger_url ~ '^https?://' and char_length(grainger_url) <= 1000)),
  unit text check (unit is null or char_length(unit) <= 20),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  foreign key (category_id, team_id) references public.categories (id, team_id) on delete set null (category_id)
);
create index catalog_items_team_idx on public.catalog_items (team_id) where archived_at is null;
create trigger catalog_items_updated_at before update on public.catalog_items
  for each row execute function public.set_updated_at();

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  technician_id uuid not null,
  technician_name text not null,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'requested' check (status in ('requested', 'ordered')),
  ordered_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  foreign key (technician_id, team_id) references public.technicians (id, team_id) on delete cascade
);
create index requests_team_created_idx on public.requests (team_id, created_at desc);
create index requests_technician_idx on public.requests (technician_id, created_at desc);
create trigger requests_updated_at before update on public.requests
  for each row execute function public.set_updated_at();

create table public.order_batches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  reference text check (reference is null or char_length(reference) <= 80),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, team_id)
);

create table public.request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  team_id uuid not null,
  catalog_item_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  unit text check (unit is null or char_length(unit) <= 20),
  grainger_sku text check (grainger_sku is null or char_length(grainger_sku) <= 40),
  grainger_url text check (grainger_url is null or char_length(grainger_url) <= 1000),
  quantity integer not null check (quantity between 1 and 999),
  is_custom boolean not null default false,
  custom_note text check (custom_note is null or char_length(custom_note) <= 500),
  custom_url text check (custom_url is null or (custom_url ~ '^https?://' and char_length(custom_url) <= 1000)),
  status text not null default 'requested' check (status in ('requested', 'ordered')),
  ordered_at timestamptz,
  ordered_by uuid references public.profiles (id) on delete set null,
  order_batch_id uuid,
  removed_at timestamptz,
  removed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (request_id, team_id) references public.requests (id, team_id) on delete cascade,
  foreign key (catalog_item_id, team_id) references public.catalog_items (id, team_id) on delete set null (catalog_item_id),
  foreign key (order_batch_id, team_id) references public.order_batches (id, team_id) on delete set null (order_batch_id)
);
create index request_items_request_idx on public.request_items (request_id);
create index request_items_outstanding_idx on public.request_items (team_id)
  where status = 'requested' and removed_at is null;
create trigger request_items_updated_at before update on public.request_items
  for each row execute function public.set_updated_at();

create table public.activity_events (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  request_id uuid references public.requests (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (char_length(kind) <= 40),
  summary text not null check (char_length(summary) <= 300),
  created_at timestamptz not null default now()
);
create index activity_events_team_idx on public.activity_events (team_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- Derived request status (partial fulfillment safe)
-- ---------------------------------------------------------------------------

create or replace function public.refresh_request_status(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active integer;
  v_open integer;
  v_last_ordered timestamptz;
begin
  select count(*) filter (where removed_at is null),
         count(*) filter (where removed_at is null and status = 'requested'),
         max(ordered_at) filter (where removed_at is null)
    into v_active, v_open, v_last_ordered
    from public.request_items
   where request_id = p_request_id;

  update public.requests r
     set status = case when v_active > 0 and v_open = 0 then 'ordered' else 'requested' end,
         ordered_at = case when v_active > 0 and v_open = 0 then v_last_ordered else null end,
         removed_at = case when v_active = 0 then coalesce(r.removed_at, now()) else null end
   where r.id = p_request_id;
end;
$$;
revoke all on function public.refresh_request_status(uuid) from public, anon, authenticated;

create or replace function public.request_items_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_request_status(old.request_id);
    return old;
  end if;
  perform public.refresh_request_status(new.request_id);
  if tg_op = 'UPDATE' and new.request_id <> old.request_id then
    perform public.refresh_request_status(old.request_id);
  end if;
  return new;
end;
$$;
create trigger request_items_status after insert or update or delete on public.request_items
  for each row execute function public.request_items_after_change();

-- Keep ordered_at / ordered_by consistent with status.
create or replace function public.request_items_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'ordered' and old.status <> 'ordered' then
    new.ordered_at := coalesce(new.ordered_at, now());
    new.ordered_by := coalesce(new.ordered_by, auth.uid());
  elsif new.status = 'requested' then
    new.ordered_at := null;
    new.ordered_by := null;
    new.order_batch_id := null;
  end if;
  if new.removed_at is not null and old.removed_at is null then
    new.removed_by := coalesce(new.removed_by, auth.uid());
  elsif new.removed_at is null then
    new.removed_by := null;
  end if;
  return new;
end;
$$;
create trigger request_items_before_update before update on public.request_items
  for each row execute function public.request_items_before_update();

-- ---------------------------------------------------------------------------
-- Profiles: created automatically for every auth user
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m where m.team_id = p_team_id and m.user_id = auth.uid()
  ) or public.is_super_admin()
$$;

revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.technicians enable row level security;
alter table public.categories enable row level security;
alter table public.catalog_items enable row level security;
alter table public.requests enable row level security;
alter table public.order_batches enable row level security;
alter table public.request_items enable row level security;
alter table public.activity_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.rate_limits enable row level security;

-- Technicians never use the anon role against tables.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on public.rate_limits from authenticated;

-- profiles: see yourself and teammates; super admin sees all. Only full_name is self-editable.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1 from public.team_members mine
      join public.team_members theirs on theirs.team_id = mine.team_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- teams
create policy teams_select on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy teams_update on public.teams for update to authenticated
  using (public.is_team_member(id)) with check (public.is_team_member(id));
create policy teams_insert on public.teams for insert to authenticated
  with check (public.is_super_admin());
create policy teams_delete on public.teams for delete to authenticated
  using (public.is_super_admin());

-- team_members: managers can see their teammates; only super admins add/remove.
create policy team_members_select on public.team_members for select to authenticated
  using (public.is_team_member(team_id));
create policy team_members_insert on public.team_members for insert to authenticated
  with check (public.is_super_admin());
create policy team_members_delete on public.team_members for delete to authenticated
  using (public.is_super_admin());
create policy team_members_update on public.team_members for update to authenticated
  using (user_id = auth.uid() or public.is_super_admin())
  with check (user_id = auth.uid() or public.is_super_admin());
-- Members may only change their own preference columns, never team_id/user_id.
revoke update on public.team_members from authenticated;
grant update (notify_new_requests, last_seen_at) on public.team_members to authenticated;

-- Team-scoped tables: full access for members of that team.
do $$
declare
  t text;
begin
  foreach t in array array['technicians', 'categories', 'catalog_items', 'requests',
                           'order_batches', 'request_items', 'activity_events']
  loop
    execute format(
      'create policy %1$s_member_all on public.%1$I for all to authenticated
         using (public.is_team_member(team_id)) with check (public.is_team_member(team_id))', t);
  end loop;
end;
$$;

-- push_subscriptions: each user manages their own devices.
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Public (service-role-only) functions
-- ---------------------------------------------------------------------------

-- Fixed-window rate limiter. Returns true when the call is allowed.
create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rl.count + 1
  returning count into v_count;

  -- Opportunistic cleanup of stale windows.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- Atomic request submission from a team link.
-- p_items: [{"catalog_item_id": uuid, "quantity": int}
--           | {"custom_name": text, "quantity": int, "custom_note": text?, "custom_url": text?}]
create or replace function public.submit_request(
  p_slug text,
  p_technician_name text,
  p_items jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams;
  v_tech_id uuid;
  v_request_id uuid;
  v_name text := regexp_replace(btrim(coalesce(p_technician_name, '')), '\s+', ' ', 'g');
  v_item jsonb;
  v_qty integer;
  v_cat public.catalog_items;
  v_count integer := 0;
  v_custom_name text;
begin
  select * into v_team from public.teams where slug = p_slug and is_active;
  if not found then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  insert into public.technicians (team_id, name, name_key, last_request_at)
  values (v_team.id, v_name, public.normalize_name(v_name), now())
  on conflict (team_id, name_key) do update
    set last_request_at = now(), archived_at = null
  returning id into v_tech_id;

  insert into public.requests (team_id, technician_id, technician_name, note)
  values (v_team.id, v_tech_id,
          (select name from public.technicians where id = v_tech_id),
          nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_request_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 999 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;

    if v_item ? 'catalog_item_id' and nullif(v_item ->> 'catalog_item_id', '') is not null then
      select * into v_cat from public.catalog_items
       where id = (v_item ->> 'catalog_item_id')::uuid and team_id = v_team.id and archived_at is null;
      if not found then
        raise exception 'catalog_item_not_found' using errcode = '22023';
      end if;
      insert into public.request_items (request_id, team_id, catalog_item_id, name, unit, grainger_sku, grainger_url, quantity)
      values (v_request_id, v_team.id, v_cat.id, v_cat.name, v_cat.unit, v_cat.grainger_sku, v_cat.grainger_url, v_qty);
    else
      v_custom_name := btrim(coalesce(v_item ->> 'custom_name', ''));
      if char_length(v_custom_name) < 1 or char_length(v_custom_name) > 120 then
        raise exception 'invalid_custom_item' using errcode = '22023';
      end if;
      insert into public.request_items (request_id, team_id, name, quantity, is_custom, custom_note, custom_url)
      values (v_request_id, v_team.id, v_custom_name, v_qty, true,
              nullif(btrim(coalesce(v_item ->> 'custom_note', '')), ''),
              nullif(btrim(coalesce(v_item ->> 'custom_url', '')), ''));
    end if;
    v_count := v_count + 1;
  end loop;

  insert into public.activity_events (team_id, request_id, kind, summary)
  values (v_team.id, v_request_id, 'request_submitted',
          format('%s requested %s item%s', v_name, v_count, case when v_count = 1 then '' else 's' end));

  return v_request_id;
end;
$$;
revoke all on function public.submit_request(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.submit_request(text, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- Admin functions (security invoker: RLS applies)
-- ---------------------------------------------------------------------------

create or replace function public.mark_items_ordered(p_team_id uuid, p_item_ids uuid[], p_reference text default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch uuid;
  v_count integer;
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.order_batches (team_id, reference, created_by)
  values (p_team_id, nullif(btrim(coalesce(p_reference, '')), ''), auth.uid())
  returning id into v_batch;

  update public.request_items
     set status = 'ordered', ordered_at = now(), ordered_by = auth.uid(), order_batch_id = v_batch
   where team_id = p_team_id
     and id = any (p_item_ids)
     and status = 'requested'
     and removed_at is null;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    delete from public.order_batches where id = v_batch;
    return 0;
  end if;

  insert into public.activity_events (team_id, actor_id, kind, summary)
  values (p_team_id, auth.uid(), 'items_ordered',
          format('Marked %s item%s ordered%s', v_count, case when v_count = 1 then '' else 's' end,
                 case when nullif(btrim(coalesce(p_reference, '')), '') is null then ''
                      else ' (order ' || btrim(p_reference) || ')' end));
  return v_count;
end;
$$;
revoke all on function public.mark_items_ordered(uuid, uuid[], text) from public, anon;
grant execute on function public.mark_items_ordered(uuid, uuid[], text) to authenticated;

create or replace function public.mark_items_requested(p_team_id uuid, p_item_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.request_items
     set status = 'requested'
   where team_id = p_team_id and id = any (p_item_ids) and status = 'ordered';
  get diagnostics v_count = row_count;

  if v_count > 0 then
    insert into public.activity_events (team_id, actor_id, kind, summary)
    values (p_team_id, auth.uid(), 'items_unordered',
            format('Moved %s item%s back to requested', v_count, case when v_count = 1 then '' else 's' end));
  end if;
  return v_count;
end;
$$;
revoke all on function public.mark_items_requested(uuid, uuid[]) from public, anon;
grant execute on function public.mark_items_requested(uuid, uuid[]) to authenticated;

-- Merge a duplicate technician into another (e.g. "Mike" into "Mike Smith").
create or replace function public.merge_technicians(p_team_id uuid, p_from uuid, p_into uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_into_name text;
begin
  if not public.is_team_member(p_team_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from = p_into then
    raise exception 'same_technician' using errcode = '22023';
  end if;
  select name into v_into_name from public.technicians where id = p_into and team_id = p_team_id;
  if v_into_name is null then
    raise exception 'technician_not_found' using errcode = 'P0002';
  end if;

  update public.requests
     set technician_id = p_into, technician_name = v_into_name
   where technician_id = p_from and team_id = p_team_id;
  delete from public.technicians where id = p_from and team_id = p_team_id;
end;
$$;
revoke all on function public.merge_technicians(uuid, uuid, uuid) from public, anon;
grant execute on function public.merge_technicians(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for catalog images (public read; writes go through the server)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-images', 'catalog-images', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;
