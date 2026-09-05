# Parked Work

Known issues and follow-ups that have been deliberately deferred, with the reason. Nothing here
is forgotten or accidental — each was found during other work and consciously left.

---

## Deployment — required step

### Verify a migration batch actually applied

**Do this after every batch.** During the capacity pass, `0023`–`0027` were applied in one sitting
and `0027` alone was missing — with no error seen. The failure presented as a function that did not
exist, which was misread for half an hour as a caching problem. Nothing surfaced it until a test
failed.

```sql
-- Every object migrations 0023–0027 are supposed to create.
select 'session_seats_summary'    as object, to_regprocedure('public.session_seats_summary(text[])')      is not null as present
union all select 'workshop_recent_bookings', to_regprocedure('public.workshop_recent_bookings(date,date)') is not null
union all select 'birthday_booking_counts',  to_regprocedure('public.birthday_booking_counts(date[],text)') is not null
union all select 'book_birthday_slot',       to_regprocedure('public.book_birthday_slot(jsonb,boolean)')   is not null
union all select 'workshops.spots_left gone',
  not exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='workshops' and column_name='spots_left')
union all select 'unique slot index (0022)',
  exists (select 1 from pg_indexes
           where schemaname='public' and indexname='workshop_sessions_live_slot_key');
```

→ every row `present = true`. Anything false did not apply, whatever the editor appeared to say.

Generalise the pattern for future batches: assert the objects exist rather than trusting that
running the script means it ran.

### Reload the PostgREST schema cache after adding or changing a function

```sql
notify pgrst, 'reload schema';
```

PostgREST caches the database schema, so a call to a genuinely new function can fail with
*"Could not find the function public.<name>(<args>) in the schema cache"* until it reloads. Cheap
to run, so do it as part of applying any migration that touches a function.

**Two things that make this error misleading.** The argument list in it is alphabetised by
PostgREST, not the order anything sent, so it reads as an argument-order mismatch and sends you
into the call site — it is not one. And the identical message appears when the function simply does
not exist, which is far more likely. **Check the function is really there before assuming a cache
problem** — that is what the verification query above is for.

One genuine third cause: a function with defaulted parameters resolves against a different
signature when a caller omits one. If the object exists, the cache has reloaded, and the call omits
an optional parameter, that is a real ambiguity.

---

## Needs client sign-off

### Birthday override UI — confirm dialog + timeline entry

`book_birthday_slot` (migration 0027) accepts `p_allow_override`, honoured only for callers
passing `is_staff()`. Staff-sourced bookings (`Admin`, `Walk-in`) currently pass `true`, which
preserves the behaviour staff had before the maxima were enforced at all.

That is a safe default, **not** the intended end state. The agreed design is:

- Staff are blocked by the same maxima as customers.
- The console names the limit and offers an explicit "Book anyway — this exceeds the daily
  maximum".
- The reason is recorded on the booking's timeline, so the exception is visible afterwards.

Rationale: the maxima are studio policy, not a physical constraint, and staff legitimately need
to exceed them (a private buyout). But staff double-book by accident far more often than they buy
out a studio, so a silent exemption solves the rare case and leaves the common one unprotected.

**Correction — the override is currently unreachable.** `addBooking` is called from exactly one
place, customer checkout, which always passes `source: 'Website'`. The wiring in `AppContext`
(`p_allow_override: source === 'Admin' || 'Walk-in'`) is therefore always false, because nothing
creates a booking with either source: the console creates *queue* rows, and the walk-ins shown on
the Bookings page are queue rows rendered in booking shape, not booking writes.

So the strict behaviour is already live — staff cannot exceed the maxima today, not because the
override is disabled but because staff cannot create birthday bookings through the app at all. The
mechanism in `book_birthday_slot` is correct and takes effect the moment a staff booking UI passes
`source: 'Admin'`. Nothing needs changing now; the note exists so the next person does not read the
wiring as active.

---

## Known limitations

### Customer "My Pieces" does not live-update

