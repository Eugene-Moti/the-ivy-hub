-- Ivy Hub on Neon: schema, permissions (RLS) and audit trail.
--
-- Prerequisites (Neon Console): Better Auth enabled, then Postgres database → Data API enabled with
-- "Use Neon Auth". That creates the `authenticated` / `anonymous` roles and the auth.user_id() function.
--
-- Permissions are enforced here, not just hidden in the UI. Every important change is written to
-- activity_log by security-definer triggers, so the log can't be skipped or edited from the app.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception 'Enable the Neon Data API (with Neon Auth) before running this migration.';
  end if;
end $$;

/* ------------------------------------------------------------------ */
/* Who is calling?                                                      */
/* ------------------------------------------------------------------ */

-- The signed-in user's id from the Data API JWT (auth.user_id()), or, for our own server functions
-- acting on someone's behalf, the `ivy.actor` setting. Null for system work. Never errors.
create or replace function public.app_user_id() returns text
language plpgsql stable as $$
declare uid text;
begin
  begin
    uid := auth.user_id();
  exception when others then
    uid := null;
  end;
  return coalesce(nullif(uid, ''), nullif(current_setting('ivy.actor', true), ''));
end $$;

/* ------------------------------------------------------------------ */
/* Tables                                                               */
/* ------------------------------------------------------------------ */

-- One row per Neon Auth user who may use Ivy Hub. RLS checks this table, so an auth account
-- without a profile (or with is_active = false) can't read or write anything.
create table public.profiles (
  id text primary key, -- neon_auth user id
  name text not null check (length(trim(name)) >= 2),
  email text not null unique,
  username text not null unique check (username ~ '^[A-Za-z0-9._-]{3,}$'),
  role text not null check (role in ('admin', 'receptionist')),
  title text,
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'The Ivy Group' check (length(trim(company_name)) > 0),
  edit_window_hours int not null default 24 check (edit_window_hours between 1 and 168),
  receptionist_can_export boolean not null default false,
  working_days int[] not null default '{1,2,3,4,5,6}', -- ISO weekdays, 1 = Monday
  open_time text not null default '09:00' check (open_time ~ '^\d{2}:\d{2}$'),
  close_time text not null default '17:30' check (close_time ~ '^\d{2}:\d{2}$'),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.unit_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  name text not null check (length(trim(name)) > 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  icon text not null default 'dots',
  kind text not null default 'standard' check (kind in ('standard', 'sales_person', 'other')),
  is_active boolean not null default true,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Sales persons and the other staff visitors come to see. The client may supply the id
-- (people added offline sync with the id they were given).
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) >= 2),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  title text,
  branch text,
  is_sales_person boolean not null default true,
  is_active boolean not null default true,
  created_by text references public.profiles (id) default public.app_user_id(),
  created_at timestamptz not null default now()
);

-- id is generated on the client so offline retries never create duplicates.
create table public.walk_ins (
  id uuid primary key default gen_random_uuid(),
  reference text unique,
  visited_at timestamptz not null default now(),
  full_name text not null check (length(trim(full_name)) >= 2),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  visit_type text not null default 'client' check (visit_type in ('client', 'meeting', 'delivery', 'interview', 'other')),
  -- client visits
  project_id uuid references public.projects (id),
  unit_type_id uuid references public.unit_types (id),
  source_id uuid references public.lead_sources (id),
  sales_person_id uuid references public.team_members (id),
  other_source_text text,
  -- other visits
  host_id uuid references public.team_members (id),
  host_name text,
  organisation text check (organisation is null or char_length(organisation) <= 120),
  purpose text check (purpose is null or char_length(purpose) <= 200),
  notes text check (notes is null or char_length(notes) <= 1000),
  consent boolean not null check (consent), -- Kenya Data Protection Act 2019
  is_returning boolean not null default false,
  created_by text not null default public.app_user_id() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  delete_reason text,
  constraint client_needs_interest check (
    visit_type <> 'client' or (project_id is not null and unit_type_id is not null and source_id is not null)
  ),
  constraint visitor_needs_host check (visit_type = 'client' or host_id is not null or length(trim(coalesce(host_name, ''))) > 0),
  constraint delete_needs_reason check (deleted_at is null or length(trim(coalesce(delete_reason, ''))) > 0)
);
create index walk_ins_visited_at_idx on public.walk_ins (visited_at desc);
create index walk_ins_phone_idx on public.walk_ins (phone);
create index walk_ins_email_idx on public.walk_ins (lower(email));
create index walk_ins_sales_person_idx on public.walk_ins (sales_person_id);
create index walk_ins_visit_type_idx on public.walk_ins (visit_type, visited_at desc);

