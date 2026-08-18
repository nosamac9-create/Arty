-- =============================================================================
-- 0005 — SIGN IN WITH PHONE *OR* EMAIL
--
-- Run once, in the Supabase SQL editor, after 0004.
--
-- WHY THIS FILE EXISTS
-- An anonymous visitor cannot read `customers`: the policies from 0001 are
-- `to authenticated` and scoped to `user_id = auth.uid()`. So the app could not
-- tell, before sign-in, whether a typed phone number belonged to
--
--   (a) a walk-in record with no account yet  → must be offered the claim flow,
--   (b) a real website account                → must be asked for its password,
--   (c) nothing at all                        → must look identical to (b).
--
-- Two SECURITY DEFINER functions answer exactly those questions and nothing
-- more. Both live here rather than in the client because the client has no
-- rights to the rows involved, and must never be given them.
--
-- ENUMERATION
-- `customer_signin_route` folds "no record" and "already has an account" into
-- the same answer, the way claim_customer_account() already folds "no record"
-- and "claimed by someone else" into NULL. It does reveal that an *unclaimed*
-- record exists for an identifier — that disclosure is the feature: the whole
-- point is to tell a walk-in they have a record waiting. Nothing is returned
-- for a claimed account, which is where the private data lives.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Throttle table for the credential check below.
--
-- customer_signin_email() verifies a password outside Supabase's own auth
-- endpoint, which means it does not inherit that endpoint's rate limiting. On
-- its own that is a brute-force oracle, so attempts are counted here and the
-- identifier is locked out after a handful of failures.
-- -----------------------------------------------------------------------------
create table if not exists public.signin_attempts (
  identifier    text primary key,
  failed_count  int         not null default 0,
  locked_until  timestamptz,
  last_attempt  timestamptz not null default now()
);

