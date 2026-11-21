-- Product groups and variants.
--
-- Backward compatible: only adds a table and nullable/defaulted columns, so the
-- previous app version keeps working against this schema.
--
-- A product group ("Long Bit") is a presentation layer that bundles several
-- purchasable catalog items ("Long Bit — Masonry — 3/8\"") which differ by
-- optional attributes. Each variant remains its own catalog_items row with its
-- own id and Grainger SKU, so requests and shopping lists always reference the
-- exact variant.

create table public.product_groups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  category_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  icon text check (icon is null or icon ~ '^[a-z0-9-]{1,40}$'),
  -- Ordered list of attribute names technicians choose in turn, e.g. {Type,Size}.
  attribute_names text[] not null default '{}'
    check (cardinality(attribute_names) <= 4),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, team_id),
  foreign key (category_id, team_id) references public.categories (id, team_id) on delete set null (category_id)
);
create unique index product_groups_team_name_idx on public.product_groups (team_id, lower(name)) where archived_at is null;
create trigger product_groups_updated_at before update on public.product_groups
  for each row execute function public.set_updated_at();

alter table public.catalog_items
  add column group_id uuid,
  add column attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  add column icon text check (icon is null or icon ~ '^[a-z0-9-]{1,40}$'),
  add foreign key (group_id, team_id) references public.product_groups (id, team_id) on delete set null (group_id);

-- No two active variants in a group may have identical attributes.
create unique index catalog_items_variant_unique_idx on public.catalog_items (group_id, attributes)
  where group_id is not null and archived_at is null;
create index catalog_items_group_idx on public.catalog_items (group_id) where group_id is not null;

alter table public.product_groups enable row level security;
revoke all on public.product_groups from anon;
create policy product_groups_member_all on public.product_groups for all to authenticated
  using (public.is_team_member(team_id)) with check (public.is_team_member(team_id));

-- Technicians can't order a variant whose group was archived.
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
      select c.* into v_cat from public.catalog_items c
       where c.id = (v_item ->> 'catalog_item_id')::uuid
         and c.team_id = v_team.id
         and c.archived_at is null
         and (c.group_id is null or exists (
               select 1 from public.product_groups g where g.id = c.group_id and g.archived_at is null));
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