-- One email + one WhatsApp per walk-in that names a sales person (client) or host (other visit).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  walk_in_id uuid not null references public.walk_ins (id) on delete cascade,
  recipient_id uuid not null references public.team_members (id),
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'pending_setup')),
  error text,
  attempts int not null default 0,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (walk_in_id, channel)
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  user_id text,
  user_name text,
  action text not null,
  entity text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_user_idx on public.activity_log (user_id, created_at desc);
create index activity_log_action_idx on public.activity_log (action, created_at desc);

create table public.login_attempts (
  identifier text primary key,
  fails int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Walk-ins with the recorder's name. security_invoker: the caller's RLS applies.
create view public.walk_in_rows with (security_invoker = true) as
  select w.*, p.name as created_by_name
  from public.walk_ins w
  left join public.profiles p on p.id = w.created_by;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = app_user_id() and is_active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = app_user_id() and is_active and role = 'admin')
$$;

-- Only callable from other security-definer functions and triggers.
create or replace function public.write_activity(p_action text, p_entity text, p_entity_id text, p_old jsonb, p_new jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare uid text := app_user_id();
begin
  insert into activity_log (user_id, user_name, action, entity, entity_id, old_values, new_values)
  values (uid, (select name from profiles where id = uid), p_action, p_entity, p_entity_id,
          nullif(p_old, '{}'::jsonb), nullif(p_new, '{}'::jsonb));
end $$;

-- Changed keys only, as {old}, {new}.
create or replace function public.jsonb_changes(old_row jsonb, new_row jsonb, ignore text[] default '{updated_at}')
returns table (old_values jsonb, new_values jsonb) language sql immutable as $$
  select coalesce(jsonb_object_agg(k, old_row -> k), '{}'::jsonb),
         coalesce(jsonb_object_agg(k, new_row -> k), '{}'::jsonb)
  from jsonb_object_keys(new_row) as k
  where not (k = any (ignore)) and (old_row -> k) is distinct from (new_row -> k)
$$;

/* ------------------------------------------------------------------ */
/* Business rules                                                       */
/* ------------------------------------------------------------------ */

-- Client visits need project/unit/source (+ sales person or free text, depending on the source);
-- other visits need a host. Fields that don't apply to the visit type are cleared.
create or replace function public.walk_ins_apply_rules(w public.walk_ins) returns public.walk_ins
language plpgsql stable security definer set search_path = public as $$
declare k text;
begin
  if w.visit_type = 'client' then
    if w.project_id is null then raise exception 'Choose a project'; end if;
    if w.unit_type_id is null then raise exception 'Choose a unit type'; end if;
    if w.source_id is null then raise exception 'Choose how they heard about us'; end if;
    if not exists (select 1 from unit_types where id = w.unit_type_id and project_id = w.project_id) then
      raise exception 'That unit type does not belong to the chosen project';
    end if;
    select kind into k from lead_sources where id = w.source_id;
    if k = 'sales_person' and w.sales_person_id is null then raise exception 'Choose the sales person'; end if;
    if k = 'other' and length(trim(coalesce(w.other_source_text, ''))) = 0 then
      raise exception 'Tell us where they heard about us';
    end if;
    if k is distinct from 'sales_person' then w.sales_person_id := null; end if;
    if k is distinct from 'other' then w.other_source_text := null; end if;
    w.host_id := null;
    w.host_name := null;
    w.organisation := null;
    w.purpose := null;
  else
    if w.host_id is null and length(trim(coalesce(w.host_name, ''))) = 0 then
      raise exception 'Who are they here to see?';
    end if;
    if w.host_id is not null then w.host_name := null; end if;
    w.project_id := null;
    w.unit_type_id := null;
    w.source_id := null;
    w.sales_person_id := null;
    w.other_source_text := null;
  end if;
  return w;
end $$;

create or replace function public.walk_ins_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare prefix text; seq int;
begin
  if app_user_id() is not null then new.created_by := app_user_id(); end if;
  new.created_at := now();
  new.updated_at := now();
  new.deleted_at := null;
  new.delete_reason := null;
  -- visited_at comes from the client so offline records keep their real visit time.
  if new.visited_at > now() + interval '5 minutes' then raise exception 'The visit time cannot be in the future'; end if;
  new := walk_ins_apply_rules(new);
  new.is_returning := exists (
    select 1 from walk_ins w
    where w.deleted_at is null and w.id <> new.id
      and (w.phone = new.phone or (new.email is not null and lower(w.email) = lower(new.email)))
  );
  -- Daily sequence in Nairobi time: IVY-20261026-014
  prefix := 'IVY-' || to_char(new.visited_at at time zone 'Africa/Nairobi', 'YYYYMMDD') || '-';
  perform pg_advisory_xact_lock(hashtext(prefix));
  select coalesce(max(substring(reference from length(prefix) + 1)::int), 0) + 1 into seq
  from walk_ins where reference like prefix || '%';
  new.reference := prefix || lpad(seq::text, 3, '0');
  return new;
end $$;

create trigger walk_ins_before_insert before insert on public.walk_ins
  for each row execute function public.walk_ins_before_insert();

create or replace function public.walk_ins_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if app_user_id() is not null and not is_admin() then
    if new.deleted_at is distinct from old.deleted_at or new.delete_reason is distinct from old.delete_reason then
      raise exception 'Only an admin can delete records';
    end if;
  end if;
  if old.deleted_at is not null and app_user_id() is not null then
    raise exception 'Deleted records cannot be changed';
  end if;
  -- Fields nobody may change after saving
  new.id := old.id;
  new.reference := old.reference;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.visited_at := old.visited_at;
  new.consent := old.consent;
  new.is_returning := old.is_returning;
  if new.deleted_at is null then new := walk_ins_apply_rules(new); end if;
  new.updated_at := now();
  return new;
end $$;

create trigger walk_ins_before_update before update on public.walk_ins
  for each row execute function public.walk_ins_before_update();

-- Queue the arrival notifications (sent by the /api/notify function).
create or replace function public.walk_ins_queue_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
declare recipient uuid := case when new.visit_type = 'client' then new.sales_person_id else new.host_id end;
begin
  if recipient is not null then
    insert into notifications (walk_in_id, recipient_id, channel)
    values (new.id, recipient, 'email'), (new.id, recipient, 'whatsapp')
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger walk_ins_queue_notifications after insert on public.walk_ins
  for each row execute function public.walk_ins_queue_notifications();

create or replace function public.team_members_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if app_user_id() is not null then new.created_by := app_user_id(); end if;
  new.created_at := now();
  new.is_active := true;
  return new;
end $$;

create trigger team_members_before_insert before insert on public.team_members
  for each row execute function public.team_members_before_insert();

create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id = app_user_id() and old.role = 'admin' and (not new.is_active or new.role <> 'admin') then
    raise exception 'You cannot deactivate or demote your own account';
  end if;
  -- Only the dedicated functions below may change these.
  if app_user_id() is not null and current_setting('ivy.password_flow', true) is distinct from 'on' then
    new.must_change_password := old.must_change_password;
  end if;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger app_settings_touch before update on public.app_settings for each row execute function public.touch_updated_at();
create trigger notifications_touch before update on public.notifications for each row execute function public.touch_updated_at();

/* ------------------------------------------------------------------ */
/* Audit trail                                                          */
/* ------------------------------------------------------------------ */

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  ov jsonb := '{}'::jsonb;
  nv jsonb := '{}'::jsonb;
  act text;
  ent text;
begin
  if tg_op = 'UPDATE' then
    select c.old_values, c.new_values into ov, nv from jsonb_changes(o, n) c;
    if nv = '{}'::jsonb then return new; end if;
  end if;

  case tg_table_name
    when 'walk_ins' then
      ent := 'walk_in';
      if tg_op = 'INSERT' then
        act := 'walk_in_created';
        nv := jsonb_build_object('reference', n ->> 'reference', 'full_name', n ->> 'full_name',
                                 'visit_type', n ->> 'visit_type', 'visited_at', n -> 'visited_at');
      elsif (o ->> 'deleted_at') is null and (n ->> 'deleted_at') is not null then
        act := 'walk_in_deleted';
        ov := jsonb_build_object('reference', o ->> 'reference', 'full_name', o ->> 'full_name');
        nv := jsonb_build_object('delete_reason', n ->> 'delete_reason');
      else
        act := 'walk_in_edited';
        ov := jsonb_build_object('reference', o ->> 'reference') || ov;
      end if;
    when 'team_members' then
      ent := 'team_member';
      if tg_op = 'INSERT' then
        act := 'team_member_added';
        nv := n - 'id' - 'created_by' - 'created_at' - 'is_active';
      else
        act := 'team_member_edited';
        ov := jsonb_build_object('full_name', o ->> 'full_name') || ov;
      end if;
    when 'profiles' then
      ent := 'user';
      if tg_op = 'INSERT' then
        act := 'user_created';
        nv := jsonb_build_object('name', n ->> 'name', 'email', n ->> 'email', 'username', n ->> 'username', 'role', n ->> 'role');
      elsif (o ->> 'is_active')::boolean and not (n ->> 'is_active')::boolean then
        act := 'user_deactivated';
        ov := jsonb_build_object('name', o ->> 'name') || ov;
      elsif nv ?& array['must_change_password'] and (nv - 'must_change_password') = '{}'::jsonb then
        return new; -- password flag flips are logged by the password functions themselves
      else
        act := 'user_updated';
        ov := jsonb_build_object('name', o ->> 'name') || ov;
      end if;
    when 'notifications' then
      -- Log deliveries: status changes, and repeated failures after a resend.
      if tg_op <> 'UPDATE' or (n ->> 'status') = 'queued'
         or ((o ->> 'status') = (n ->> 'status') and (o ->> 'attempts') = (n ->> 'attempts')) then
        return new;
      end if;
      ent := 'notification';
      act := 'notification_' || (n ->> 'status');
      ov := '{}'::jsonb;
      nv := jsonb_build_object('channel', n ->> 'channel', 'walk_in_id', n ->> 'walk_in_id',
                               'recipient_id', n ->> 'recipient_id', 'error', n ->> 'error', 'attempts', n -> 'attempts');
    else
      ent := regexp_replace(tg_table_name, 's$', '');
      act := 'settings_changed';
      if tg_op = 'INSERT' then nv := n - 'id' - 'created_at' - 'sort_order'; end if;
      if tg_op = 'UPDATE' and n ? 'name' then ov := jsonb_build_object('name', o ->> 'name') || ov; end if;
  end case;

  perform write_activity(act, ent, coalesce(n ->> 'id', o ->> 'id'), ov, nv);
  return coalesce(new, old);
end $$;

create trigger audit_walk_ins after insert or update on public.walk_ins for each row execute function public.audit_trigger();
create trigger audit_team_members after insert or update on public.team_members for each row execute function public.audit_trigger();
create trigger audit_profiles after insert or update on public.profiles for each row execute function public.audit_trigger();
create trigger audit_notifications after update on public.notifications for each row execute function public.audit_trigger();
create trigger audit_projects after insert or update on public.projects for each row execute function public.audit_trigger();
create trigger audit_unit_types after insert or update on public.unit_types for each row execute function public.audit_trigger();
create trigger audit_lead_sources after insert or update on public.lead_sources for each row execute function public.audit_trigger();
create trigger audit_app_settings after update on public.app_settings for each row execute function public.audit_trigger();

-- The log is append-only, even for the database owner.
create or replace function public.activity_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'The activity log is read-only';
end $$;
create trigger activity_log_no_change before update or delete on public.activity_log
  for each row execute function public.activity_log_immutable();
create trigger activity_log_no_truncate before truncate on public.activity_log
  for each statement execute function public.activity_log_immutable();

/* ------------------------------------------------------------------ */
/* Login lockout (called only by the /api/login-guard server function)  */
/* ------------------------------------------------------------------ */

create or replace function public.resolve_login_email(p_identifier text) returns text
language sql stable security definer set search_path = public as $$
  select email from profiles
  where lower(username) = lower(trim(p_identifier)) or lower(email) = lower(trim(p_identifier))
  limit 1
$$;

create or replace function public.login_lock_status(p_identifier text) returns timestamptz
language sql stable security definer set search_path = public as $$
  select locked_until from login_attempts where identifier = lower(trim(p_identifier)) and locked_until > now()
$$;

-- 5 failures → locked for 15 minutes. Also logs the failed attempt.
create or replace function public.register_failed_login(p_identifier text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  ident text := lower(trim(p_identifier));
  r login_attempts;
  who profiles;
begin
  insert into login_attempts as la (identifier, fails, updated_at) values (ident, 1, now())
  on conflict (identifier) do update set
    fails = case when la.locked_until is not null and la.locked_until <= now() then 1 else la.fails + 1 end,
    locked_until = case when la.locked_until is not null and la.locked_until <= now() then null else la.locked_until end,
    updated_at = now()
  returning * into r;
  if r.fails >= 5 and r.locked_until is null then
    update login_attempts set locked_until = now() + interval '15 minutes' where identifier = ident returning * into r;
  end if;
  select * into who from profiles where lower(email) = ident or lower(username) = ident limit 1;
  insert into activity_log (user_id, user_name, action, entity, new_values)
  values (who.id, who.name, 'failed_login', 'session', jsonb_build_object('identifier', ident));
  return jsonb_build_object('fails', r.fails, 'locked_until', r.locked_until);
end $$;

create or replace function public.clear_failed_logins(p_identifier text) returns void
language sql security definer set search_path = public as $$
  delete from login_attempts where identifier = lower(trim(p_identifier))
$$;

/* ------------------------------------------------------------------ */
/* RPCs for signed-in users (Data API)                                  */
/* ------------------------------------------------------------------ */

create or replace function public.log_session_event(p_action text, p_details jsonb default '{}') returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_action not in ('login', 'logout') then raise exception 'Unsupported action'; end if;
  if app_user_id() is null then return; end if;
  perform write_activity(p_action, 'session', null, null, p_details);
end $$;

create or replace function public.log_export(p_format text, p_filters jsonb, p_row_count int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or (is_active_user() and (select receptionist_can_export from app_settings where id = 1))) then
    raise exception 'Only an admin can export records' using errcode = '42501';
  end if;
  perform write_activity('data_exported', 'walk_in', null, null,
    jsonb_build_object('format', p_format, 'row_count', p_row_count, 'filters', p_filters));
end $$;

-- The signed-in user has just changed their own password (in Neon Auth): lift the forced change.
create or replace function public.complete_password_change() returns void
language plpgsql security definer set search_path = public as $$
declare uid text := app_user_id();
begin
  if uid is null or not is_active_user() then raise exception 'Not signed in' using errcode = '42501'; end if;
  perform set_config('ivy.password_flow', 'on', true);
  update profiles set must_change_password = false where id = uid;
  perform write_activity('password_reset', 'user', uid, null,
    jsonb_build_object('name', (select name from profiles where id = uid), 'self_service', true));
end $$;

-- An admin has set a temporary password for someone (in Neon Auth): force a change at next sign-in.
create or replace function public.admin_mark_password_reset(p_user_id text) returns void
language plpgsql security definer set search_path = public as $$
declare target profiles;
begin
  if not is_admin() then raise exception 'Only an admin can do that' using errcode = '42501'; end if;
  select * into target from profiles where id = p_user_id;
  if target.id is null then raise exception 'User not found'; end if;
  perform set_config('ivy.password_flow', 'on', true);
  update profiles set must_change_password = true where id = p_user_id;
  delete from login_attempts where identifier in (lower(target.email), lower(target.username));
  perform write_activity('password_reset', 'user', p_user_id, null, jsonb_build_object('name', target.name));
end $$;

/* ------------------------------------------------------------------ */
/* Grants and row level security                                        */
/* ------------------------------------------------------------------ */

-- Functions are executable by PUBLIC by default; open only what each role needs.
revoke execute on all functions in schema public from public, anonymous, authenticated;
grant execute on function public.app_user_id(), public.is_active_user(), public.is_admin(), public.jsonb_changes(jsonb, jsonb, text[])
  to authenticated;
grant execute on function public.log_session_event(text, jsonb), public.log_export(text, jsonb, int),
  public.complete_password_change(), public.admin_mark_password_reset(text) to authenticated;

grant usage on schema public to authenticated;
revoke all on all tables in schema public from anonymous, authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on public.profiles, public.projects, public.unit_types, public.lead_sources,
  public.team_members, public.walk_ins to authenticated;
grant update on public.app_settings to authenticated;
revoke all on public.login_attempts from authenticated;

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.projects enable row level security;
alter table public.unit_types enable row level security;
alter table public.lead_sources enable row level security;
alter table public.team_members enable row level security;
alter table public.walk_ins enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;
alter table public.login_attempts enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (is_active_user() or id = app_user_id());
create policy profiles_admin_insert on public.profiles for insert to authenticated with check (is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated using (is_admin()) with check (is_admin());

create policy settings_read on public.app_settings for select to authenticated using (is_active_user());
create policy settings_admin_update on public.app_settings for update to authenticated using (is_admin()) with check (is_admin());

create policy projects_read on public.projects for select to authenticated using (is_active_user());
create policy projects_admin_insert on public.projects for insert to authenticated with check (is_admin());
create policy projects_admin_update on public.projects for update to authenticated using (is_admin()) with check (is_admin());

create policy unit_types_read on public.unit_types for select to authenticated using (is_active_user());
create policy unit_types_admin_insert on public.unit_types for insert to authenticated with check (is_admin());
create policy unit_types_admin_update on public.unit_types for update to authenticated using (is_admin()) with check (is_admin());

create policy sources_read on public.lead_sources for select to authenticated using (is_active_user());
create policy sources_admin_insert on public.lead_sources for insert to authenticated with check (is_admin());
create policy sources_admin_update on public.lead_sources for update to authenticated using (is_admin()) with check (is_admin());

-- Receptionists can add sales persons from the walk-in form; only admins edit or deactivate team members.
create policy team_read on public.team_members for select to authenticated using (is_active_user());
create policy team_insert on public.team_members for insert to authenticated with check (is_active_user());
create policy team_admin_update on public.team_members for update to authenticated using (is_admin()) with check (is_admin());

create policy walk_ins_read on public.walk_ins for select to authenticated
  using (is_active_user() and (deleted_at is null or is_admin()));
create policy walk_ins_insert on public.walk_ins for insert to authenticated
  with check (is_active_user());
create policy walk_ins_admin_update on public.walk_ins for update to authenticated
  using (is_admin()) with check (is_admin());
-- Receptionists: their own records, within the edit window from Settings.
create policy walk_ins_own_update on public.walk_ins for update to authenticated
  using (
    is_active_user() and created_by = app_user_id() and deleted_at is null
    and created_at > now() - make_interval(hours => (select edit_window_hours from app_settings where id = 1))
  )
  with check (created_by = app_user_id() and deleted_at is null);

create policy notifications_read on public.notifications for select to authenticated using (is_active_user());

create policy activity_admin_read on public.activity_log for select to authenticated using (is_admin());

-- No delete policies anywhere: records are archived, never removed. login_attempts has no policies:
-- only the database owner (our server functions) touches it.
