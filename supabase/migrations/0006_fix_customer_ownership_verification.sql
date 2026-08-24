-- =============================================================================
-- 0006 — CLOSE THE WALK-IN ACCOUNT-TAKEOVER PATH (audit finding C-1)
--
-- Run once, in the Supabase SQL editor, after 0005.
--
-- THE BUG
-- resolve_customer_record() (0003) and claim_customer_account() /
-- link_existing_customer() (0001) all attach a caller-supplied auth id to an
-- existing unclaimed customer row as soon as a phone number matches, with no
-- check that the caller actually controls that identity yet:
--
--   * resolve_customer_record() is called by registerCustomer() the instant
--     auth.signUp() returns — before email confirmation exists, i.e. before
--     Supabase has proven anything about the caller.
--   * claim_customer_account() / link_existing_customer() trust their
--     `new_auth_id` argument outright. Nothing stops an authenticated caller
--     (any confirmed account, however new) from invoking either directly —
--     bypassing the app entirely — with somebody else's phone number and
--     their own auth id.
--
-- Either way: knowing a walk-in's phone number was enough to attach that
-- walk-in's bookings, queue history and pottery to an attacker-controlled
-- account. See the Chunk 0 audit, finding C-1.
--
-- THE FIX
-- Ownership may now only attach when BOTH hold:
--   1. auth.uid() = the auth id being attached. This comes from the caller's
--      own JWT, not an argument, so it cannot be forged — closing the direct
--      RPC/API bypass.
--   2. The target record's OWN stored email (already on file — from a prior
--      visit, a staff-entered record, or an earlier resolve_customer_record
--      call) equals the address that auth.uid() is actually authenticated as
--      in auth.users. This is the same rule customer_claim_email_matches()
--      already enforces for the sign-in claim flow; it is now enforced
--      inside the functions themselves, not only by the client before it
--      calls them.
--
-- A record with no email on file cannot satisfy #2 and stays unattachable
-- here, exactly like the existing claim_phone_pending stub — phone-only
-- claiming remains intentionally unimplemented pending SMS/OTP (Case C).
--
-- Everything else is unchanged: matching order (phone then email), the
-- "already this caller's" and "claimed by somebody else" short-circuits, the
-- NULL-for-both-failure-modes enumeration resistance, and the insert path for
-- a genuinely new customer (nobody else's record is at stake there).
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

  v_id := 'CUST-' || lpad(floor(random() * 90000 + 10000)::text, 5, '0');

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

-- -----------------------------------------------------------------------------
-- claim_customer_account() / link_existing_customer()
--
-- Same rule, enforced the same way, so the fix holds even when these are
-- called directly (Supabase client, curl, etc.) rather than through the app's
-- claimCustomerAccount()/loginCustomer(), which already verified the email
-- match client-side before calling in — that check was never mirrored inside
-- the function itself.
-- -----------------------------------------------------------------------------
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
  key          text;
  mail         text;
  row          public.customers%rowtype;
  caller_email text;
begin
  if identifier is null or btrim(identifier) = '' or new_auth_id is null then
    return null;
  end if;

  -- auth.uid() comes from the caller's own JWT and cannot be supplied or
  -- forged via the argument list, so this also stops a caller from claiming
  -- on behalf of a different auth id than their own.
  if auth.uid() is null or auth.uid() <> new_auth_id then
    return null;
  end if;

  select lower(btrim(u.email)) into caller_email from auth.users u where u.id = auth.uid();
  caller_email := coalesce(caller_email, '');
  if caller_email = '' then
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

  -- No record: indistinguishable from "already claimed" and "email does not
  -- match" below.
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

  -- The record's own stored email must equal the address the caller actually
  -- authenticated with. Blank (phone-only) stays refused here exactly as the
  -- claim_phone_pending route already refuses it client-side — Case C is
  -- still pending SMS/OTP, not implemented by this migration.
  if coalesce(btrim(row.email), '') = '' or lower(btrim(row.email)) <> caller_email then
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

-- link_existing_customer() only ever delegates to claim_customer_account(),
-- so it inherits the fix above unchanged; redefined here only so its own
-- comment reflects the new precondition.
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
  -- Ownership is verified inside claim_customer_account() itself now, not
  -- merely assumed of the caller: auth.uid() must equal new_auth_id, and that
  -- caller's own authenticated email must match the record's stored email.
  return public.claim_customer_account(identifier, new_auth_id);
end;
$$;

-- Grants are unchanged from 0001/0003 (still authenticated-only for the claim
-- pair, still anon+authenticated for resolve_customer_record's guest-booking
-- use); re-stated here only so this file is a complete, self-contained
-- record of the functions it touches.
revoke all on function public.resolve_customer_record(text, text, text, uuid, text) from public;
grant execute on function public.resolve_customer_record(text, text, text, uuid, text)
  to anon, authenticated;

revoke all on function public.claim_customer_account(text, uuid) from public, anon;
revoke all on function public.link_existing_customer(text, uuid) from public, anon;
grant execute on function public.claim_customer_account(text, uuid) to authenticated;
grant execute on function public.link_existing_customer(text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Verification.
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.resolve_customer_record(text,text,text,uuid,text)') is not null as resolve_fn_exists,
  to_regprocedure('public.claim_customer_account(text,uuid)')                 is not null as claim_fn_exists,
  to_regprocedure('public.link_existing_customer(text,uuid)')                 is not null as link_fn_exists;

-- =============================================================================
-- End of migration.
-- =============================================================================
