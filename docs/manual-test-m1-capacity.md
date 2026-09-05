# M1 Capacity Pass — Consolidated Test Plan (solo)

Covers migrations 0023–0027, the five customer-facing seat displays, the submit-time guards, the
popularity ranking, the `spots_left` removal, and the birthday capacity fix.

Written for **one person working alone**. Ordered so state set up early is reused later — work top
to bottom.

## Before you start

- Migrations `0023`–`0028` applied, in order.
- Supabase **SQL Editor** open in a second tab. You will use it constantly; test state is created
  there, not in the console (see block 1).
- Browser **devtools open on the Network tab** — several results are about which request was made,
  not what appeared on screen.
- **Your project URL and anon key.** Both are public and safe in the browser. From the Supabase
  dashboard under Project Settings → API, or from your `.env` (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`). Block 4 needs them.

**Legend:** ⚠️ cannot be completed alone — see the note on that test.

---

## Block 0 — SQL editor only (no sign-in)

**0.1 — `spots_left` is gone**
```sql
select column_name from information_schema.columns
 where table_schema='public' and table_name='workshops' and column_name='spots_left';
```
→ **zero rows**. Then the same with `table_name='events'` → **one row** (that column stays).

**0.2 — seat counts are real**
```sql
select * from public.session_seats_summary(
  array['sess-gen-1788288856490-1','sess-gen-1788304880208-0']);
```
→ two rows, matching what the console shows.

**0.3 — unknown ids return nothing, not zeros**
```sql
select * from public.session_seats_summary(array['no-such-session']);
```
→ **zero rows**. A row of zeros here would make an unknown session look full.

**0.4 — popularity counts**
```sql
select * from public.workshop_recent_bookings(current_date - 29, current_date)
 order by recent_bookings desc;
```
→ counts matching the console's booking list per workshop.

**0.5 — birthday counts**
```sql
select * from public.birthday_booking_counts(array[current_date, current_date + 1]);
```
→ one row per date+time that has parties; dates with none are simply absent.

**0.6 — no duplicate sessions remain** (H1 regression check, cheap while you are here)
```sql
select workshop_id, date, upper(btrim(start_time)), count(*)
  from public.workshop_sessions where status <> 'Cancelled'
 group by 1,2,3 having count(*) > 1;
```
→ **zero rows**.

---

## Block 1 — Create the test state yourself

**Read this first: the staff console cannot create bookings.** `addBooking` is reachable only from
customer checkout. What the console creates is *queue* rows — walk-ins — and the "walk-ins" listed
on the Bookings page are queue rows displayed in booking shape, not booking records.

So test state is created in **SQL**, which is also faster and gives exact control. One walk-in is
created through the UI as well, because instructor-led walk-ins consume seats too and that path
should be exercised.

### 1.1 — Pick your target workshops

```sql
select w.id, w.title, w.capacity,
       count(s.id) filter (where s.status = 'Published' and s.date >= current_date) as upcoming
  from public.workshops w
  left join public.workshop_sessions s on s.workshop_id = w.id
 where w.status = 'Published'
 group by w.id, w.title, w.capacity
 order by upcoming desc;
```

Choose **workshop A** — several upcoming sessions — and **workshop B** — few upcoming sessions
(you will fill *all* of B's, so fewer is less work). Note both ids.

### 1.2 — Pick three sessions on workshop A

```sql
select id, date, start_time, capacity
  from public.workshop_sessions
 where workshop_id = '<WORKSHOP_A_ID>' and status = 'Published' and date >= current_date
 order by date, start_time;
```

Note three ids: **SESSION_PARTIAL**, **SESSION_FULL**, **SESSION_ONE_LEFT**.

### 1.3 — Create the seat state

Seeded directly, deliberately bypassing `book_session_seats` — you are creating a starting
position, not testing the booking path.

```sql
-- Partial: 3 of capacity taken.
insert into public.bookings (id, workshop_id, session_id, workshop_title, date, time,
                             participants, status, payment_status, source, customer_name)
select 'TEST-PARTIAL-1', s.workshop_id, s.id, 'Test seed', s.date, s.start_time,
       3, 'Pending', 'Paid', 'Website', 'Seed Partial'
  from public.workshop_sessions s where s.id = '<SESSION_PARTIAL>';

-- Full: exactly capacity taken.
insert into public.bookings (id, workshop_id, session_id, workshop_title, date, time,
                             participants, status, payment_status, source, customer_name)
select 'TEST-FULL-1', s.workshop_id, s.id, 'Test seed', s.date, s.start_time,
       s.capacity, 'Pending', 'Paid', 'Website', 'Seed Full'
  from public.workshop_sessions s where s.id = '<SESSION_FULL>';

-- One seat left: capacity minus 1.
insert into public.bookings (id, workshop_id, session_id, workshop_title, date, time,
                             participants, status, payment_status, source, customer_name)
select 'TEST-ONELEFT-1', s.workshop_id, s.id, 'Test seed', s.date, s.start_time,
       greatest(1, s.capacity - 1), 'Pending', 'Paid', 'Website', 'Seed One Left'
  from public.workshop_sessions s where s.id = '<SESSION_ONE_LEFT>';
```

Verify:
```sql
select * from public.session_seats_summary(
  array['<SESSION_PARTIAL>','<SESSION_FULL>','<SESSION_ONE_LEFT>']);
```
→ `seats_remaining` of roughly capacity−3, **0**, and **1** respectively.

### 1.4 — Fill every upcoming session on workshop B

For the "Class Full" badge, which requires *every* upcoming session to be full.

```sql
insert into public.bookings (id, workshop_id, session_id, workshop_title, date, time,
                             participants, status, payment_status, source, customer_name)
select 'TEST-B-' || s.id, s.workshop_id, s.id, 'Test seed', s.date, s.start_time,
       s.capacity, 'Pending', 'Paid', 'Website', 'Seed Full B'
  from public.workshop_sessions s
 where s.workshop_id = '<WORKSHOP_B_ID>' and s.status = 'Published' and s.date >= current_date;
```

Verify none has seats left:
```sql
select s.id, x.seats_remaining
  from public.workshop_sessions s
  join lateral public.session_seats_summary(array[s.id]) x on true
 where s.workshop_id = '<WORKSHOP_B_ID>' and s.status = 'Published' and s.date >= current_date;
```
→ every row `0`.

### 1.5 — Birthday state

```sql
-- DATE_SLOT_FULL: 2 parties at 06:00 PM, seven days out.
insert into public.bookings (id, workshop_id, workshop_title, date, time, participants,
                             status, payment_status, source, customer_name)
values
 ('TEST-BD-S1','birthday-party-event','Birthday Package', current_date + 7, '06:00 PM', 10,
  'Pending','Deposit Paid','Website','Seed Party 1'),
 ('TEST-BD-S2','birthday-party-event','Birthday Package', current_date + 7, '06:00 PM', 10,
  'Pending','Deposit Paid','Website','Seed Party 2');

-- DATE_DAY_FULL: 5 parties across different times, eight days out.
insert into public.bookings (id, workshop_id, workshop_title, date, time, participants,
                             status, payment_status, source, customer_name)
select 'TEST-BD-D' || g, 'birthday-party-event','Birthday Package', current_date + 8,
       (array['11:00 AM','01:00 PM','03:00 PM','06:00 PM','08:00 PM'])[g], 10,
       'Pending','Deposit Paid','Website','Seed Day ' || g
  from generate_series(1,5) g;
```

Verify:
```sql
select * from public.birthday_booking_counts(
  array[(current_date + 7)::date, (current_date + 8)::date]);
```
→ one row for day 7 (`06:00 PM`, count **2**); five rows for day 8, totalling **5**.

**Check the times match the form.** Open the birthday form and confirm its time options are exactly
these strings. If they differ, adjust the SQL — the per-slot rule matches on the exact stored text.

### 1.6 — One walk-in through the UI

In the console, Live Queue → **Add Walk-In** → type **With Instructor** → link it to
**SESSION_PARTIAL** → 1 guest → submit. Instructor-led walk-ins consume seats, so:

```sql
select * from public.session_seats_summary(array['<SESSION_PARTIAL>']);
```
→ `seats_taken` has gone up by 1. Confirms walk-in occupancy reaches the customer display, which
was never re-verified after the counter was removed.

### 1.7 — Note everything down

Workshop A and B names, the three session ids with dates and times, and the two birthday dates.

---

## Block 2 — Signed out (anonymous visitor)

The block that was broken. Every number here used to read as fully open.

**2.1 — Sign out completely.** Confirm you are anonymous before continuing.

**2.2 — Session picker shows real numbers.** Open workshop A, pick SESSION_PARTIAL's date.
→ It shows the true seats left (capacity − 4, including the walk-in). SESSION_FULL shows
**FULLY BOOKED** and is not clickable. Cross-check against 1.3/1.6.

**2.3 — A full session cannot be selected.** Click SESSION_FULL. → Nothing happens; disabled.

**2.4 — "Class Full" appears on the grid.** Workshop list, find workshop B.
→ **FULLY BOOKED** badge and the rotated **Class Full** overlay both show. Previously unreachable
on the public site.

**2.5 — One request per page, not one per session.** Network tab, reload the detail page.
→ Exactly **one** `session_seats_summary` call listing every session id — not twelve.

**2.6 — A full birthday slot is disabled.** Birthday form, pick DATE_SLOT_FULL.
→ The 06:00 PM slot is disabled, the others are not.

**2.7 — A full birthday date is refused.** Pick DATE_DAY_FULL.
→ *"This date is fully booked for birthday celebrations."*

**2.8 — The birthday guard fails closed.** Pick a date with room and fill the form. In devtools,
right-click the `birthday_booking_counts` request → **Block request URL**, then submit.
→ Refused with *"We could not confirm availability for that date."* — **not** allowed through.
The important one: an unenforceable maximum must never silently permit.

**2.9 — The workshop guard fails closed.** Same with `session_seats_summary`, then try to submit a
workshop booking. → Refused with *"We could not confirm how many seats are left."*

**2.10 — Unblock both requests before continuing.**

**2.11 — Featured carousel excludes full workshops.** Home page. → Workshop B is **not** in it.

**2.12 — Popularity sort is real.** Workshop grid, default "Popularity" sort.
→ Order tracks the counts from 0.4, most-booked first. Note your seeds count toward this — re-run
0.4 now if the order looks surprising.

---

## Block 3 — Signed in as a customer

Sign in once; do all of these before moving on.

**3.1 — Numbers did not change on sign-in.** Reopen workshop A. → Identical counts to 2.2.

**3.2 — Book a seat successfully.** Book 1 seat on SESSION_PARTIAL.
→ Succeeds, and the count on the page drops by 1 **without a reload** (`notifySeatsChanged`).

**3.3 — The submit-time guard actually refuses.** The guard that never worked. In the console on
any page of the site, signed in:
```js
const v = await import('/src/utils/validation.ts');
await v.validateBookingForm({ sessionId: '<SESSION_FULL>', participants: 1 });
```
→ `{ sessionId: 'This session is now fully booked...' }`. It previously returned `{}`.
*(On the deployed build the module path differs — use the workshop UI instead: get to the payment
step for a session you then fill via 1.3, and submit.)*

**3.4 — Over-request on a partial session.** Use SESSION_ONE_LEFT, request 3.
→ *"Only 1 spot is left for this session."*

**3.5 — No `book_session_seats` call when the pre-check refuses.** Network tab during 3.4.
→ A `session_seats_summary` call and **no** `book_session_seats` call. Confirms the pre-check
stopped you, not the server.

**3.6 — Book a birthday party successfully** on a date with room. → Succeeds.

**3.7 — Cancel a booking.** Cancel the 3.2 booking. → Succeeds, and the seat count goes back up
without a reload.

**3.8 — The failure path is visible and recoverable.** The most valuable test in this document: it
proves what a customer sees when something goes wrong, which no happy-path test can.

> **Requires migration `0028` and the 20s booking timeout.** Blocking a request in devtools does
> not make it fail — it makes it never resolve. Before the timeout existed this test could not be
> run at all: the button stuck on "Processing Payment..." indefinitely, with no error and no
> recovery short of reloading the page. That was the bug this test found. If you see that hang,
> `0028` is not applied or you are on an older build.

The confirmation screen used to render off a locally-built object while the write was still in
flight, so a customer could be congratulated with confetti and *then* shown an error for a booking
that never existed. That applied to any server-side failure — a session filling up mid-checkout, a
full birthday slot, a dropped connection — not just to rare ones.

1. Start a normal workshop booking and reach the payment step.
2. In devtools → Network, right-click any request to `rpc/book_session_seats` (or, if none has
   fired yet, use the Network conditions / request-blocking panel) and **Block request URL**. The
   pattern `*book_session_seats*` works.
3. Submit.

→ **No confirmation screen. No confetti.** You stay on the payment step with your details intact,
and see *"We could not complete your booking, and nothing has been charged. Please try again."*

→ You wait up to **20 seconds** — the timeout — not indefinitely. The message is the timeout
wording, which deliberately does *not* claim the booking failed: *"That took too long and we could
not confirm your booking. Nothing extra will be charged — please press the button again to check
and finish."* We genuinely do not know whether it landed, and the copy must not pretend otherwise.

→ The **Complete Booking button is still enabled.** This is the part that matters: the failure is
transient, so it must be retryable. A pre-check failure ("this session is full") correctly disables
the button instead, because retrying cannot help — confirm you can tell the two apart.

4. **Unblock the request and press the button again.** → The booking now completes normally and the
   confirmation appears. Nothing was left half-written: check there is exactly one row.

```sql
select id, status, payment_status from public.bookings
 where session_id = '<the session you used>' order by created_at desc limit 5;
```
→ One row from the successful attempt, **none** from the blocked one.

5. **The retry must not double-book — the important one.** Let the request through this time, but
   simulate a lost reply: submit normally, and the moment the `book_session_seats` request appears
   in the Network tab, **go offline** (Network conditions → Offline). The write commits server-side;
   your reply never arrives. Wait for the timeout, go back online, and press the button again.
→ Exactly **one** booking exists, and you land on the confirmation screen:
```sql
select id, created_at from public.bookings where id = '<the ART- code shown>';
```
→ **one row**. Two rows here, or two different `ART-` codes for one checkout, means the reference
code is not being reused and every timeout is costing a customer a duplicate booking and a seat.

6. **Repeat for a birthday booking**, blocking `*book_birthday_slot*`. Same expectations.

7. **The capacity variant.** Get to the payment step for a session with seats, then fill it from the
   SQL editor (a `TEST-` insert as in 1.3) and submit.
→ Refused with *"That session filled up while you were paying. Nothing has been charged — please
choose another date or time."* Note this message is different from step 3's, and deliberately so.

---

## Block 4 — Concurrency

### Why this is scripted, not two windows

Two browser windows and two hands gives a gap of 100–300ms. The lock window being tested is
microseconds wide, so the second submission would almost certainly arrive after the first had
already committed — testing the *sequential* case and reporting a pass that proves nothing about
the race. **Do not use two windows for this.** It is the kind of weak test that reads as green.

The script below fires several requests with `Promise.all` and no `await` between them, so they are
genuinely in flight together and all reach the function. That is a real test of the lock, and it is
stronger than two people clicking.

**What it does not cover:** the full UI journey concurrently. It exercises the database guarantee
directly, which is where the guarantee lives. The sequential UI case is covered by 4.3.

**Reading the result — `succeeded: 0` is a FAILURE, not a pass.** It does not mean the lock held;
it means every request was rejected *before reaching* the lock, so the test proved nothing. A valid
pass is **exactly one 200**, with the refusals carrying `23514` (`check_violation`) and the capacity
or slot message. If the refusals carry **`23502`** (not-null violation) the payload is incomplete —
see the note on defaults below — and the run must be discarded and repeated, not recorded.

### Setup

Open the site (signed out is fine), open the console, and paste:

> **Do not name these `URL` and `ANON`.** `const URL` shadows the browser's built-in `URL`
> constructor for the rest of the console session, and PostgREST calls `new URL(...)` internally —
> so every Supabase request the page makes afterwards throws, flooding the console with errors that
> look like the app breaking. The names below are deliberate.

> **Every NOT NULL column must be present in `p_booking`, even ones with defaults.** The RPCs
> insert via `jsonb_populate_record` over a null base, which writes an explicit null for any key
> the JSON omits — and an explicit null overrides a column default. `total_price`, `timeline` and
> `created_at` are included below for exactly this reason. Recorded in `docs/parked-work.md`.

```js
const SB_URL  = '<VITE_SUPABASE_URL>';   // e.g. https://xxxx.supabase.co
const SB_ANON = '<VITE_SUPABASE_ANON_KEY>';

async function fireConcurrently(fn, bodyFor, n = 5) {
  const attempts = Array.from({ length: n }, (_, i) =>
    fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'apikey': SB_ANON, 'Authorization': `Bearer ${SB_ANON}`,
                 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyFor(i))
    }).then(async r => ({ i, status: r.status, body: await r.text() }))
  );
  const results = await Promise.all(attempts);       // fired together, not in sequence
  const ok     = results.filter(r => r.status === 200);
  const failed = results.filter(r => r.status !== 200);
  console.log(`succeeded: ${ok.length}, refused: ${failed.length}`);
  results.forEach(r => console.log(r.status, r.body.slice(0, 120)));
  return { ok: ok.length, failed: failed.length };
}
```

**4.1 — The workshop race.** SESSION_ONE_LEFT has exactly 1 seat. Fire 5 bookings for it at once:

```js
await fireConcurrently('book_session_seats', i => ({
  p_booking: {
    id: `RACE-WS-${i}`, workshop_id: '<WORKSHOP_A_ID>', session_id: '<SESSION_ONE_LEFT>',
    workshop_title: 'Race test', date: '<SESSION_ONE_LEFT date, YYYY-MM-DD>',
    time: '<its start_time>', participants: 1, status: 'Pending',
    payment_status: 'Paid', source: 'Website', customer_name: 'Race Test',
    total_price: 0, timeline: [], created_at: new Date().toISOString()
  },
  p_session_id: '<SESSION_ONE_LEFT>'
}));
```

→ **`succeeded: 1, refused: 4`.** The refusals say *"Only 0 seat(s) left on this session"*.

Confirm the session was not oversold:
```sql
select * from public.session_seats_summary(array['<SESSION_ONE_LEFT>']);
```
→ `seats_taken` equals `capacity` exactly, never more.

**4.2 — The birthday race.** This is what 0027 was built for. Use DATE_SLOT_FULL's date but a slot
with only **1** party — first create one:

```sql
insert into public.bookings (id, workshop_id, workshop_title, date, time, participants,
                             status, payment_status, source, customer_name)