Customer pottery reads come from the `customer_pieces` / `customer_piece_history` views, which is
what keeps `damage_note` unselectable. Postgres emits `postgres_changes` for tables, not views, so
the list is correct on load but will not update while a customer sits on it. Staff, reading the
base tables, still get realtime.

Fixing it needs either a replication-backed alternative or a manual refresh control.

### Seat counts do not live-update

Same shape, different cause: seat counts come from RPCs (`session_seats_summary`), and an RPC
result is not a subscription. Counts are refetched on mount, when the session id set changes, when
the signed-in session changes, and via `notifySeatsChanged()` after any write that moves a seat.
Deliberate — seats are read far more often than they change, and `book_session_seats` holds the
real guarantee under a row lock.

### Birthday maxima are declared twice

`BIRTHDAY_DAILY_MAX` / `BIRTHDAY_SAME_SLOT_MAX` in `src/utils/queueUtils.ts`, and again in
`book_birthday_slot` (migration 0027). The function enforces them and cannot read the TypeScript
constants. Warning comments sit on both sides.

Reading them from `app_settings` instead would cost a lookup on every booking to avoid a rare
edit — judged the wrong trade. Change both together.

---

## Diagnosed, not fixed

### No SMS or in-app notification on customer self-cancellation

A customer cancelling their own booking gets **zero** confirmation beyond what is on screen at that
moment. `send-sms` requires an active staff session, so the call inside the flow takes a 401 and
fails silently; the in-app notification is separately blocked by RLS. The cancellation itself
always succeeds.

Needs a product decision on whether self-cancel should have its own notification path — e.g. a
service-role-permitted send for this specific case.

---

## Cleanup

### Deposit fallback hardcoded

The `500` deposit fallback is repeated in four places rather than read from one source.

### Studio phone number hardcoded

Repeated across five components. Should come from `app_settings` alongside the other studio
details.

### Migration probes log errors on every public page load

`checkMigrations()` (`src/lib/migrationCheck.ts`) pings every RPC with placeholder arguments on
mount to confirm it exists. Two of those pings are refused by design and surface as red console
errors on every signed-out page load — a `403` on `get_customer_summary` and a `400` on
`book_session_seats`. See "Investigated and explained" below for why each is expected.

Nothing is broken, but it reads as a fault to anyone who opens devtools, and has already cost one
round of investigation. Either skip the probes for anonymous visitors, or probe in a way that does
not log as an error.

---

## Open from the QA report

Source: `ARTY_QA_Bug_Report.md` (manual testing, customer site sections 1–6 plus Live Queue).
Everything still open is reproduced here so this file is the single source.

Closed already: **H1** (duplicate session rows), **H2** (My Pieces), **M1** (seat-count display),
**N5** (generator past dates).

### Medium-high

- **M2 — participant stepper does not cap to real availability.** On a session with 3 or 4 seats
  genuinely left, the `+` button still increments to 6 with no warning. The customer fills in the
  whole Customer Information step before being blocked at Confirm or Payment. Not an overbooking
  risk — the block is real and no row is created — purely the wasted journey. **Two parts:** cap
  the stepper to live remaining seats, and settle whether the hard cap of 6 is a deliberate
  per-booking limit (if so, say so in the UI: "Max 6 per booking — contact us for larger groups").
  Needs staff/manager confirmation.
- **M3 — auth not re-validated on in-app navigation.** Clearing the auth token without reloading
  and then navigating to My Reservations via the in-app nav still renders 5 real bookings with no
  sign-in prompt; a full reload correctly shows the prompt. Auth state is read once at
  initialisation and held in React state rather than re-checked per view. **Not a cross-customer
  leak** — the data is the right customer's, shown after the session should have been treated as
  invalid.

### Medium

- **N1 — email confirmation routes through "Set a new password".** Confirmation links from both
  normal signup and guest-checkout account creation land on the password-reset screen. If the
  account already has a password it dead-ends on *"New password should be different from the old
  password"*. Confirmed **not** a security bypass — unconfirmed accounts are refused login, and the
  original password works straight after. The two flows appear to share a redirect handler.
