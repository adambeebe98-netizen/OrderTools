-- First-time setup, run in the Supabase SQL Editor AFTER the schema
-- (supabase/migrations/*_init.sql) and AFTER creating your login under
-- Authentication → Users → Add user (tick "Auto Confirm User").
--
-- 1. Change the two values on the next lines.
-- 2. Click Run. The result shows your technician link path.

do $$
declare
  v_email text := 'you@example.com';      -- the email you just created in Authentication → Users
  v_team  text := 'My Install Team';      -- your team's name (can be changed later in Settings)
  v_user  uuid;
  v_team_id uuid;
  v_slug text;
begin
  select id into v_user from public.profiles where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'No user with email %. Create it under Authentication → Users first.', v_email;
  end if;

  update public.profiles set is_super_admin = true where id = v_user;

  v_slug := trim(both '-' from regexp_replace(lower(v_team), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'team'), 40) || '-' || substr(md5(random()::text), 1, 6);

  insert into public.teams (name, slug) values (v_team, v_slug) returning id into v_team_id;
  insert into public.team_members (team_id, user_id) values (v_team_id, v_user);

  raise notice 'Done. Technician link: https://YOUR-SITE/r/%', v_slug;
end
$$;

-- Shows your team and its technician link path:
select name, '/r/' || slug as technician_link_path from public.teams order by created_at desc limit 1;