alter table public.signin_attempts enable row level security;
-- No policies: nothing but a SECURITY DEFINER function may touch this.
revoke all on table public.signin_attempts from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Which sign-in route does this identifier need?
--
-- Returns jsonb:
--   { "route": "password" }
--       Ask for a password. This is also the answer when nothing matched, so
--       the two cases cannot be told apart.
--   { "route": "claim_email", "email_hint": "n****a@gmail.com" }
--       An unclaimed record with an email on file. Ownership is proven by the
--       Supabase confirmation email, so the claim may proceed today.
--   { "route": "claim_phone_pending" }
--       An unclaimed record with a phone and NO email. Knowing the number is
--       not proof of owning it.
--       ⚠️ TODO(stage-2): gate behind supabase.auth.signInWithOtp({ phone }) +
--       verifyOtp() once SMS is enabled. Until then the client refuses to
--       complete this claim; see claimCustomerAccount() in AppContext.tsx.
--
-- The hint is masked. It exists so someone who has forgotten which address the
-- studio holds can recognise it; it is not enough to receive mail at.
-- -----------------------------------------------------------------------------
create or replace function public.customer_signin_route(identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  key   text;
  mail  text;
  row   public.customers%rowtype;
  local text;
begin
  if identifier is null or btrim(identifier) = '' then
    return jsonb_build_object('route', 'password');
  end if;

  key  := public.normalize_customer_phone(identifier);
  mail := lower(btrim(identifier));

  -- Same order as findCustomerMatch(): phone first, then email.
  if key <> '' then
    select * into row from public.customers c
      where c.normalized_phone = key limit 1;
  end if;

  if row.id is null and mail like '%@%' then
    select * into row from public.customers c
      where lower(c.email) = mail limit 1;
  end if;

  -- Nothing on file, or the record already has an account: identical answers.
  if row.id is null or row.user_id is not null or row.has_account is true then
    return jsonb_build_object('route', 'password');
  end if;

  if coalesce(btrim(row.email), '') = '' then
    return jsonb_build_object('route', 'claim_phone_pending');
  end if;

  -- first character + last character of the local part, domain kept.
  local := split_part(row.email, '@', 1);
  return jsonb_build_object(
    'route', 'claim_email',
    'email_hint',
      case when length(local) <= 2
        then repeat('*', length(local))
        else left(local, 1) || repeat('*', greatest(length(local) - 2, 1)) || right(local, 1)
      end
      || '@' || split_part(row.email, '@', 2)
  );
end;
$$;

revoke all on function public.customer_signin_route(text) from public;
grant execute on function public.customer_signin_route(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- The email behind an identifier — returned ONLY when the password is right.
--
-- Supabase's signInWithPassword() takes an email, so signing in by phone needs
-- the address on the matched record. Handing that address to an anonymous
-- caller would turn a phone number into an email lookup, so it is released only
-- to a caller who already proved they hold the credential. A wrong password
-- returns NULL, exactly as an unknown identifier does.
--
-- The session itself is still minted by Supabase Auth: the client takes this
-- address straight to signInWithPassword(). Nothing here signs anybody in.
-- -----------------------------------------------------------------------------
create or replace function public.customer_signin_email(
  p_identifier text,
  p_password   text
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  key      text;
  mail     text;
  row      public.customers%rowtype;
  stored   text;
  attempts public.signin_attempts%rowtype;
  norm_id  text;
begin
  if p_identifier is null or btrim(p_identifier) = '' or coalesce(p_password, '') = '' then
    return null;
  end if;

  norm_id := lower(btrim(p_identifier));

  -- Locked out? Say nothing, and do not consume the lock by extending it.
  select * into attempts from public.signin_attempts where identifier = norm_id;
  if attempts.locked_until is not null and attempts.locked_until > now() then
    return null;
  end if;

  key  := public.normalize_customer_phone(p_identifier);
  mail := norm_id;

  if key <> '' then
    select * into row from public.customers c
      where c.normalized_phone = key limit 1;
  end if;

  if row.id is null and mail like '%@%' then
    select * into row from public.customers c
      where lower(c.email) = mail limit 1;
  end if;

  if row.id is null or row.user_id is null then
    return null;
  end if;

  select u.encrypted_password into stored
    from auth.users u
   where u.id = row.user_id;

  if stored is null or extensions.crypt(p_password, stored) <> stored then
    -- Count the failure. Five wrong tries buys a fifteen-minute pause.
    insert into public.signin_attempts as sa (identifier, failed_count, last_attempt)
         values (norm_id, 1, now())
    on conflict (identifier) do update
       set failed_count = case
             when sa.locked_until is not null and sa.locked_until <= now() then 1
             else sa.failed_count + 1
           end,
           locked_until = case
             when (case
                     when sa.locked_until is not null and sa.locked_until <= now() then 1
                     else sa.failed_count + 1
                   end) >= 5
               then now() + interval '15 minutes'
             else null
           end,
           last_attempt = now();
    return null;
  end if;

  -- Correct: clear the counter and hand back the address to sign in with.
  delete from public.signin_attempts where identifier = norm_id;

  select u.email into mail from auth.users u where u.id = row.user_id;
  return mail;
end;
$$;

revoke all on function public.customer_signin_email(text, text) from public;
grant execute on function public.customer_signin_email(text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Verification — both rows must come back true.
-- -----------------------------------------------------------------------------
select
  to_regprocedure('public.customer_signin_route(text)')      is not null as route_fn_exists,
  to_regprocedure('public.customer_signin_email(text,text)') is not null as email_fn_exists;

-- -----------------------------------------------------------------------------
-- Does the address typed in the claim form match the one on the record?
--
-- Claiming by phone means the visitor types an email for the account. The
-- Supabase confirmation link proves they own THAT address — it proves nothing
-- about their being the customer. So the address has to be the one the studio
-- already holds, or anyone who knew a phone number could claim the record with
-- an address of their own.
--
-- A boolean, and only ever for an unclaimed record. It does not reveal the
-- address; a caller must already know it to get `true`.
-- -----------------------------------------------------------------------------
create or replace function public.customer_claim_email_matches(
  p_identifier text,
  p_email      text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  key  text;
  mail text;
  row  public.customers%rowtype;
begin
  if p_identifier is null or btrim(p_identifier) = ''
     or p_email is null or btrim(p_email) = '' then
    return false;
  end if;

  key  := public.normalize_customer_phone(p_identifier);
  mail := lower(btrim(p_identifier));

  if key <> '' then
    select * into row from public.customers c
      where c.normalized_phone = key limit 1;
  end if;

  if row.id is null and mail like '%@%' then
    select * into row from public.customers c
      where lower(c.email) = mail limit 1;
  end if;

  -- Unclaimed records only: a claimed one is not claimable by anybody.
  if row.id is null or row.user_id is not null or row.has_account is true then
    return false;
  end if;

  return lower(btrim(row.email)) = lower(btrim(p_email));
end;
$$;

revoke all on function public.customer_claim_email_matches(text, text) from public;
grant execute on function public.customer_claim_email_matches(text, text) to anon, authenticated;

select to_regprocedure('public.customer_claim_email_matches(text,text)') is not null as claim_match_fn_exists;
