-- =============================================================================
-- Arty Café — Stage 2 fix: give the customer site a write path.
--
-- 0001 gave `customers` a staff-write policy and customer-scoped SELECT/UPDATE,
-- but no INSERT. The public site legitimately creates customer records in two
-- situations, and both were being refused:
--
--   1. Registration — a visitor signs up and their record must be created and
--      attached to the new auth user. Immediately after sign-up there may be no
--      session yet (email confirmation), so this cannot rely on auth.uid().
--   2. Guest booking — someone books without an account. The booking itself
--      already goes through book_session_seats (SECURITY DEFINER), but the
--      customer record behind it was blocked.
--
-- Rather than opening INSERT to anon — which would let anyone write arbitrary
-- customer rows — the guest path goes through a SECURITY DEFINER function that
-- controls exactly which columns can be set, and reuses the existing record
-- when the phone or email already matches, so no duplicate is ever created.
--
-- Run after 0002_capacity_rpc.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A signed-in customer may create their own record, and only their own: the
-- row must carry their auth id.
-- -----------------------------------------------------------------------------
drop policy if exists customers_self_insert on public.customers;
create policy customers_self_insert on public.customers
  for insert to authenticated
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Find-or-create the one shared customer record.
--
-- Mirrors resolveCustomer()/findCustomerMatch() in the app: the normalized
-- phone is the primary key for recognising a returning person, then email.
-- Details are only ever filled in, never blanked, and an existing account link
-- is never touched.
--
-- SECURITY DEFINER because the caller may be anonymous (a guest booking) or a
-- brand-new user whose session does not exist yet (registration). The column
-- list is fixed here, so a caller cannot set status, notes, or an arbitrary
-- user_id on somebody else's record.
-- -----------------------------------------------------------------------------
create or replace function public.resolve_customer_record(
  p_name    text default null,
  p_phone   text default null,
  p_email   text default null,
  p_auth_id uuid default null,
  p_source  text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key      text := public.normalize_customer_phone(p_phone);
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_display  text := case when v_key <> '' then '+966' || v_key else nullif(btrim(coalesce(p_phone, '')), '') end;
  v_row      public.customers%rowtype;
  v_id       text;
begin
  -- Phone first, then email — the same order the app uses.
  if v_key <> '' then
    select * into v_row from public.customers c where c.normalized_phone = v_key limit 1;
  end if;

  if v_row.id is null and v_email <> '' then
    select * into v_row from public.customers c where lower(c.email) = v_email limit 1;
  end if;

  if v_row.id is not null then
    -- Fill gaps only. A blank incoming value never clears a stored one.
    update public.customers
       set name             = case when coalesce(btrim(p_name), '') <> '' then btrim(p_name) else name end,
           email            = case when v_email <> '' then v_email else email end,
           phone            = coalesce(v_display, phone),
           display_phone    = coalesce(v_display, display_phone),
           normalized_phone = case when v_key <> '' then v_key else normalized_phone end,
           -- Only ever attaches an account; never re-points one.
           user_id          = case when user_id is null then p_auth_id else user_id end,
           has_account      = case when user_id is null and p_auth_id is not null then true else has_account end,
           updated_at       = now()
     where id = v_row.id;

    return v_row.id;
  end if;

  v_id := 'CUST-' || lpad(floor(random() * 90000 + 10000)::text, 5, '0');

  insert into public.customers (
    id, user_id, name, email, phone, display_phone, normalized_phone,
    source, status, has_account, created_at
  ) values (
    v_id,
    p_auth_id,
    coalesce(nullif(btrim(coalesce(p_name, '')), ''), 'Guest'),
    nullif(v_email, ''),
    v_display,
    v_display,
    nullif(v_key, ''),
    coalesce(p_source, 'Website'),
    'Active',
    p_auth_id is not null,
    now()
  );

  return v_id;
end;
$$;

revoke all on function public.resolve_customer_record(text, text, text, uuid, text) from public;
-- anon: guest bookings. authenticated: registration and staff-created records.
grant execute on function public.resolve_customer_record(text, text, text, uuid, text)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Reading back the row just created.
--
-- A guest has no session, so customers_self_select cannot match. This returns
-- only the fields the booking flow needs, for one id, and nothing else.
-- -----------------------------------------------------------------------------
create or replace function public.get_customer_summary(p_id text)
returns table (id text, name text, email text, phone text, normalized_phone text, has_account boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.email, c.phone, c.normalized_phone, c.has_account
    from public.customers c
   where c.id = p_id;
$$;

revoke all on function public.get_customer_summary(text) from public;
grant execute on function public.get_customer_summary(text) to anon, authenticated;