- **N2 — confirmation screen claims an SMS and email were sent.** *"A confirmation email and SMS
  with parking guidelines has been sent."* Neither is sent, and neither is supposed to be. Either
  drop the claim or send the notification.
- **N3 — `customers.source` saved as "Website" for a Live Queue walk-in.** The booking is labelled
  Walk-in correctly everywhere; only the `customers` row is mis-tagged. The right value is
  available in the same creation flow.
- **N4 — phone-only walk-ins cannot self-claim an account.** A customer with no email on file is
  told to ask the studio to add one, so they cannot self-serve at all. The real fix is SMS OTP
  claiming, which is a known unstarted feature rather than an isolated bug.
- **N6 — password carries between Sign In and Create Account tabs.** Typing a password on Sign In
  and switching tabs shows it pre-filled. No autofill highlight, so this is shared app state.
  Only the password field is affected.
- **N7 — password reset always reports success.** A reset rejected by Supabase (email rate limit)
  still showed *"reset link is on its way"*. The generic non-revealing wording is correct and
  should stay; the bug is that the real send result is never checked.
- **N8 — "Workshops Running" counts drafts.** The home page stat shows 7 (4 Published + 3 Draft)
  instead of 4. Should filter to `status = 'Published'`.

### Low

- **L1 — inconsistent contact-field validation.** Name blank, email blank and malformed phone give
  proper app messages; malformed email and blank phone fall through to the browser's native
  tooltip. Nothing gets through either way — this is consistency, not a gap.
- **L2 — `cancel_own_booking` bumps `updated_at` on a no-op.** Cancelling an already-cancelled
  booking correctly returns `already_cancelled` and changes nothing else, but `updated_at` still
  advances, so it is not a reliable "meaningfully modified" signal.
- **L3 — "All Levels" vs "All Levels (strict)".** The first means "no filter"; the second is a real
  tag value. Nearly identical labels for different things. Suggested: rename the first to "All"
  and drop "(strict)" from the second.
- **L4 — stale "Registered" badge after an auth record is deleted directly in Supabase.** Caused by
  an out-of-band database edit, not any in-app flow, so probably not a real defect today. Re-test
  if account deletion or merging is ever built into the app.

### Live Queue modals

- **Unbounded modal height.** Reported as **H3**: the "Add Walk-In to Queue" modal overflows past
  the visible area at a normal window size and does not scroll, hiding the "Add to Queue" button
  itself and blocking a core daily task until the window is resized. Four Live Queue modals share
  this shape. Fix: scrollable body (`overflow-y: auto`) or cap to viewport height with the actions
  pinned.

### Needs confirmation from staff or the manager

- **Participant cap of 6** — deliberate per-booking limit, or a bug? (See M2.)
- **Customer-facing add-ons (`workshop_options`)** — the table and data exist but no customer
  selector was found in the booking flow. Staff-only by design, or missing? Blocks QA test 3.3.
- **A "Cancelled" tab for My Reservations** — cancelled bookings currently stay in Upcoming until
  the session time passes, which matches the spec. Product question whether a dedicated tab would
  be better.

### Inconclusive — needs re-testing with a sound method

- **I1 / I2 — cross-customer and staff-table access under RLS.** The original attempt used the
  Supabase SQL Editor with `set_config('request.jwt.claims', ...)`, which connects as superuser
  and bypasses PostgREST, so **neither the pass on `bookings` nor the leak on `pieces` should be
  trusted**. Re-test with a real authenticated `fetch()` against the REST endpoint using a genuine
  customer access token. Worth doing — this is the only untested part of the security surface, and
  the H2 work has since changed what customers read.
- **I3 — Arabic / RTL.** Not built yet. Nothing to test until it ships.

---

## Found during the capacity investigation

Diagnosed while looking at something else, deliberately not fixed.

