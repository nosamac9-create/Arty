# Parked Work

Known issues and follow-ups that have been deliberately deferred, with the reason. Nothing here
is forgotten or accidental — each was found during other work and consciously left.

---

## LAUNCH BLOCKER

### The payment flow is simulated — no money moves

`CheckoutPaymentSection.completePayment()` resolves an 800ms `setTimeout` and then writes the
booking. There is **no Moyasar integration, no provider call, no card capture, and no payment
record**. Every booking in the database marked `Paid` or `Deposit Paid` was marked so by the client
without any money changing hands.

The site's stated purpose is taking payment for workshop and birthday bookings, so **it cannot
launch in this state**. This is not a defect in the booking logic — capacity, locking and
idempotency are all real and tested — it is that the step between choosing a session and holding a
confirmed booking does not exist.

The STC Pay copy at `CheckoutPaymentSection.tsx:383` — *"A payment authorization notification will
be pushed to your STC Pay app"* — is false for the same reason. It should be written when the real
flow exists and describes what that flow actually does, not before. Fixing the wording now would
just produce a different false statement.

### Customer-triggered SMS has no access path

`send-sms` is gated on `is_staff()` (`supabase/functions/send-sms/index.ts`), verified against
Supabase Auth. That is correct for what it does today — every existing caller is a staff action:
booking cancellation by staff, piece status changes, pickup reminders.

