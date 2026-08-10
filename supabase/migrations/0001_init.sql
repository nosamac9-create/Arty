-- =============================================================================
-- Arty Café — Stage 1a: schema, RLS, security-definer functions, config seed.
--
-- Mirrors the Dexie V9 store list (ARTY_STORES_V9) and the interfaces in
-- src/types.ts, converted to snake_case. Two deliberate departures from the
-- Dexie shape, both requested:
--   * workshop_sessions is its own table and the single source of truth. The
--     nested Workshop.sessions array is NOT carried over.
--   * pottery piece history moves out of a JSON column into piece_history,
--     append-only.
--
-- Credentials are owned by Supabase Auth. There is no password column on
-- customers or staff, and no password data is migrated.
--
-- Run once, in the Supabase SQL editor.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. ENUM
-- =============================================================================

-- src/types.ts: export type StaffRole = 'Super Admin' | 'Admin' | 'Staff';
do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_role') then
    create type public.staff_role as enum ('Super Admin', 'Admin', 'Staff');
  end if;
end
$$;

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- ---------- customers ----------
-- Identity key is normalized_phone (utils/customerIdentity.ts), NOT user_id:
-- most rows are walk-ins, admin-created or booking-derived and have no auth
-- user at all, which is why user_id is nullable.
create table if not exists public.customers (
  id                text primary key,
  user_id           uuid unique references auth.users(id) on delete set null,
  name              text not null default '',
  email             text,
  phone             text,
  display_phone     text,
  normalized_phone  text,
  source            text,
  status            text default 'Active',
  notes             text,
  has_account       boolean not null default false,
  total_spent       numeric(12,2),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

-- The returning-customer match key. Partial so many legacy blanks can coexist.
create unique index if not exists customers_normalized_phone_key
  on public.customers (normalized_phone)
  where normalized_phone is not null and normalized_phone <> '';

create index if not exists customers_email_idx on public.customers (lower(email));

-- ---------- staff ----------
create table if not exists public.staff (
  id                    text primary key,
  user_id               uuid unique references auth.users(id) on delete set null,
  name                  text not null,
  profile_image         text,
  country_code          text default '+966',
  phone                 text,
  normalized_phone      text,
  email                 text,
  position              text,
  skills                text[] not null default '{}',
  status                text not null default 'Active',
  weekly_schedule       jsonb not null default '{}'::jsonb,
  break_periods         jsonb not null default '[]'::jsonb,
  time_off              jsonb not null default '[]'::jsonb,
  notes                 text,
  can_assign_workshops  boolean not null default true,
  can_assign_pieces     boolean not null default true,
  role                  public.staff_role not null default 'Staff',
  permissions           text[] not null default '{}',
  has_console_access    boolean not null default false,
  password_is_temporary boolean not null default false,
  last_login_at         timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz,

  -- utils/adminAccess.ts ADMIN_PAGE_IDS, minus 'system-health'.
  -- 'system-health' is Super-Admin-only and is refused BEFORE the permission
  -- list is consulted, so it must never be storable as a grant. See the
  -- summary note: this CHECK lists 9 ids, not all 10.
  constraint staff_permissions_valid check (
    permissions <@ ARRAY[
      'dashboard','queue','customers','staff','bookings',
      'workshops-admin','events-admin','pieces-admin','settings'
    ]::text[]
  )
);

create index if not exists staff_status_idx on public.staff (status);
create unique index if not exists staff_normalized_phone_key
  on public.staff (normalized_phone)
  where normalized_phone is not null and normalized_phone <> '';

-- ---------- workshops ----------
-- No nested sessions column: workshop_sessions is the source of truth.
create table if not exists public.workshops (
  id                  text primary key,
  title               text not null,
  slug                text,
  category            text,
  hook                text,
  description         text,
  full_details        text,
  duration            text,
  age_range           text,
  price               numeric(10,2) not null default 0,
  pricing_type        text,
  capacity            integer not null default 0,
  spots_left          integer not null default 0,
  image               text,
  additional_images   text[] not null default '{}',
  instructor          text,
  staff_id            text references public.staff(id) on delete set null,
  room                text,
  room_id             text,
  table_id            text,
  materials           text[] not null default '{}',
  what_we_provide     text[] not null default '{}',
  instructions        text,
  cancellation_policy text,
  skill_level         text,
  status              text not null default 'Draft',
  featured            boolean not null default false,
  recurring_schedules jsonb not null default '[]'::jsonb,
  session_exceptions  jsonb not null default '[]'::jsonb,
  custom_fields       jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz,
  constraint workshops_price_non_negative check (price >= 0),
  constraint workshops_capacity_positive check (capacity >= 0)
);

create index if not exists workshops_category_idx on public.workshops (category);
create index if not exists workshops_status_idx on public.workshops (status);

-- ---------- workshop_sessions ----------
-- Follows WorkshopSessionRecord. room_id / table_id / rule_id are free ids
-- (studio_resources uses text ids and rules live in workshops.recurring_schedules),
-- so they are unconstrained by design.
create table if not exists public.workshop_sessions (
  id          text primary key,
  workshop_id text not null references public.workshops(id) on delete cascade,
  date        date not null,
  start_time  text not null,
  end_time    text,
  duration    text,
  instructor  text,
  staff_id    text references public.staff(id) on delete set null,
  room_id     text,
  room        text,
  table_id    text,
  table_name  text,
  rule_id     text,
  capacity    integer not null default 0,
  status      text not null default 'Published',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  constraint workshop_sessions_capacity_non_negative check (capacity >= 0)
);

create index if not exists workshop_sessions_workshop_idx on public.workshop_sessions (workshop_id);
create index if not exists workshop_sessions_date_status_idx on public.workshop_sessions (date, status);
create index if not exists workshop_sessions_staff_date_idx on public.workshop_sessions (staff_id, date);

-- ---------- bookings ----------
create table if not exists public.bookings (
  id                text primary key,
  customer_id       text references public.customers(id) on delete set null,
  customer_name     text,
  customer_email    text,
  customer_phone    text,
  workshop_id       text,
  session_id        text references public.workshop_sessions(id) on delete set null,
  workshop_title    text,
  date              date not null,
  time              text,
  participants      integer not null default 1,
  total_price       numeric(10,2) not null default 0,
  source            text not null default 'Website',
  status            text not null default 'Pending',
  payment_status    text not null default 'Unpaid',
  notes             text,
  birthday_details  jsonb,
  timeline          jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz,
  constraint bookings_participants_positive check (participants >= 1)
);

-- workshop_id is intentionally NOT a foreign key: birthday bookings carry the
-- sentinel 'birthday-party-event', which is not a workshops row.
create index if not exists bookings_date_idx on public.bookings (date);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_workshop_idx on public.bookings (workshop_id);
create index if not exists bookings_session_idx on public.bookings (session_id);
create index if not exists bookings_customer_idx on public.bookings (customer_id);

-- ---------- queue ----------
create table if not exists public.queue (
  id                     text primary key,
  booking_id             text references public.bookings(id) on delete set null,
  customer_id            text references public.customers(id) on delete set null,
  name                   text not null,
  phone                  text,
  activity               text,
  participants           integer not null default 1,
  check_in_time          text,
  elapsed_minutes        integer not null default 0,
  staff_avatar           text,
  staff_name             text,
  staff_id               text references public.staff(id) on delete set null,
  status                 text not null default 'Waiting',
  source                 text not null default 'Walk-in',
  type                   text not null default 'Without Instructor',
  hours                  numeric(5,2),
  workshop_type          text,
  date                   date not null,
  seated_time            timestamptz,
  workshop_id            text,
  session_id             text references public.workshop_sessions(id) on delete set null,
  session_start_time     text,
  session_end_time       text,
  session_duration       text,
  session_capacity       integer,
  returned_from_queue_id text references public.queue(id) on delete set null,
  extended_by_queue_id   text references public.queue(id) on delete set null,
  history                jsonb not null default '[]'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz
);

create index if not exists queue_date_idx on public.queue (date);
create index if not exists queue_status_idx on public.queue (status);
create index if not exists queue_booking_idx on public.queue (booking_id);
create index if not exists queue_customer_idx on public.queue (customer_id);
create index if not exists queue_session_idx on public.queue (session_id);

-- ---------- pieces ----------
-- damage_note is INTERNAL ONLY. It is never exposed to a customer session; see
-- the customer_pieces view below.
create table if not exists public.pieces (
  id                                    text primary key,
  piece_code                            text,
  customer_id                           text references public.customers(id) on delete set null,
  booking_id                            text references public.bookings(id) on delete set null,
  name                                  text not null,
  workshop_name                         text,
  customer_name                         text,
  customer_phone                        text,
  date_created                          date,
  image                                 text,
  status                                text not null default 'Created',
  days_elapsed                          integer not null default 0,
  assigned_staff                        text,
  damage_note                           text,
  storage_location                      text,
  notes                                 text,
  additional_description_glazing_notes  text,
  expected_completion                   date,
  expected_ready_date                   date,
  collection_date                       date,
  last_notification_date                date,
  created_at                            timestamptz not null default now(),
  updated_at                            timestamptz,
  -- The 8 configured stages, Broken included.
  constraint pieces_status_valid check (
    status in ('Created','Drying','In Processing','Glazing','Firing',
               'Ready for Collection','Collected','Broken')
  )
);

create index if not exists pieces_status_idx on public.pieces (status);
create index if not exists pieces_customer_idx on public.pieces (customer_id);

-- ---------- piece_history ----------
-- Append-only audit trail, replacing PotteryPiece.history.
create table if not exists public.piece_history (
  id          uuid primary key default gen_random_uuid(),
  piece_id    text not null references public.pieces(id) on delete cascade,
  status      text not null,
  "timestamp" timestamptz not null default now(),
  riyadh_time text,
  "user"      text not null default 'Staff',
  reason      text,
  created_at  timestamptz not null default now()
);

create index if not exists piece_history_piece_idx on public.piece_history (piece_id, "timestamp");

-- ---------- categories ----------
create table if not exists public.categories (
  id         text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_key on public.categories (lower(name));

-- ---------- notifications ----------
create table if not exists public.notifications (
  id             text primary key,
  type           text not null check (type in ('customer','staff')),
  customer_id    text references public.customers(id) on delete cascade,
  customer_phone text,
  title          text not null,
  message        text not null,
  piece_id       text references public.pieces(id) on delete set null,
  piece_name     text,
  new_status     text,
  performed_by   text,
  "timestamp"    timestamptz not null default now(),
  is_read        boolean not null default false,
  highlighted    boolean not null default false
);

create index if not exists notifications_type_idx on public.notifications (type);
create index if not exists notifications_customer_idx on public.notifications (customer_id);
create index if not exists notifications_phone_idx on public.notifications (customer_phone);

-- ---------- pipeline_stages ----------
create table if not exists public.pipeline_stages (
  id                  text primary key,
  name                text not null,
  color               text,
  "order"             integer not null default 0,
  visible_to_customer boolean not null default false,
  customer_label      text,
  enabled             boolean not null default true,
  notify_customer     boolean not null default true
);

-- ---------- workshop_options / event_options ----------
create table if not exists public.workshop_options (
  id      text primary key,
  type    text not null,
  value   text not null,
  "order" integer not null default 0,
  enabled boolean not null default true
);
create index if not exists workshop_options_type_idx on public.workshop_options (type, "order");

create table if not exists public.event_options (
  id      text primary key,
  type    text not null check (type in ('eventCategory','eventType','location','host')),
  value   text not null,
  "order" integer not null default 0
);
create index if not exists event_options_type_idx on public.event_options (type, "order");

-- ---------- events ----------
create table if not exists public.events (
  id              text primary key,
  title           text not null,
  category        text,
  event_type      text,
  short_description text,
  full_details    text,
  image           text,
  date            date,
  start_time      text,
  duration        text,
  capacity        integer not null default 0,
  spots_left      integer not null default 0,
  price           numeric(10,2) not null default 0,
  host            text,
  staff_id        text references public.staff(id) on delete set null,
  location        text,
  room_id         text,
  table_id        text,
  age_requirement text,
  skill_level     text,
  status          text not null default 'Draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  constraint events_price_non_negative check (price >= 0)
);

create index if not exists events_date_idx on public.events (date, status);

-- ---------- app_settings ----------
create table if not exists public.app_settings (
  id         text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- birthday_packages ----------
create table if not exists public.birthday_packages (
  id                text primary key,
  name              text not null,
  image             text,
  short_description text,
  full_description  text,
  price             numeric(10,2) not null default 0,
  pricing_type      text not null default 'Per child',
  pricing_label     text,
  duration          text,
  min_guests        integer not null default 1,
  max_guests        integer not null default 1,
  age_information   text,
  included_items    text[] not null default '{}',
  activity_choices  text[] not null default '{}',
  additional_info   text[] not null default '{}',
  cake_description  text,
  cake_sizes        jsonb not null default '[]'::jsonb,
  trainer_info      text,
  delivery_info     text,
  available_days    text[] not null default '{}',
  available_times   text[] not null default '{}',
  terms             text,
  customer_notes    text,
  deposit_amount    numeric(10,2),
  status            text not null default 'Draft' check (status in ('Published','Draft')),
  display_order     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

create index if not exists birthday_packages_order_idx on public.birthday_packages (display_order);

-- ---------- studio_resources ----------
create table if not exists public.studio_resources (
  id         text primary key,
  name       text not null,
  type       text not null check (type in ('Studio Room','Table Station')),
  seats      integer not null default 0,
  location   text,
  notes      text,
  status     text not null default 'Active' check (status in ('Active','Inactive','Maintenance')),
  "order"    integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- =============================================================================
-- 3. PRINCIPAL HELPERS
--
-- SECURITY DEFINER so a policy on `staff` can ask "is the caller staff?"
-- without re-entering that table's own policies (which would recurse).
-- =============================================================================

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid()
      and s.has_console_access = true
      and s.status not in ('Inactive','Former Staff')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = auth.uid()
      and s.has_console_access = true
      and s.status not in ('Inactive','Former Staff')
      and s.role = 'Super Admin'
  );
$$;

-- The customer row belonging to the caller, or NULL. A row with user_id IS NULL
-- can never be returned here, which is what makes unclaimed records staff-only.
create or replace function public.current_customer_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.id from public.customers c where c.user_id = auth.uid() limit 1;
$$;

-- Mirrors normalizeCustomerPhone() in utils/customerIdentity.ts exactly:
-- digits only, then drop a leading 00, then a leading 966, then a leading 0.
create or replace function public.normalize_customer_phone(p text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
begin
  if p is null then return ''; end if;
  d := regexp_replace(p, '\D', '', 'g');
  if d = '' then return ''; end if;
  if left(d, 2) = '00'  then d := substr(d, 3); end if;
  if left(d, 3) = '966' then d := substr(d, 4); end if;
  if left(d, 1) = '0'   then d := substr(d, 2); end if;
  return d;
end;
$$;

-- =============================================================================
-- 4. STAFF PRIVILEGE TRIGGER
--
-- Role, permissions and console access are Super-Admin-only, and an Admin may
-- never modify a Super Admin row. A policy cannot compare OLD to NEW, so this
-- is enforced here and applies to every write path.
-- =============================================================================

create or replace function public.enforce_staff_privilege_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Server-side/service-role callers (no JWT) are unrestricted.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_super_admin() then
    return new;
  end if;

  if old.role = 'Super Admin' then
    raise exception 'Only a Super Admin can modify a Super Admin account';
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only a Super Admin can change a role';
  end if;

  if new.permissions is distinct from old.permissions then
    raise exception 'Only a Super Admin can change permissions';
  end if;

  if new.has_console_access is distinct from old.has_console_access then
    raise exception 'Only a Super Admin can grant or revoke console access';
  end if;

  return new;
end;
$$;

drop trigger if exists staff_privilege_guard on public.staff;
create trigger staff_privilege_guard
  before update on public.staff
  for each row execute function public.enforce_staff_privilege_rules();

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

alter table public.customers         enable row level security;
alter table public.staff             enable row level security;
alter table public.workshops         enable row level security;
alter table public.workshop_sessions enable row level security;
alter table public.bookings          enable row level security;
alter table public.queue             enable row level security;
alter table public.pieces            enable row level security;
alter table public.piece_history     enable row level security;
alter table public.categories        enable row level security;
alter table public.notifications     enable row level security;
alter table public.pipeline_stages   enable row level security;
alter table public.workshop_options  enable row level security;
alter table public.event_options     enable row level security;
alter table public.events            enable row level security;
alter table public.app_settings      enable row level security;
alter table public.birthday_packages enable row level security;
alter table public.studio_resources  enable row level security;

-- ---------- customers ----------
drop policy if exists customers_staff_all on public.customers;
create policy customers_staff_all on public.customers
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- A customer sees exactly their own row. user_id IS NULL never matches.
drop policy if exists customers_self_select on public.customers;
create policy customers_self_select on public.customers
  for select to authenticated using (user_id = auth.uid());

drop policy if exists customers_self_update on public.customers;
create policy customers_self_update on public.customers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- staff ----------
-- Staff may read the registry (the console needs it); only a Super Admin may
-- insert or delete, and the trigger above governs which columns may change.
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff
  for select to authenticated using (public.is_staff());

drop policy if exists staff_update on public.staff;
create policy staff_update on public.staff
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists staff_insert_super_admin on public.staff;
create policy staff_insert_super_admin on public.staff
  for insert to authenticated with check (public.is_super_admin());

drop policy if exists staff_delete_super_admin on public.staff;
create policy staff_delete_super_admin on public.staff
  for delete to authenticated using (public.is_super_admin());

-- ---------- public catalogue: readable by anyone, writable by staff ----------
do $$
declare t text;
begin
  foreach t in array ARRAY[
    'workshops','workshop_sessions','events','categories','pipeline_stages',
    'workshop_options','event_options','app_settings','birthday_packages',
    'studio_resources'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_public_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_staff_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
      t || '_staff_write', t);
  end loop;
end
$$;

-- ---------- bookings ----------
drop policy if exists bookings_staff_all on public.bookings;
create policy bookings_staff_all on public.bookings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Only rows whose customer has claimed their account. A booking attached to an
-- unclaimed customer stays staff-only, and appears the moment a claim attaches
-- that customer's auth id.
drop policy if exists bookings_customer_select on public.bookings;
create policy bookings_customer_select on public.bookings
  for select to authenticated
  using (customer_id is not null and customer_id = public.current_customer_id());

-- ---------- queue ----------
drop policy if exists queue_staff_all on public.queue;
create policy queue_staff_all on public.queue
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists queue_customer_select on public.queue;
create policy queue_customer_select on public.queue
  for select to authenticated
  using (customer_id is not null and customer_id = public.current_customer_id());

-- ---------- pieces ----------
-- Staff only, on the base table. Customers read through customer_pieces, which
-- cannot return damage_note. See section 6.
drop policy if exists pieces_staff_all on public.pieces;
create policy pieces_staff_all on public.pieces
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- piece_history ----------
drop policy if exists piece_history_staff_all on public.piece_history;
create policy piece_history_staff_all on public.piece_history
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------- notifications ----------
drop policy if exists notifications_staff_all on public.notifications;
create policy notifications_staff_all on public.notifications
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- A customer sees their own customer-type notifications only.
drop policy if exists notifications_customer_select on public.notifications;
create policy notifications_customer_select on public.notifications
  for select to authenticated
  using (
    type = 'customer'
    and customer_id is not null
    and customer_id = public.current_customer_id()
  );

drop policy if exists notifications_customer_update on public.notifications;
create policy notifications_customer_update on public.notifications
  for update to authenticated
  using (
    type = 'customer'
    and customer_id is not null
    and customer_id = public.current_customer_id()
  )
  with check (
    type = 'customer'
    and customer_id is not null
    and customer_id = public.current_customer_id()
  );

-- =============================================================================
-- 6. CUSTOMER-SAFE PIECE VIEW
--
-- APPROACH: the base table `pieces` is staff-only under RLS. Customers read
-- their pottery through this view, whose column list simply does not contain
-- damage_note (nor the other internal fields: notes, assigned_staff,
-- storage_location, glazing notes). The view is SECURITY DEFINER by default
-- (security_invoker is NOT set), so it runs as its owner and applies its own
-- WHERE clause instead of the caller's RLS. There is therefore no SQL path by
-- which a customer session can select damage_note: it is absent from the only
-- relation they can read.
-- =============================================================================

create or replace view public.customer_pieces as
select
  p.id,
  p.piece_code,
  p.customer_id,
  p.name,
  p.workshop_name,
  p.date_created,
  p.image,
  p.status,
  p.days_elapsed,
  p.expected_completion,
  p.expected_ready_date,
  p.collection_date,
  p.created_at,
  p.updated_at
from public.pieces p
where p.customer_id is not null
  and p.customer_id = public.current_customer_id();

comment on view public.customer_pieces is
  'Customer-facing pottery. Deliberately omits damage_note and other internal fields.';

revoke all on public.customer_pieces from anon;
grant select on public.customer_pieces to authenticated;

-- The customer-visible slice of a piece's history, for the tracker. Internal
-- reasons (the damage explanation) are NOT exposed.
create or replace view public.customer_piece_history as
select
  h.id,
  h.piece_id,
  h.status,
  h."timestamp",
  h.riyadh_time
from public.piece_history h
join public.pieces p on p.id = h.piece_id
where p.customer_id is not null
  and p.customer_id = public.current_customer_id();

comment on view public.customer_piece_history is
  'Customer-facing piece timeline. Omits the internal reason/user columns.';

revoke all on public.customer_piece_history from anon;
grant select on public.customer_piece_history to authenticated;

-- =============================================================================
-- 7. SECURITY DEFINER FUNCTIONS
--
-- These replace the client-side reads of unclaimed customer rows. A customer
-- session can never select a row with user_id IS NULL, so the lookup has to
-- happen with elevated rights.
--
-- ⚠️  OWNERSHIP VERIFICATION IS ASSUMED TO HAVE ALREADY HAPPENED.
--     Both functions attach an auth id to a record identified only by a phone
--     number or email address. Call them ONLY after Supabase Auth has proven
--     the caller controls that phone/email (phone OTP or email confirmation).
--     Without that step, knowing a phone number is enough to take over a
--     walk-in customer's bookings and pottery.
--
-- ENUMERATION: both return NULL identically for "no such record" and "claimed
-- by somebody else". The two failure modes are indistinguishable to the caller,
-- so neither can be used to discover which numbers are on file.
--
-- IDEMPOTENT: re-running with the same auth id returns the same customer id and
-- writes nothing new. Neither function ever inserts a customer row.
-- =============================================================================

create or replace function public.claim_customer_account(
  identifier text,
  new_auth_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  key  text;
  mail text;
  row  public.customers%rowtype;
begin
  if identifier is null or btrim(identifier) = '' or new_auth_id is null then
    return null;
  end if;

  key  := public.normalize_customer_phone(identifier);
  mail := lower(btrim(identifier));

  -- Same order as findCustomerMatch(): phone first, then email.
  if key <> '' then
    select * into row from public.customers c
      where c.normalized_phone = key limit 1;
  end if;

  if row.id is null and mail <> '' then
    select * into row from public.customers c
      where lower(c.email) = mail limit 1;
  end if;

  -- No record: indistinguishable from "already claimed" below.
  if row.id is null then
    return null;
  end if;

  -- Already this caller's: idempotent success, no write.
  if row.user_id = new_auth_id then
    return row.id;
  end if;

  -- Claimed by somebody else: same NULL as "no record".
  if row.user_id is not null then
    return null;
  end if;

  update public.customers
     set user_id     = new_auth_id,
         has_account = true,
         updated_at  = now()
   where id = row.id;

  return row.id;
end;
$$;

revoke all on function public.claim_customer_account(text, uuid) from public, anon;

-- Registration path: link a walk-in / admin-created guest to the account being
-- created instead of inserting a duplicate customer. Behaviour is identical to
-- claim_customer_account; kept as a separate name so the two call sites stay
-- legible and can diverge later (e.g. different auditing).
create or replace function public.link_existing_customer(
  identifier text,
  new_auth_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ⚠️ Same precondition: ownership of the phone/email must already be proven.
  return public.claim_customer_account(identifier, new_auth_id);
end;
$$;

revoke all on function public.link_existing_customer(text, uuid) from public, anon;

-- Grant to signed-in users only; the caller must already hold a verified session.
grant execute on function public.claim_customer_account(text, uuid) to authenticated;
grant execute on function public.link_existing_customer(text, uuid) to authenticated;

-- =============================================================================
-- 8. CONFIGURATION SEED
--
-- Generated from the DEFAULT_ constants in src/types.ts and the ensureX()
-- helpers in AppContext.tsx, so first-run behaviour matches the app today.
-- No demo workshops / bookings / pieces / staff, and no accounts.
-- Every statement is ON CONFLICT DO NOTHING: safe to re-run.
-- =============================================================================

-- pipeline_stages
insert into public.pipeline_stages (id, name, color, "order", visible_to_customer, customer_label, enabled, notify_customer) values
  ('stage-1', 'Created', '#E07A5F', 0, true, NULL, true, true),
  ('stage-2', 'Drying', '#D4C5B9', 1, false, NULL, true, true),
  ('stage-3', 'In Processing', '#3D405B', 2, true, NULL, true, true),
  ('stage-4', 'Glazing', '#81B29A', 3, false, NULL, true, true),
  ('stage-5', 'Firing', '#F2CC8F', 4, false, NULL, true, true),
  ('stage-6', 'Ready for Collection', '#335C67', 5, true, NULL, true, true),
  ('stage-7', 'Collected', '#111111', 6, true, NULL, true, true),
  ('stage-8', 'Broken', '#B91C1C', 7, false, NULL, true, true)
on conflict (id) do nothing;

-- studio_resources
insert into public.studio_resources (id, name, type, seats, location, status, "order") values
  ('res-room-1', 'Studio Room 1', 'Studio Room', 12, 'Ground floor', 'Active', 0),
  ('res-room-2', 'Studio Room 2', 'Studio Room', 10, 'Ground floor', 'Active', 1),
  ('res-table-1', 'Table Station 1', 'Table Station', 4, 'Main lounge', 'Active', 2),
  ('res-table-2', 'Table Station 2', 'Table Station', 4, 'Main lounge', 'Active', 3)
on conflict (id) do nothing;

-- workshop_options
insert into public.workshop_options (id, type, value, "order", enabled) values
  ('wopt-skillLevel-0', 'skillLevel', 'Beginner', 0, true),
  ('wopt-skillLevel-1', 'skillLevel', 'Intermediate', 1, true),
  ('wopt-skillLevel-2', 'skillLevel', 'Advanced', 2, true),
  ('wopt-skillLevel-3', 'skillLevel', 'All Levels', 3, true),
  ('wopt-ageGroup-0', 'ageGroup', 'All Ages', 0, true),
  ('wopt-ageGroup-1', 'ageGroup', '4+ years', 1, true),
  ('wopt-ageGroup-2', 'ageGroup', '6+ years', 2, true),
  ('wopt-ageGroup-3', 'ageGroup', '12+ years', 3, true),
  ('wopt-ageGroup-4', 'ageGroup', '16+ years', 4, true),
  ('wopt-ageGroup-5', 'ageGroup', 'Adults only', 5, true),
  ('wopt-durationPreset-0', 'durationPreset', '1 Hour', 0, true),
  ('wopt-durationPreset-1', 'durationPreset', '1.5 Hours', 1, true),
  ('wopt-durationPreset-2', 'durationPreset', '2 Hours', 2, true),
  ('wopt-durationPreset-3', 'durationPreset', '2.5 Hours', 3, true),
  ('wopt-durationPreset-4', 'durationPreset', '3 Hours', 4, true)
on conflict (id) do nothing;

-- event_options
insert into public.event_options (id, type, value, "order") values
  ('eopt-0', 'eventCategory', 'Socials', 0),
  ('eopt-1', 'eventCategory', 'Masterclass', 1),
  ('eopt-2', 'eventCategory', 'Holiday Special', 2),
  ('eopt-3', 'eventCategory', 'Community Meetup', 3),
  ('eopt-4', 'eventType', 'Clay & Jazz', 0),
  ('eopt-5', 'eventType', 'Glazing Party', 1),
  ('eopt-6', 'eventType', 'Kids Playdate', 2),
  ('eopt-7', 'eventType', 'Beginner Painting', 3),
  ('eopt-8', 'location', 'Studio A', 0),
  ('eopt-9', 'location', 'Studio B', 1),
  ('eopt-10', 'location', 'The Terrace', 2),
  ('eopt-11', 'location', 'Main Lounge', 3),
  ('eopt-12', 'host', 'Arty Café Instructors', 0),
  ('eopt-13', 'host', 'Guest Artist Faisal', 1),
  ('eopt-14', 'host', 'Studio Manager Lina', 2)
on conflict (id) do nothing;

-- birthday_packages
insert into public.birthday_packages (
  id, name, image, short_description, full_description, price, pricing_type, pricing_label,
  duration, min_guests, max_guests, age_information, included_items, activity_choices,
  additional_info, cake_description, cake_sizes, trainer_info, delivery_info,
  available_days, available_times, terms, customer_notes, deposit_amount, status, display_order
) values
  ('bpkg-1', 'Canvas & Create', 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=800&q=80', 'Pre-sketched canvas, acrylic painting, balloons and studio decor.', 'A creative celebration in our studio: private space, your choice of one painting activity per child, balloon decoration and complimentary beverages.', 165, 'Per child', 'Per Child',
   '2 Hours', 5, 20, '4+ years', ARRAY['Studio decorations: balloons and setup', 'Complimentary beverages', 'Table reservation']::text[], ARRAY['Canvas Painting (Size 85)', 'Pre-made Pottery Painting', '3D Figures Painting', 'Tote Bag Painting']::text[],
   ARRAY[]::text[], 'Send us your cake design and we will do it.', '[{"id":"cake-s","label":"Small (15 cm)","price":350},{"id":"cake-m","label":"Medium (25 cm)","price":650},{"id":"cake-l","label":"Large (35 cm)","price":800}]'::jsonb, 'Includes Professional Trainer/Artist upon request.', '',
   ARRAY['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday']::text[], ARRAY['10:00 AM', '01:00 PM', '04:00 PM', '07:00 PM']::text[], 'A 500 SAR deposit is required to confirm the booking. Changes or cancellations must be made at least four days before the scheduled date to receive a refund of the deposit. Bringing outside food or drinks is not allowed.', '', 500, 'Published', 0),
  ('bpkg-2', 'Pottery Party', 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=800&q=80', 'Handbuilding clay, wheel throwing, firing service and studio decor.', 'A hands-on clay celebration: private studio space, your choice of one pottery activity per child, balloon decoration and complimentary beverages.', 200, 'Per child', 'Per Child',
   '2.5 Hours', 5, 20, '6+ years', ARRAY['Studio decorations: balloons and setup', 'Complimentary beverages', 'Table reservation']::text[], ARRAY['Hand-made Pottery Making', 'Wheel Throwing']::text[],
   ARRAY['Both activities include pottery coloring and firing.', 'Pottery will be delivered or collected after firing.']::text[], 'Send us your cake design and we will do it.', '[{"id":"cake-s","label":"Small (15 cm)","price":350},{"id":"cake-m","label":"Medium (25 cm)","price":650},{"id":"cake-l","label":"Large (35 cm)","price":800}]'::jsonb, 'Includes Professional Trainer/Artist.', 'Pottery will be delivered or collected after firing.',
   ARRAY['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Saturday']::text[], ARRAY['10:00 AM', '01:00 PM', '04:00 PM', '07:00 PM']::text[], 'A 500 SAR deposit is required to confirm the booking. Changes or cancellations must be made at least four days before the scheduled date to receive a refund of the deposit. Bringing outside food or drinks is not allowed.', '', 500, 'Published', 1)
on conflict (id) do nothing;

-- app_settings
insert into public.app_settings (id, value) values
  ('prePaymentInstructions', '{"enabled":true,"title":"Important Studio Safety & Timeline Instructions","message":"Please note the following studio rules before proceeding to payment.","instructions":["Clay Processing Time: All pottery created in the studio takes 10 to 14 days to completely air dry, undergo bisque-firing, be hand-glazed, and fired a second time.","Live Tracker: Once booked, your piece will appear in your \"My Pieces\" collection tracker where you can track its lifecycle stages.","Safety Attire: We recommend wearing clothes you do not mind getting a little clay on (although aprons are provided!).","Storage Window: Your finished pieces will be held at our collection shelves for up to 30 days post-firing."],"buttonLabel":"Continue to Payment","requiredCheckbox":true,"checkboxLabel":"I confirm I have read these safety rules and understand the 10-14 day firing timeline."}'::jsonb),
  ('defaultEventSettings', '{"defaultCapacity":15,"defaultDuration":"2.5 hours","defaultPrice":300}'::jsonb),
  ('eventsSettings', '{"birthdayTerms":{"version":"2026-08-1","title":"Event Terms and Guidelines","leadingItems":["Please adhere to the scheduled time of the event."],"suppliesIntro":"All event supplies will be provided by Arty Café, including:","supplies":["Celebration cake","Balloons","Beverages","Music"],"trailingItems":["A deposit of {deposit} SAR is required to confirm the booking.","Changes or cancellations must be made at least {cancellationDays} days before the scheduled event to receive a refund of the deposit.","Outside food and beverages are strictly prohibited."]}}'::jsonb),
  ('workshopFieldConfig', '[{"fieldId":"wf-title","fieldKey":"title","cardSection":"curriculum","label":"Workshop Title","fieldType":"short_text","placeholder":"e.g. Traditional Arabic Calligraphy Glazing","required":true,"enabled":true,"displayOrder":0,"customerVisible":true,"system":true,"boundTo":"title"},{"fieldId":"wf-category","fieldKey":"category","cardSection":"curriculum","label":"Category","fieldType":"dropdown","required":true,"enabled":true,"displayOrder":1,"customerVisible":true,"system":true,"boundTo":"category"},{"fieldId":"wf-hook","fieldKey":"hook","cardSection":"curriculum","label":"One-Line Hook (Subtext)","fieldType":"short_text","placeholder":"e.g. Mold clay on the wheel and paint under the stars","required":false,"enabled":true,"displayOrder":2,"customerVisible":true,"system":true,"boundTo":"hook"},{"fieldId":"wf-description","fieldKey":"description","cardSection":"curriculum","label":"Short Catchy Description","fieldType":"long_text","placeholder":"Brief summary shown on grids...","required":false,"enabled":true,"displayOrder":3,"customerVisible":true,"system":true,"boundTo":"description"},{"fieldId":"wf-full-details","fieldKey":"fullDetails","cardSection":"curriculum","label":"Full Details curriculum (Rich Text)","fieldType":"rich_text","placeholder":"Write full specifications of what students will accomplish week by week...","required":false,"enabled":true,"displayOrder":4,"customerVisible":true,"system":true,"boundTo":"fullDetails"},{"fieldId":"wf-price","fieldKey":"price","cardSection":"logistics","label":"Price in SAR","fieldType":"number","required":true,"enabled":true,"displayOrder":0,"customerVisible":true,"system":true,"boundTo":"price"},{"fieldId":"wf-duration","fieldKey":"duration","cardSection":"logistics","label":"Duration","fieldType":"dropdown","required":true,"enabled":true,"displayOrder":1,"options":["1 Hour","1.5 Hours","2 Hours","2.5 Hours","3 Hours"],"customerVisible":true,"system":true,"boundTo":"duration"},{"fieldId":"wf-age-range","fieldKey":"ageRange","cardSection":"logistics","label":"Age Range","fieldType":"dropdown","required":true,"enabled":true,"displayOrder":2,"options":["All Ages","4+ years","6+ years","12+ years","16+ years","Adults only"],"customerVisible":true,"system":true,"boundTo":"ageRange"},{"fieldId":"wf-skill-level","fieldKey":"skillLevel","cardSection":"logistics","label":"Skill Level","fieldType":"dropdown","required":false,"enabled":true,"displayOrder":3,"options":["Beginner","Intermediate","Advanced","All Levels"],"customerVisible":true,"system":true,"boundTo":"skillLevel"},{"fieldId":"wf-tutor","fieldKey":"tutor","cardSection":"logistics","label":"Tutor / Artist Specialist","fieldType":"dropdown","required":false,"enabled":true,"displayOrder":4,"customerVisible":true,"system":true,"boundTo":"staffId","dataSource":"staff"},{"fieldId":"wf-room","fieldKey":"room","cardSection":"logistics","label":"Studio Room / Table Station","fieldType":"dropdown","required":false,"enabled":true,"displayOrder":5,"customerVisible":false,"system":true,"boundTo":"roomId","dataSource":"studio-resources"},{"fieldId":"wf-materials","fieldKey":"materials","cardSection":"logistics","label":"Materials Included (Press Enter key)","fieldType":"tags","placeholder":"Add a material and press Enter...","required":false,"enabled":true,"displayOrder":6,"customerVisible":true,"system":true,"boundTo":"materials"}]'::jsonb),
  ('birthdayFormFields', '[{"id":"bf-1","key":"bookingName","label":"Booking Name","type":"short_text","placeholder":"e.g. Noura Al-Amri","required":true,"enabled":true,"order":0,"system":true},{"id":"bf-2","key":"phone","label":"Phone Number","type":"phone","required":true,"enabled":true,"order":1,"system":true},{"id":"bf-3","key":"numberOfPeople","label":"Number of People","type":"number","required":true,"enabled":true,"order":2,"system":true},{"id":"bf-4","key":"package","label":"Package","type":"package","required":true,"enabled":true,"order":3,"system":true},{"id":"bf-5","key":"bookingDate","label":"Date / Day","type":"date","required":true,"enabled":true,"order":4,"system":true},{"id":"bf-6","key":"bookingTime","label":"Time","type":"time","required":true,"enabled":true,"order":5,"system":true},{"id":"bf-7","key":"balloonColor","label":"Balloon Color 🎈","type":"dropdown","required":false,"enabled":true,"order":6,"options":["Pink & White","Pastel Blue & White","Gold & Cream","Rose Gold & Blush","Sage Green & Neutral","Rainbow Multi-Color","Custom Mix"]},{"id":"bf-8","key":"drinksChoice","label":"Drinks — coffee or fresh juices of your choice","type":"dropdown","required":false,"enabled":true,"order":7,"options":["Fresh Juices (Orange, Lemonade, Watermelon)","Specialty Coffee Bar (Latte, Cappuccino, Spanish Latte)","Mixed Bar (Coffee & Fresh Juices)"]},{"id":"bf-9","key":"birthdayPersonName","label":"Name of the Birthday Person","type":"short_text","placeholder":"e.g. Maya (Turning 8!)","required":true,"enabled":true,"order":8},{"id":"bf-10","key":"cakePhoto","label":"Please attach a photo of the cake","type":"image","helpText":"Send us your customized cake design photo and we will prepare it for you!","required":false,"enabled":true,"order":9}]'::jsonb)
on conflict (id) do nothing;


-- =============================================================================
-- End of migration.
-- =============================================================================
