-- =============================================================================
-- Replace the 5-digit random suffix in a new customer's id with a uuid.
--
-- THE RISK THIS CLOSES
-- resolve_customer_record() generated ids as 'CUST-' plus a 5-digit random
-- number — a ~90,000-value space. customers.id is `text primary key`
-- (0001_init.sql), so a collision here was always a genuine constraint
-- violation, not silent corruption — but with no retry on that error, a
-- collision would simply fail whatever checkout, registration or walk-in
-- check-in triggered it, with a raw database error and no graceful handling.
-- The birthday-paradox math means that risk becomes meaningful well before
-- 90,000 customers exist.
--
-- THE FIX
-- 'CUST-' || gen_random_uuid()::text. Same prefix, same column, same every
-- other caller and reference — bookings.customer_id, notifications.customer_id,
-- pieces.customer_id and every other FK stay text-typed and format-agnostic,
-- so existing 'CUST-NNNNN' ids and new 'CUST-<uuid>' ids coexist with no
-- migration needed anywhere else. Collision probability becomes negligible
-- enough that no retry loop is needed — this is the same fix already applied
-- to queue.id in 0030, kept to just the id this time.
--
-- Nothing else in this function changes: matching order, the ownership-attach
-- rule from 0010, the fill-gaps-only update, all untouched. Only the one line
-- that manufactures a new id when no existing record matched.
--
-- Run after 0032_queue_without_instructor_no_session_link.sql.
-- =============================================================================

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
  -- Only a genuinely authenticated caller, attaching their own id, whose own
  -- confirmed email matches what is already on the record, may write to an
  -- existing row here. A guest/staff call (p_auth_id is null) is unaffected —
  -- it never touches user_id/has_account either way.
  v_may_attach boolean;
begin
  -- Phone first, then email — the same order the app uses.
  if v_key <> '' then
    select * into v_row from public.customers c where c.normalized_phone = v_key limit 1;
  end if;

  if v_row.id is null and v_email <> '' then
    select * into v_row from public.customers c where lower(c.email) = v_email limit 1;
  end if;

  if v_row.id is not null then
    v_may_attach :=
      v_row.user_id is null
      and p_auth_id is not null
      and auth.uid() = p_auth_id
      and coalesce(btrim(v_row.email), '') <> ''
      and lower(btrim(v_row.email)) = (select lower(btrim(u.email)) from auth.users u where u.id = p_auth_id);

    -- Field fill-in is gated the same way an unverified caller (mid-signup,
    -- before email confirmation) cannot poison a walk-in's stored contact
    -- details before ownership is provable. A guest/staff call (p_auth_id is
    -- null) is untouched by this and keeps filling gaps as before.
    if p_auth_id is null or auth.uid() = p_auth_id then
      update public.customers
         set name             = case when coalesce(btrim(p_name), '') <> '' then btrim(p_name) else name end,
             email            = case when v_email <> '' then v_email else email end,
             phone            = coalesce(v_display, phone),
             display_phone    = coalesce(v_display, display_phone),
             normalized_phone = case when v_key <> '' then v_key else normalized_phone end,
             -- Only ever attaches an account; never re-points one.
             user_id          = case when v_may_attach then p_auth_id else user_id end,
             has_account      = case when v_may_attach then true else has_account end,
             updated_at       = now()
       where id = v_row.id;
    end if;

    return v_row.id;
  end if;

  -- Was 'CUST-' || lpad(floor(random() * 90000 + 10000)::text, 5, '0') — a
  -- ~90,000-value space. See the header comment for why this changed.
  v_id := 'CUST-' || gen_random_uuid()::text;

  -- Brand new record: nobody else's data is at stake, so the caller's id is
  -- attached directly, same as before.
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