values ('TEST-BD-RACE','birthday-party-event','Birthday Package',
        current_date + 9, '07:00 PM', 10, 'Pending','Deposit Paid','Website','Seed Race');
```

> **The time string must match what the birthday form offers, exactly.** The per-slot rule compares
> stored text, so `'7:00 PM'` and `'07:00 PM'` are different slots and the test would pass for the
> wrong reason. `07:00 PM` is what the form currently offers — re-check it before running, and
> change both the seed and the payload together if it has moved.

Then fire 5 at that date and time:

```js
await fireConcurrently('book_birthday_slot', i => ({
  p_booking: {
    id: `RACE-BD-${i}`, workshop_id: 'birthday-party-event',
    workshop_title: 'Birthday Package', date: '<current_date + 9, as YYYY-MM-DD>',
    time: '07:00 PM', participants: 10, status: 'Pending',
    payment_status: 'Deposit Paid', source: 'Website', customer_name: 'Race Test',
    total_price: 0, timeline: [], created_at: new Date().toISOString()
  },
  p_allow_override: false
}));
```

→ **`succeeded: 1, refused: 4`**, refusals reading *"That time slot is fully booked for birthday
celebrations"*. **Before 0027 all five would have committed** — there was no server-side check of
any kind behind this.

```sql
select * from public.birthday_booking_counts(array[(current_date + 9)::date]);
```
→ `party_count` is **2**, never 3 or more.

**4.3 — Sequential UI check.** Not the race, but worth having: with one seat left, book it through
the site, then open a second window and try to book the same session.
→ The second window shows it as full. If you had it open already, it still refuses at submit.

**4.4 — Live seat count.** Sit on a workshop detail page. In SQL, insert a booking for that session.
→ Your count does **not** move. Seat counts are not realtime — expected and documented in
`parked-work.md`. Reload → the new count appears. *Recording expected behaviour, not a bug.*

---

## Block 5 — Staff console (signed in as staff)

**5.1 — The two panels agree.** Open workshop A in the console. Compare the seats-left figure in
the session list against the panel further down the form.
→ **Identical.** These used to disagree: one rendered stale form state, the other counted live
bookings.

**5.2 — Saving does not reset occupancy.** Note the seat counts. Edit an unrelated field (the hook,
say) and save. Reopen.
→ Seat counts **unchanged**. Every save previously reset the counter to full capacity. This is the
one you specifically asked to be fixed.

**5.3 — Editing capacity.** Change SESSION_PARTIAL's capacity by +2.
→ Seats left rises by 2, derived from live bookings. Save, reopen, still correct.

**5.4 — Staff still see everything.** Console counts match 0.2 and 1.3.

**5.5 — ⚠️ Staff birthday override — not testable through the UI.** There is no staff-side
booking creation, so this path cannot be exercised from the console. See the correction note at the
foot of this document. To confirm the *database* behaviour, call the RPC with a real staff token
(from devtools → Application → Local Storage → the Supabase auth entry → `access_token`) using the
`fireConcurrently` headers with `Authorization: Bearer <staff access_token>`, `n = 1`, and
`p_allow_override: true` against DATE_DAY_FULL. → Succeeds. The same call with `p_allow_override:
false`, or with the anon key, → refused.

**5.6 — Customers cannot exceed.** Already covered by 2.7 and 4.2.

---

## Block 6 — Regression glance

**6.1 — Session generation.** Console → workshop with recurring rules → generate for a month that
already has sessions. → *"All N sessions for <Month Year> already exist — nothing new to add."*
Generate for a past month → refused by name.

**6.2 — Nothing else moved.** Events still show their own capacity (`events.spots_left` kept
deliberately). Live Queue seat figures unchanged.

---

## Clean up

```sql
delete from public.bookings where id like 'TEST-%' or id like 'RACE-%';
```
Then remove the 1.6 walk-in through the Live Queue UI, and cancel anything you booked in block 3.

Re-run 0.6 afterwards to confirm you left no duplicate sessions behind.

---

## Correction noted during this rewrite

`addBooking` is called from exactly one place — customer checkout — which always passes
`source: 'Website'`. The staff override wiring in `AppContext` (`p_allow_override: source ===
'Admin' || 'Walk-in'`) is therefore **always false in practice**, because no code path creates a
booking with either source. The two `source: 'Walk-in'` occurrences elsewhere are a queue item and
a display mapping, not booking writes.

Consequences:
- The strict behaviour is already what is live. Staff cannot exceed the maxima today — not because
  the override is off, but because staff cannot create birthday bookings through the app at all.
- The earlier claim that this "preserves current staff behaviour" was vacuous. Nothing was
  preserved, because the path does not exist.
- The override mechanism in `book_birthday_slot` is correct and tested (5.5), and becomes live the
  moment a staff booking UI passes `source: 'Admin'`.

This does not change any migration or any customer-facing behaviour, and needs no code change now.
Recorded in `docs/parked-work.md` under the birthday override entry.