- **Live Queue staff cancel releases nothing.** Cancelling from the Live Queue does not release
  the seat and sends no notification, unlike the other cancellation paths.
- **"Forfeited" marks a booking Refunded.** The Forfeited action on the Bookings page sets the
  payment status to Refunded, which is the opposite of what forfeiting a deposit means, and is
  wrong in the customer's records and in any revenue figure derived from them.
- **Five cancellation paths, five behaviours.** Customer self-cancel, staff cancel on Bookings,
  Live Queue cancel, auto-cancel, and no-show each differ in what they release, what they notify,
  and what they record. They should agree, and any difference should be deliberate.
- **Walk-in workshop occupancy drift.** Walk-in workshop customers did not decrement the old
  per-workshop counter. That counter is now gone and customer-facing seats are counted from the
  bookings and queue directly, so the *display* is correct — but this should be re-confirmed
  end-to-end for a walk-in, since it was never verified after the change.

---

## Found during concurrency testing

Both found while writing the Block 4 race tests in `docs/manual-test-m1-capacity.md`. Neither is
reachable through the UI today.

### `book_session_seats` / `book_birthday_slot` bypass column defaults

Both RPCs insert with:

```sql
insert into public.bookings
select * from jsonb_populate_record(null::public.bookings, p_booking);
```

`jsonb_populate_record` over a **null** base produces a full row with `null` in every key the JSON
omitted, and `select *` inserts those nulls explicitly. An explicit null overrides a column default,
so defaults never apply through this path.

Not currently breaking anything — the client sends a complete object. The risk is future: any
column added later as `NOT NULL DEFAULT ...` will break customer checkout **at runtime with a
23502, not at deploy time**, and the migration adding it will look entirely safe.

Surfaced by a race-test payload missing `created_at`, which failed with *"null value in column
`created_at` of relation `bookings` violates not-null constraint"* despite `created_at` having a
`now()` default.

Fix when either function is next touched: build the insert with an explicit column list, or
populate over a base row that already carries the defaults.

### `book_session_seats` skips capacity checks when `p_session_id` is null

The row lock (`select ... for update` on `workshop_sessions`) and the capacity check both sit
inside `if p_session_id is not null then`. A request that passes `p_session_id: null` while
carrying a `session_id` **inside** `p_booking` inserts a seat-consuming booking with no capacity
check at all.

Not reachable through the UI — the client always passes the parameter — but the function is
executable by `anon`, so this is a crafted-request hole rather than a theoretical one.

Fix: derive the session id from `p_booking->>'session_id'` when the parameter is null, and refuse
the call if both are absent.

---

## For the client — scoping

- **Do item sales and counter payments belong in this app at all?** Both were partially built. They
  are point-of-sale concerns rather than booking concerns, and half-implementing them is worse
  than either finishing or removing them. Needs a decision before more work goes in either
  direction.

---

## Investigated and explained — no action needed

Recording these so they are not re-reported. Two errors appear in the browser console on every
page load when signed out:

- `403` on `get_customer_summary`
- `400` on `book_session_seats`

**Both are deliberate probes, not faults.** `MigrationWarning` calls `checkMigrations()`
(`src/lib/migrationCheck.ts`) on mount, which pings every RPC with placeholder arguments purely to
see whether it exists. `rpcExists` treats *any* error other than "function not found" as proof the
function is present, so both responses are the intended outcome:

- `get_customer_summary` returns 403 because migration `0011` revoked it from `anon` to close an
  anonymous PII enumeration hole. Anonymous callers are *supposed* to be refused.
- `book_session_seats` returns 400 because the probe passes `{ p_booking: {}, p_session_id: null }`,
  which the function correctly rejects. A 400 here means "exists, and validated its input".

**The one real (cosmetic) issue:** these are logged as errors on every public page load, which
looks like a fault to anyone opening devtools — including whoever reports it next. Worth either
skipping the probes for anonymous visitors, or checking for the functions in a way that does not
surface as a console error. Low priority, but it costs time every time someone notices it.