But it means **any future customer-triggered send cannot use it as-is**. That covers a booking
confirmation SMS, and the already-recorded self-cancellation gap (see *"No SMS or in-app
notification on customer self-cancellation"* below, which is the same wall from the other side).
Solving one solves both, and the shape of the solution — a `SECURITY DEFINER` wrapper, a
server-side trigger, or a separate function with its own narrower authorisation — should be decided
once for both rather than twice.

No booking-confirmation SMS or email is wanted (client decision), so this is only a blocker for the
self-cancel notification today.

### N7 — password reset always reports success

A reset request rejected by Supabase (email rate limit, provider failure) still shows *"reset link
is on its way"*. The send result is never checked. The generic non-revealing wording is correct and
should stay — the bug is that it does not reflect reality.

`AdminDashboardSection.tsx:182-190` is the pattern to copy: it branches on the real result and
tells staff *"the text message could not be sent: …"* when the send fails. It is currently the only
place in the app that reports a true send outcome.

Affects `AppContext.tsx:1123` and its three callers — `AuthSection.tsx:257`,
`AdminLoginSection.tsx:53`, `CheckoutInfoSection.tsx:147`.

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

### `parseBookingDateTimeToRiyadhDate` returns a browser-local Date

`dateUtils.ts:62` returns `new Date(y, m, d, h, min)`, which is built in the **browser's**
timezone, not Riyadh. Correct for the same-day comparisons it was written for, wrong for anything
absolute.

It is used by the session generator's past-slot guard and the workshop detail page's cutoff logic,
so a customer browsing from a different timezone may see a different set of bookable slots than a
customer in Jeddah.

Found while writing the `.ics` export on the booking confirmation screen, which deliberately does
not use it — that converts to UTC with a fixed +03:00 offset instead, so the calendar entry is
correct wherever it is opened.

Needs its own investigation before launch.

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
**N5** (generator past dates), **N2** (false email/SMS claim), **N8** (stat counted drafts),
**L3** (skill-level labels), **N6** (shared password state), **N7** (reset always reported success),
**L1** (native validation tooltips), **N3** (customer source always "Website"),
**N1** (confirmation links routed to password reset — *fixed, not yet verified, see below*),
**L2** (investigated, not reproducible — see below).

Also closed, with no item number because it was not in the QA report: **the workshop grid showed
Archived workshops to customers** (it filtered `!== 'Draft'`). Found while fixing N8 and recorded
in that entry, noted here so it is findable on its own.

Still open: **M2**, **M3**, **N4**, **L4**, the Live Queue modals, the three staff/manager
questions, and I1/I2.

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

- **N1 — FIXED, NOT YET VERIFIED.** The recovery effect routed to the reset-password screen
  whenever the URL fragment contained `access_token`, which every Supabase auth link carries —
  signup confirmation and email-change included. Now keyed on `type === 'recovery'`, checked in
  both the fragment and the query string. A link error still routes there deliberately, because
  that screen is the one that can explain an expired link.

  **Verification is outstanding.** The confirmation email redirects to the Vercel deployment, so
  the attempt made during the fix exercised the old build. Three checks against the deployed build:

  1. A **signup confirmation** link must land the user signed in, *not* on "Set a new password".
  2. A **password reset** link must still reach the reset screen. This is the regression risk —
     the fix narrows the condition, so what needs proving is that it did not narrow too far.
  3. An **expired link** must still land somewhere that explains itself.

  Was confirmed **not** a security bypass when reported: unconfirmed accounts are refused login,
  and the original password works straight after confirming.
- **N2 — confirmation screen claims an SMS and email were sent.** *"A confirmation email and SMS
  with parking guidelines has been sent."* Neither is sent, and neither is supposed to be. Either
  drop the claim or send the notification.
- **N3 — FIXED.** Wider than reported: `resolveCustomer` passed `p_source: null` and the RPC
  defaults a null to `'Website'`, so *every* customer row was tagged Website regardless of origin,
  not just Live Queue walk-ins. Source is now threaded from each caller using the
  `CustomerAccount` vocabulary — `'Workshop Booking'`, `'Birthday Package'`, `'Live Queue'`,
  `'Admin Created'`. Creation only: the RPC matches on phone then email and its UPDATE branch never
  touches the column. **No backfill** — existing rows stay `Website`, because inferring origin from
  earliest bookings would replace an obviously-unset field with plausible guesswork.
- **N4 — phone-only walk-ins cannot self-claim an account.** A customer with no email on file is
  told to ask the studio to add one, so they cannot self-serve at all. The real fix is SMS OTP
  claiming, which is a known unstarted feature rather than an isolated bug.
- **N6 — FIXED.** Sign In and Create Account shared one `password` state. The live strength
  checklist under the Create Account field read that same shared value, so it would have sat
  unmoving while the customer typed — not in the report. Create Account now has its own
  `registerPassword`. Separate state rather than clearing on tab change: six places in that file
  switch screens, and a seventh added later would silently reintroduce it.
- **N7 — FIXED.** Split by kind. An infrastructure failure (429/5xx, rate limit, SMTP, provider,
  timeout) now returns a real error the customer can act on; a per-account failure stays behind the
  generic message, because naming those would turn the form into a way of discovering which
  addresses have accounts. The three call sites already branched on `res.success` and needed no
  change.
- **N8 — FIXED.** The home page stat counted every row in `workshops`. Both it and the "View All"
  count on the same page (not in the report, same bug) now read one `publishedWorkshops` list.
  Fixed alongside it: the workshop grid filtered `!== 'Draft'`, so **Archived** workshops stayed
  visible and bookable to customers, and the grid and the stat were counting by two different
  rules. Both are now `status === 'Published'`.

### Low

- **L1 — FIXED.** The app rules already existed and were simply never reached: native validation
  runs before the submit handler. The email input is now `type="text"` with `inputMode="email"` and
  `autoComplete="email"` so the mobile keyboard and autofill are unchanged, and `required` is
  dropped from `PhoneInput` with the asterisk moved into the label. Phone validation itself is
  untouched — whether non-Saudi numbers are accepted is still a client question.
- **L2 — CLOSED, not reproducible.** Reported as `cancel_own_booking` advancing `updated_at` when
  cancelling an already-cancelled booking. It does not: the function returns at the
  `already_cancelled` guard (`0017_cancel_own_booking.sql:151`) **before** the `update` at `:200`,
  so no write to `bookings` happens on that path, and there is no trigger on the table. The only
  other `updated_at = now()` in the function is on `queue`. Confirmed against the database — every
  cancelled row has `updated_at` later than `created_at`, but all are genuine first cancellations,
  so nothing there evidences a no-op write. Do not re-open from the report without a reproduction.
- **L3 — FIXED.** Renamed to "Any level" (no filter) and "Suitable for all levels" (the tag), so
  the two differ in kind and not just wording. Filter values are unchanged. The workshop card still
  renders the raw `All Levels` tag; mapping the display there too was judged not worth a third
  file.
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

## Found during concurrency testing — fixed in 0029

Both found while writing the Block 4 race tests in `docs/manual-test-m1-capacity.md`. Neither was
reachable through the UI, but both functions are executable by `anon`, so both were reachable by a
crafted request. **Both fixed in migration `0029`**; kept here as the record of what was wrong and
why, since neither is visible from the current function bodies.

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

**Fixed in `0029`.** The payload is merged over a defaults object at the top of each function
(`defaults || p_booking`), so everything downstream sees one normalised object and any
caller-supplied key still wins. `id` and `date` are deliberately not defaulted — neither has a
default in the table, and a payload missing either is genuinely incomplete and must keep failing.

An explicit `null` in the payload also wins over the default and will still fail the constraint.
That is deliberate: omitting a key is an incomplete payload, sending `null` for it is a statement,
and only the first should be filled in.

The defaults are now duplicated from `0001_init` into both functions, with a warning comment on
each. They must be changed together.

### `book_session_seats` skips capacity checks when `p_session_id` is null

The row lock (`select ... for update` on `workshop_sessions`) and the capacity check both sit
inside `if p_session_id is not null then`. A request that passes `p_session_id: null` while
carrying a `session_id` **inside** `p_booking` inserts a seat-consuming booking with no capacity
check at all.

Not reachable through the UI — the client always passes the parameter — but the function is
executable by `anon`, so this is a crafted-request hole rather than a theoretical one.

`book_birthday_slot` had the same hole from the other direction, which the original entry missed.
It never looks at `session_id` — but `session_seats_taken` counts bookings by `session_id` **with
no `workshop_id` filter**, so a birthday-routed payload carrying a real `session_id` consumed
workshop seats through a function that checks only dates and slots. A second unguarded path to the
same outcome.

**Both fixed in `0029`.** `book_session_seats` now resolves the session as
`coalesce(p_session_id, p_booking->>'session_id')` and refuses when neither is present; the lock
and the capacity check no longer sit inside a conditional that can be skipped.
`book_birthday_slot` refuses any payload carrying a `session_id` at all.

Side effect worth knowing: `migrationCheck.ts` probes `book_session_seats` on every page load with
a null session, so that probe now returns the "not linked to a workshop session" refusal instead of
a 23502. `rpcExists` still passes — it only cares that the error is not function-not-found — but
the console text on a signed-out page load changed, and nothing else would explain why.

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
