# Staff Console — Manual Test Plan

Scope: the **admin / staff console only**. The customer site has its own plan at
`docs/manual-test-customer.md`.

## Before you start

**Environment**

- Run the site locally (`npx vite` → `http://localhost:5173/`) and reach the console via the
  footer **Staff Login** link, or use the deployed staff URL.
- Keep the Supabase **SQL Editor** open — many expected results are database facts, not screen
  facts, and are only checkable there.
- Keep a **second browser** (or a private window) signed in as a *customer*. Several console
  actions have a customer-facing consequence that must be verified on the other side.
- Have a phone that can receive SMS.

**Apply these first**, or tests will fail for reasons unrelated to what they test:

1. Migration `supabase/migrations/0017_cancel_own_booking.sql` applied.
2. The Edge Function deployed at its current version
   (`npx supabase functions deploy auto-cancel-bookings`) — the older deployed build still
   contains the removed unpaid-payment rule.

**Accounts you need**

| Role | How to get it |
|---|---|
| **Super Admin** | Existing seeded account, or `npm run create-super-admin` |
| **Admin** | Staff Management → create, role Admin, console access on |
| **Staff** | Staff Management → create, role Staff, console access on |
| **Inactive staff** | Any account set to `Inactive` or `Former Staff` |

**The role model** (`utils/adminAccess.ts`) — worth reading once before flow 1, since most
permission expectations follow from it:

- **Super Admin** — every page, unconditionally (`canAccessPage:81`).
- **Admin** — defaults to every page *except* `settings` and `system-health`
  (`defaultPermissionsForRole:100-103`). Permissions are per-page ids stored on the staff record.
- **Staff** — defaults to `dashboard` and `queue` only.
- **`system-health` is Super-Admin-only** and is refused *even if the id is somehow stored on the
  account* (`canAccessPage:83`). `sanitizePermissions:110-114` also strips it on save.
- Sign-in additionally requires `hasConsoleAccess === true` and a status that is neither
  `Inactive` nor `Former Staff` (`hasConsoleAccount:68-71`).

**⚠ Structural note — "direct URL" is not testable, and I have substituted the real equivalent.**
The console has **no URL routing**: `App.tsx:147+` renders pages from an `adminTab` state value,
so every page is the same URL and there is no address to type. The genuine bypass attempt is to
set that state directly from the browser console. Tests 1.7 and 1.8 do exactly that, which is a
*stronger* test than a URL would be — it skips the sidebar entirely and hits the render guard.

**Reset between runs.** Note the ids of anything you create so you can remove it afterwards.

---

## 1. Auth and roles

### 1.1 Super Admin sign-in

- **Preconditions:** Signed out. A Super Admin account.
- **Steps:** Footer → **Staff Login** → sign in.
- **Expected:** The console opens. The sidebar lists **all ten** pages: Dashboard, Live Queue,
  Customers, Staff Management, Bookings, Workshops, Events & Socials, Pottery Pieces,
  System Health, Settings (`ADMIN_PAGES:32-42`). Each one opens without an access-denied screen.
- **Actual / Notes:**

### 1.2 Admin sign-in — reduced sidebar

- **Preconditions:** An Admin account with default permissions.
- **Steps:** Sign in as that Admin.
- **Expected:** The sidebar lists eight pages — **System Health and Settings are absent**
  (`defaultPermissionsForRole:100-103`). Everything listed opens normally.
- **Actual / Notes:**

### 1.3 Staff sign-in — minimal sidebar

- **Preconditions:** A Staff-role account with default permissions.
- **Expected:** Sidebar shows **Dashboard and Live Queue only**. Landing page is the first
  allowed page (`firstAllowedPage:95-97`), i.e. Dashboard.
- **Actual / Notes:**

### 1.4 Staff account without console access (negative)

- **Preconditions:** A staff record with `hasConsoleAccess = false`.
- **Steps:** Attempt to sign in.
- **Expected:** Sign-in is refused (`hasConsoleAccount:68-71`). No console, no partial sidebar.
- **Actual / Notes:**

### 1.5 Inactive / Former Staff sign-in (negative)

- **Preconditions:** An account with console access but status `Inactive`, then `Former Staff`.
- **Steps:** Attempt sign-in with each.
- **Expected:** Refused in both cases, even though `hasConsoleAccess` is true — status is checked
  first (`hasConsoleAccount:69`). **This is the offboarding path**: verify it, because a former
  employee retaining console access is the worst outcome on this page.
- **Actual / Notes:**

### 1.6 Wrong password / unknown staff email (negative)

- **Steps:** Attempt sign-in with a bad password, then with an address that is not staff.
- **Expected:** Both fail with the same generic message. **Neither should reveal whether the
  address is a staff account.** Note any difference — the email-match fallback in `loginStaff()`
  was deliberately removed for exactly this reason (commit `e30cc76`).
- **Actual / Notes:**

### 1.7 Admin cannot reach System Health — sidebar and guard

- **Preconditions:** Signed in as Admin (default permissions).
- **Steps:**
  1. Confirm **System Health** is not in the sidebar.
  2. Open the browser console and force the page directly. In React DevTools set `adminTab` to
     `'system-health'`, or trigger the context setter if exposed.
- **Expected:** The **Access Denied** panel renders, not the page (`App.tsx:143-144`). The guard is
  at render, not just in the sidebar, so bypassing navigation does not bypass authorization.
  Additionally an effect redirects to the first allowed page (`App.tsx:65-67`) — record whether
  you see Access Denied, an immediate redirect, or both in sequence.
- **Actual / Notes:**

### 1.8 System Health stays denied even if the permission is granted

- **Preconditions:** Signed in as Super Admin.
- **Steps:**
  1. Staff Management → the Admin account → attempt to grant `system-health`.
  2. If the UI does not offer it, add it directly:
     `update staff set permissions = permissions || '["system-health"]'::jsonb where id = '…';`
  3. Sign in as that Admin and try 1.7 again.
- **Expected:** Still **denied**. `canAccessPage:83` refuses Super-Admin-only pages before
  consulting the stored list, and `sanitizePermissions:110-114` strips the id on any save through
  the UI. **A stored permission must not be enough.** This is the important one on this flow.
- **Actual / Notes:**

### 1.9 Admin cannot reach Settings

- **Preconditions:** Admin, default permissions.
- **Steps:** As 1.7, but force `adminTab` to `'settings'`.
- **Expected:** Access Denied. **⚠ Note the asymmetry:** `settings` is *not* in
  `SUPER_ADMIN_ONLY_PAGES` — it is merely absent from the Admin default. So unlike System Health,
  a Super Admin **can** legitimately grant Settings to an Admin, and it will then work. Confirm
  that is the intended policy; if Settings is meant to be Super-Admin-only, that is a gap, not a
  test failure.
- **Actual / Notes:**

### 1.10 Permission changes take effect

- **Preconditions:** Super Admin in one browser, Admin signed in in another.
- **Steps:** As Super Admin, remove `bookings` from the Admin's permissions. In the Admin's
  browser, try to open Bookings.
- **Expected:** Access is refused. Record whether it applies immediately, on navigation, or only
  after re-login — **I have not verified whether the staff record is re-read live**, so treat
  whichever you observe as the baseline rather than a pass/fail.
- **Actual / Notes:**

### 1.11 Staff log out

- **Steps:** Sign out of the console.
- **Expected:** Returned to the customer site (`setArea('customer')`, `AppContext.tsx:3420`).
  Re-opening the console requires signing in again; the previous session is not resumed.
- **Actual / Notes:**

---

## 2. Live Queue

### 2.1 Add a walk-in — **Without Instructor** (Type A)

- **Preconditions:** Console → Live Queue. At least one table free.
- **Steps:** Add walk-in → name, phone, guests, **hours**, type *Without Instructor* → save.
- **Expected:**
  - A row appears in **Waiting** with a `Q-###` id and today's date.
  - `queue` row: `type = 'Without Instructor'`, `source = 'Walk-in'`, `status = 'Waiting'`,
    `booking_id` **null**, `date` = today (`addQueueItem:2229-2242`).
  - **No `bookings` row is created** — confirm in SQL. Walk-ins are queue-only.
  - **No customer SMS or notification** is expected.
- **Actual / Notes:**

### 2.2 Hours and guests validation (negative)

- **Steps:** Try hours `0`, `-1`, `13`, and a blank; guests `0`, `2.5`, blank.
- **Expected:** "Hours must be a positive number", "Hours cannot exceed 12", "Guests must be a
  whole number of at least 1" (`queueUtils.ts:375-388`). Nothing is saved.
- **Actual / Notes:**

### 2.3 Add a walk-in — **With Instructor** (Type C)

- **Preconditions:** A workshop session running today with free seats. Note the session's
  remaining seats and the workshop's `spots_left` first.
- **Steps:** Add walk-in → type *With Instructor* → pick today's session → save.
- **Expected:**
  - Row appears in Waiting, linked to the session.
  - `queue` row has `session_id` set and `booking_id` **null**.
  - **The seat is consumed at session level**: `select public.session_seats_taken('SESSION_ID');`
    increases by the guest count (`0002_capacity_rpc.sql:33-38` counts queue rows with a null
    `booking_id`).
  - **`workshops.spots_left` does NOT change** — see Known/Deferred #1. Expected drift, not a bug
    to report.
- **Actual / Notes:**

### 2.4 Seat a guest (table assignment)

- **Preconditions:** A Waiting row; a table with enough free seats.
- **Steps:** Seat the guest → choose table(s) → confirm.
- **Expected:**
  - Row moves to **In Progress**; `seated_time` set; `table_ids` populated.
  - **If the row has a linked booking, that booking flips to `Checked In`** — verify in SQL
    (`markBookingCheckedIn`, `AppContext.tsx:1509`). This protects them from no-show auto-cancel.
  - The customer's My Reservations shows the booking as Checked In.
- **Actual / Notes:**

### 2.5 Seating without choosing a table (negative)

- **Steps:** Attempt to seat with no table selected.
- **Expected:** Refused — "Select at least one table before seating this guest."
  (`seatQueueItem:2338-2340`). Status stays Waiting.
- **Actual / Notes:**

### 2.6 Seating onto a table without room (negative)

- **Preconditions:** A table already occupied to capacity.
- **Steps:** Try to seat a group larger than the free seats there.
- **Expected:** Refused with a capacity message (`validateTableSelection`); nothing is written.
- **Actual / Notes:**

### 2.7 Call a guest

- **Steps:** On a Waiting row, use **Call**.
- **Expected:** Row moves to the **Called** column; `queue.status = 'Called'`.
  **The linked booking stays `Pending`** — Called has no booking-status mapping
  (`updateQueueStatus:2337-2340`). That is deliberate, and it is the state the no-show
  auto-cancel keys on.
- **Actual / Notes:**

### 2.8 Complete a visit

- **Steps:** On an In Progress row, use **Complete**.
- **Expected:** Row moves to **Completed**; `table_ids` cleared, so the table frees up
  (`updateQueueStatus:2325-2327`). A linked booking becomes `Completed`. Tables show as available
  again in the seating view.
- **Actual / Notes:**

### 2.9 Add Time (extending a self-guided visit)

- **Preconditions:** A **Completed**, *Without Instructor* row.
- **Steps:** Use **Add Time** → additional hours, guests, table(s) → confirm.
- **Expected:**
  - The original Completed row is **left intact**; a **new** queue row is created, linked via
    `returned_from_queue_id`, and goes straight to **In Progress**
    (`returnQueueItemToWaiting:2377`).
  - **No charge is recorded** for the extra hours — see Known/Deferred #4.
- **Actual / Notes:**

### 2.10 Add Time on an ineligible row (negative)

- **Steps:** Try Add Time on (a) a *With Instructor* row, and (b) a row that is not Completed.
- **Expected:** Refused — "Only self-guided (Without Instructor) sessions can be returned to
  Waiting." and "Only completed sessions can be returned to Waiting."
  (`AppContext.tsx:2384-2389`).
- **Actual / Notes:**

### 2.11 Cancel a queue row

- **Preconditions:** A Waiting or Called row **with** a linked booking. Note `spots_left`.
- **Steps:** Cancel it from the Live Queue.
- **Expected:** Row shows Cancelled; the linked booking becomes `Cancelled` with a timeline entry
  *"Status updated to Cancelled via Live Queue"*.
  **Expected gaps — do not report:** the seat is **not** released (`spots_left` unchanged),
  `payment_status` is left as-is (so a paid booking reads Cancelled + Paid), and **no SMS or
  notification reaches the customer**. See Known/Deferred #2. Verify the customer's My
  Reservations shows it cancelled with no message received.
- **Actual / Notes:**

### 2.12 Today-only filter

- **Preconditions:** A queue row dated **yesterday** (insert via SQL, or leave one overnight).
- **Steps:** Open Live Queue.
- **Expected:** Yesterday's row is **not shown** in any column — the page filters strictly to
  today's Riyadh date (`LiveQueueSection.tsx:1054-1056`). The counts exclude it.
- **Actual / Notes:**

### 2.13 A leftover row from a previous day

- **Preconditions:** The yesterday-dated row from 2.12, still `Waiting`.
- **Steps:** From the SQL editor, change its status (simulating a stale action), or find it via
  Bookings if it has a booking.
- **Expected:** **⚠ Behaviour to record, not a pass/fail.** `updateQueueStatus:2316` re-stamps
  `date` to **today** on any status change — so touching a stale row silently pulls it into
  today's queue. Meanwhile a separate effect moves Completed/Cancelled rows' dates *back* to their
  completion date (`AppContext.tsx:1400-1411`). Note what you observe; this interaction is
  deliberate but easy to mistake for a bug.
- **Actual / Notes:**

### 2.14 Two staff acting on the same row (negative, concurrency)

- **Preconditions:** Two console browsers on Live Queue, same Waiting row.
- **Steps:** In A, seat the guest. In B (without refreshing), seat the same guest to a
  *different* table.
- **Expected:** Record what happens. **⚠ I could not find optimistic-locking on queue writes** —
  `db.queue.update` is a straight upsert with no status precondition, so B likely overwrites A.
  Check whether the guest ends up on one table or two, and whether table capacity is left
  consistent. **This is a genuine unknown worth documenting carefully.**
- **Actual / Notes:**

---

## 3. Bookings admin

### 3.1 View and search

- **Preconditions:** Several bookings across dates and statuses.
- **Steps:** Open Bookings. Search by customer name, then reference code, then phone.
- **Expected:** Matching rows only; counts update; clearing the search restores the full list.
- **Actual / Notes:**

### 3.2 Filter by status and date

- **Steps:** Filter by each status; use the This Week filter.
- **Expected:** Only matching rows. **This Week is Sunday–Saturday** (`AdminBookingsSection.tsx:141-147`)
  — a booking next Monday must not appear on a Friday.
- **Actual / Notes:**

### 3.3 Check in an online booking

- **Preconditions:** A `Pending` online booking for today.
- **Steps:** Check the customer in from Bookings.
- **Expected:** `bookings.status = 'Checked In'`, with a timeline entry. The customer's My
  Reservations reflects it. If they have a queue row, confirm whether it moves to In Progress —
  **⚠ I did not verify that this page's check-in syncs to the queue**; record what happens.
- **Actual / Notes:**

### 3.4 Staff cancel — refund chosen

- **Preconditions:** A Paid booking **more than 24 h** away. Note `spots_left`.
- **Steps:** Cancel → choose **Refunded** → confirm.
- **Expected:** `status = 'Cancelled'`, `payment_status = 'Refunded'`, timeline entry naming
  Staff, `spots_left` **incremented**. The customer receives an in-app notification **and SMS**
  saying the amount was refunded (`notifyBookingCancellation`, `AppContext.tsx:1934`) — this path
  runs under a staff session, so unlike customer self-cancel the SMS **should** actually send.
  Verify on the customer's phone.
- **Actual / Notes:**

### 3.5 Staff cancel — "Forfeited" chosen

- **Preconditions:** A Paid booking **more than 24 h** away.
- **Steps:** Cancel → choose **Forfeited** → confirm.
- **Expected:** **The booking is still marked `Refunded`** — see Known/Deferred #3. Confirm the
  known behaviour rather than investigating it. Note whether the SMS the customer receives says
  "refunded", since that is the customer-visible consequence.
- **Actual / Notes:**

### 3.6 Staff cancel inside 24 hours

- **Preconditions:** A Paid booking **less than 24 h** away.
- **Steps:** Cancel with no explicit refund choice.
- **Expected:** `cancelBooking` applies its own rule and marks it **non-refundable**, timeline
  reading *"Non-refundable (within 24h cutoff)"* (`AppContext.tsx:1961-1968`). Customer SMS uses
  the non-refunded wording. `spots_left` still incremented.
- **Actual / Notes:**

### 3.7 Cancel an already-cancelled booking (negative)

- **Steps:** Cancel a booking, then attempt to cancel it again.
- **Expected:** No second timeline entry, no second seat release (`spots_left` must not increase
  twice), no second SMS. `cancelBooking` guards on `status !== 'Cancelled'`
  (`AppContext.tsx:1937`). **A double seat release is a real defect** — check the number.
- **Actual / Notes:**

### 3.8 Edit a booking

- **Steps:** Change participants or the assigned staff member on an existing booking.
- **Expected:** Saved and reflected in SQL, with a timeline entry. **⚠ I did not verify whether
  changing participants re-checks session capacity** — if you can raise participants past the
  remaining seats, record it; that would be an overbooking path.
- **Actual / Notes:**

### 3.9 Act on a past-dated booking

- **Steps:** Find a booking whose session has passed and try to cancel or check in.
- **Expected:** Record the behaviour. Note especially whether cancelling a past booking still
  releases a seat for a session that has already run.
- **Actual / Notes:**

---

## 4. Pieces

### 4.1 Create a piece

- **Preconditions:** Pottery Pieces page. A customer with a phone you can receive SMS on.
- **Steps:** Log a piece manually → name, customer, **expected ready date** → save.
- **Expected:**
  - Piece listed with status **Created** and a piece code.
  - Customer receives in-app **and SMS**: *"Your piece "NAME" has been created and is now resting
    before its first burn. We expect it to be ready around DATE."* The date appears only if
    `expected_ready_date` is set (`AppContext.tsx:2500-2513`).
  - It appears on the customer's **My Pieces** page.
- **Actual / Notes:**

### 4.2 → First Burn and Colored

- **Steps:** Advance the piece.
- **Expected:** Status updates; `piece_history` gains a row; customer gets in-app + SMS:
  *"…has been through its first burn and is now being coloured."*
- **Actual / Notes:**

### 4.3 → Ready for Pickup

- **Steps:** Advance again.
- **Expected:** Status updates; customer notified in-app + SMS; **My Pieces shows a ready state**.
  **⚠ Record the exact SMS wording verbatim** — I did not read this branch, so establish the
  baseline on first run.
- **Actual / Notes:**

### 4.4 → Collected

- **Steps:** Mark the piece collected.
- **Expected:** Customer gets: *"Thank you for picking up your piece "NAME"! We hope you loved
  crafting it at Arty Café."* (`AppContext.tsx:2496-2497`). **`Collected` is deliberately not
  customer-visible as a fourth tracker stage** (`types.ts:280-282`) — confirm the customer's
  3-stage tracker does not gain a step.
- **Actual / Notes:**

### 4.5 → Broken

- **Preconditions:** A piece not yet collected. Enter an internal damage note.
- **Steps:** Mark it Broken with the note.
- **Expected:** Customer gets: *"Unfortunately, your pottery piece CODE was damaged and has been
  marked as broken. Please contact Arty Café so our team can assist you with a replacement."*
  (`AppContext.tsx:2514-2516`). **The damage note must not appear** in the SMS, the in-app
  notification, or anywhere on the customer site — customers read pieces through a restricted view
  that cannot return `damage_note`. Verify from the customer browser.
- **Actual / Notes:**

### 4.6 A stage set not to notify

- **Preconditions:** Settings → pipeline stages → set one stage's **notify customer** to off.
- **Steps:** Move a piece into that stage.
- **Expected:** Status changes on screen and in SQL, but **no SMS and no in-app notification**
  (`AppContext.tsx:2519-2522`). Silence is correct here.
- **Actual / Notes:**

### 4.7 A stage hidden from customers

- **Preconditions:** A stage with `visibleToCustomer` off.
- **Steps:** Move a piece into it, then check the customer's My Pieces.
- **Expected:** Staff see the real stage; the customer does **not** see that stage
  (`MyPiecesSection.tsx:51`). Record what the customer sees instead.
- **Actual / Notes:**

### 4.8 Piece with no phone on file (negative)

- **Preconditions:** A piece whose customer has no phone.
- **Steps:** Trigger any notifying transition.
- **Expected:** The status change **still succeeds**; the in-app notification is still written;
  only the SMS is skipped, logged as no phone on file. A failed SMS must never block the
  transition.
- **Actual / Notes:**

### 4.9 Pickup reminder from the Dashboard

- **Preconditions:** A piece **Ready for Pickup**, overdue, whose customer has a phone.
- **Steps:** Dashboard → overdue pickups widget → **Send Reminder**.
- **Expected:** Outcome **sent**; the customer receives an SMS. The RPC
  `send_piece_pickup_reminder` records the send (migration 0016).
- **Actual / Notes:**

### 4.10 Reminder cooldown (negative)

- **Steps:** Immediately press **Send Reminder** again for the same piece.
- **Expected:** Outcome **cooldown** — the UI must present this as *"already reminded today"*,
  **not** as a failure (`AppContext.tsx:3200-3202`, migration 0016:30). **No second SMS is sent.**
  Confirm on the phone that only one message arrived.
- **Actual / Notes:**

### 4.11 Reminder on a piece not awaiting pickup (negative)

- **Steps:** Attempt a reminder for a piece that is Collected or still in an early stage.
- **Expected:** Refused — *"This piece is no longer awaiting pickup."* No SMS.
- **Actual / Notes:**

---

## 5. Workshops and events

### 5.1 Create and publish a workshop

- **Steps:** Workshops → new → title, description, category, price, pricing type, capacity,
  duration, age range, tutor, image, one future session → **Publish**.
- **Expected:** Saved with `status = 'Published'`; a `workshop_sessions` row for the session.
  **It appears on the customer Workshops page** (check the other browser) with its price and
  metadata.
- **Actual / Notes:**

### 5.2 Save as Draft

- **Steps:** Create a second workshop and save it as **Draft**.
- **Expected:** Visible in the console; **absent from the customer site**, including customer
  search. Verify from the customer browser.
- **Actual / Notes:**

### 5.3 Unpublish a workshop that has bookings

- **Preconditions:** A published workshop with ≥1 active booking.
- **Steps:** Change its status to Draft/Archived.
- **Expected:** It disappears from the customer catalogue. **Record what happens to the existing
  booking** — it should remain valid in the customer's My Reservations. **⚠ I did not verify
  whether unpublishing warns about existing bookings**; note whether it does.
- **Actual / Notes:**

### 5.4 Edit a session that already has bookings

- **Preconditions:** A session with ≥1 booking.
- **Steps:** Change its **start time**, then its **date**.
- **Expected:** **⚠ Flagged — I could not establish the intended behaviour.** Record precisely:
  does it warn? Do existing bookings follow the new time? Does the customer's My Reservations show
  the new time, and are they notified? This is the highest-risk edit on this page, because
  `bookings.date`/`time` are stored on the booking *and* on the session — if they can diverge,
  the no-show auto-cancel and the Upcoming/Past split will use different times.
- **Actual / Notes:**

### 5.5 Reduce capacity below seats already taken (negative)

- **Preconditions:** A session with capacity 10 and 6 seats booked.
- **Steps:** Set capacity to 3 and save.
- **Expected:** Record whether it is refused, warned, or silently allowed. If allowed,
  `session_seats_taken` (6) now exceeds capacity (3) — check what the customer site shows
  (fully booked, or negative remaining) and whether further booking is blocked.
- **Actual / Notes:**

### 5.6 Increase capacity

- **Steps:** Raise a full session's capacity by 2.
- **Expected:** The workshop stops showing **FULLY BOOKED** on the customer site and 2 more seats
  become bookable. Verify by actually booking one from the customer browser.
- **Actual / Notes:**

### 5.7 Delete a workshop / event with bookings (negative)

- **Steps:** Attempt to delete an **event** that has bookings.
- **Expected:** Refused — *"Cannot delete event with existing bookings. Please cancel or archive
  it instead."* (`deleteEvent`, `AppContext.tsx:1735-1739`). **⚠ I did not find an equivalent
  guard for workshops** — attempt the same on a workshop with bookings and record what happens.
  If it deletes, the bookings are orphaned; note it.
- **Actual / Notes:**

### 5.8 Create and publish an event

- **Steps:** Events & Socials → create → publish.
- **Expected:** Appears in the events section on the **customer Home page**
  (`HomeSection.tsx:111`). A draft event does not. *(There is no separate customer Events page.)*
- **Actual / Notes:**

### 5.9 Generate monthly sessions from a schedule

- **Preconditions:** A workshop with a recurring schedule.
- **Steps:** Use **Generate Monthly Sessions**, choosing a month/year.
- **Expected:** Sessions created for the chosen month only, on the right weekdays, with no
  duplicates if run twice. Run it **twice** and confirm the second run does not double the
  sessions.
- **Actual / Notes:**

### 5.10 Invalid workshop input (negative)

- **Steps:** Save with an empty title; a negative price; capacity 0; an end time before the start.
- **Expected:** Each is rejected with a field message; nothing is saved. Record any that pass
  through.
- **Actual / Notes:**

---

## 6. Users / Customers

### 6.1 View customers

- **Steps:** Customers → open the list, then a single customer.
- **Expected:** List shows name, phone, email, and their bookings/pieces on the detail view.
  **Back to Customers Directory** returns to the list.
- **Actual / Notes:**

### 6.2 Search customers

- **Steps:** Search by name, phone (in several formats: `05…`, `+966…`, `00966…`), and email.
- **Expected:** All phone formats find the same customer — matching is on the normalized form.
- **Actual / Notes:**

### 6.3 A walk-in record before it is claimed

- **Preconditions:** A `customers` row with `user_id` **null**.
- **Expected:** Visible in the console with their history. **Their bookings are staff-only** until
  claimed — the customer-side RLS policy only exposes rows whose customer has claimed the account
  (`0001_init.sql:653-659`).
- **Actual / Notes:**

### 6.4 The link after the customer claims it

- **Preconditions:** The customer completes the claim (customer plan, test 1.10).
- **Steps:** Re-open that customer in the console.
- **Expected:** **Still exactly one `customers` row**, now with `user_id` set — not a duplicate.
  Their pre-existing bookings and pieces are unchanged and now visible to them. Verify with
  `select id, user_id, email, phone from customers where normalized_phone = '…';`
- **Actual / Notes:**

### 6.5 Staff Registry does not clobber the auth link (negative)

- **Preconditions:** A claimed customer, and a staff account with a `user_id`.
- **Steps:** As Super Admin, edit and save that staff member from Settings → Staff Registry.
- **Expected:** `staff.user_id` is **unchanged** after saving. This was a real defect
  (commit `4ac81d9`); a save that blanks the link would lock that person out of the console.
- **Actual / Notes:**

### 6.6 Create a staff account and provision console access

- **Preconditions:** Super Admin.
- **Steps:** Staff Management → create a staff member → grant console access → set role and pages.
- **Expected:** An auth user is provisioned (the `provision-staff` Edge Function); the new person
  can sign in and sees exactly the granted pages. Confirm by signing in as them.
- **Actual / Notes:**

### 6.7 Duplicate staff email (negative)

- **Steps:** Try to create a second staff account with an existing staff email.
- **Expected:** Refused — a unique index guards this (migration 0012). No partial record left
  behind; check `staff` in SQL.
- **Actual / Notes:**

---

## 7. Dashboard

Each test here is "does the number match the data", so run the SQL alongside.

### 7.1 In Queue count

- **Expected:** Equals queue rows with status `Waiting` **or** `In Progress` **and** today's date
  (`AdminDashboardSection.tsx:196`). Note it excludes `Called` — verify against:
  `select count(*) from queue where date = current_date and status in ('Waiting','In Progress');`
  **A Called guest is deliberately not counted**; confirm that is intended.
- **Actual / Notes:**

### 7.2 Unpaid bookings count

- **Expected:** Equals bookings with `payment_status = 'Unpaid'` and status not Cancelled
  (`:197`). Given all online bookings are Paid, **this should normally be 0** — a non-zero value
  means rows were created outside the app. Cross-check:
  `select count(*) from bookings where payment_status = 'Unpaid' and status <> 'Cancelled';`
- **Actual / Notes:**

### 7.3 Total revenue

- **Expected:** Sum of `total_price` for bookings whose payment status is `Paid` **or**
  `Deposit Paid`, excluding Cancelled (`:198-200`). Verify:
  `select sum(total_price) from bookings where payment_status in ('Paid','Deposit Paid') and status <> 'Cancelled';`
  **Note it is all-time, not a period.** And it counts *deposits* at full booking value — confirm
  that is intended, since a Deposit Paid birthday has not been paid in full.
- **Actual / Notes:**

### 7.4 Today's activity widget

- **Expected:** Lists today's live bookings and queue items, de-duplicated — a booking that also
  has a queue row appears **once** (`activityUtils.ts:131-140` indexes queue by booking id, then
  by phone). Create a booking with a queue row and confirm no double entry.
- **Actual / Notes:**

### 7.5 Tomorrow's bookings

- **Expected:** Only bookings dated tomorrow, excluding Cancelled
  (`AdminDashboardSection.tsx:70-74`), with the participant total matching the sum of their
  `participants`.
- **Actual / Notes:**

### 7.6 Overdue pickups widget

- **Expected:** Pieces Ready for Pickup past their expected date. Each row offers **Send
  Reminder** (tested in 4.9–4.11). Cross-check the count against the pieces list.
- **Actual / Notes:**

### 7.7 Stats update live

- **Steps:** With the Dashboard open, add a walk-in from a second console browser.
- **Expected:** In Queue increments without a manual refresh — the lists are realtime-backed.
  Record the delay if it is not immediate.
- **Actual / Notes:**

---

## 8. Edge cases and negative paths

### 8.1 Two staff cancelling the same booking at once

- **Preconditions:** Two console browsers on the same Pending booking.
- **Steps:** Cancel in both, as close to simultaneously as you can.
- **Expected:** One cancellation takes effect. **`spots_left` must increase by exactly one**, and
  the customer must receive **one** SMS, not two. `cancelBooking` guards on
  `status !== 'Cancelled'` (`AppContext.tsx:1937`), but that is a read-then-write, so a true race
  may slip through — check the seat count and the phone carefully.
- **Actual / Notes:**

### 8.2 Staff cancel racing a customer self-cancel

- **Preconditions:** Console on a booking; the customer signed in on the same booking, >24 h out.
- **Steps:** Trigger both cancellations at the same moment.
- **Expected:** One wins. `cancel_own_booking` (migration 0017) re-checks status inside the
  function, so the customer path cannot double-cancel. Verify: one `Cancelled` status, one
  timeline entry, `spots_left` +1 exactly once.
- **Actual / Notes:**

### 8.3 Booking the last seat from the console while a customer is in checkout

- **Preconditions:** A session with 1 seat left; a customer sitting on the Payment step.
- **Steps:** Consume the seat from the console (walk-in With Instructor on that session), then
  have the customer pay.
- **Expected:** The customer is refused — `book_session_seats` re-checks under a row lock and
  raises *"Only 0 seat(s) left for this session"* (`0002_capacity_rpc.sql:85-101`). Verify no
  overbooking:
  `select sum(participants) from bookings where session_id = '…' and status <> 'Cancelled';`
  must not exceed capacity, **and** remember the walk-in also counts via `session_seats_taken`.
- **Actual / Notes:**

### 8.4 Overbooking attempt from the console (negative)

- **Steps:** Try to add a With Instructor walk-in for more guests than the session has seats.
- **Expected:** Record whether it is refused. **⚠ Unverified** — I did not find a capacity check
  on the walk-in path equivalent to the booking RPC's. If it is allowed, note by how much the
  session goes over; that would be a real overbooking route.
- **Actual / Notes:**

### 8.5 Acting on a past-dated queue row

- **Steps:** Find yesterday's queue row and attempt to complete or cancel it (via SQL-visible
  means, since the UI filters it out).
- **Expected:** See 2.13 — the date is re-stamped to today. Record whether the row then appears
  in today's Live Queue, which would be surprising but is the current behaviour.
- **Actual / Notes:**

### 8.6 Invalid input across admin forms (negative)

- **Steps:** In Bookings, Workshops, Pieces and Staff forms, submit: empty required fields,
  negative numbers, absurd values (capacity 99999, price -1), and a very long string in a text
  field.
- **Expected:** Each rejected with a field-level message and nothing written. **Record every case
  that saves successfully** — those are the findings.
- **Actual / Notes:**

### 8.7 Session expiry mid-action

- **Steps:** Sign in to the console, leave it idle past the token lifetime (or clear the
  `arty-staff-auth` entry in `localStorage`), then attempt a write — cancel a booking, say.
- **Expected:** A clear failure and/or a return to sign-in. **The action must not appear to
  succeed while the write was refused by RLS** — that is precisely the class of bug that made
  customer self-cancel look like it worked. Verify in SQL that nothing changed.
- **Actual / Notes:**

### 8.8 A staff member's access removed mid-session

- **Preconditions:** Admin signed in; Super Admin in another browser.
- **Steps:** Super Admin sets that Admin to `Inactive`. The Admin then attempts a write.
- **Expected:** The write is refused server-side (RLS uses `is_staff()`, which checks the live
  staff record), not merely hidden in the UI. Confirm in SQL that nothing changed.
- **Actual / Notes:**

### 8.9 Realtime consistency between two consoles

- **Steps:** With two consoles on Live Queue, perform seat / call / complete in one.
- **Expected:** The other reflects the change without a manual refresh, and the two never show
  contradictory states for the same row.
- **Actual / Notes:**

---

## Known / Deferred

Already diagnosed. Do **not** raise these — noted so a surprise during testing is recognised
rather than re-investigated.

1. **`workshops.spots_left` drifts for walk-in workshop customers.** A staff-added With
   Instructor walk-in consumes a real session seat (counted by `session_seats_taken`) but never
   decrements `spots_left`. Live "fully booked" checks are correct; the `spots_left` counter — used
   by the customer site's Popularity sort — is not. Expected in 2.3.
2. **Live Queue staff cancel does not release the seat or notify.** It sets the booking to
   `Cancelled` and writes a timeline entry only — no seat release, no refund state, no SMS
   (`AppContext.tsx:2338-2348`). Expected in 2.11.
3. **"Forfeited" on the Bookings page still marks the booking Refunded** for bookings more than
   24 h out, because it passes `undefined` and `cancelBooking` then applies its own rule.
   Expected in 3.5.
4. **Item sales and counter payments are not tracked at all.** No products/orders/payments table
   exists; walk-in item purchases, counter payments and Add Time charges live entirely outside the
   app, pending a client scoping decision. Relevant to 2.1 and 2.9.
5. **Payment is simulated.** The customer checkout marks bookings `Paid` via a `setTimeout` — no
   gateway, no transaction reference. Moyasar is not integrated. Affects revenue figures in 7.3.

---

## Flagged for confirmation

Points where the expected result depends on something I could not establish from the code. Settle
these before or during the run so results are unambiguous.

- **Live permission changes** (1.10) — whether removing a permission takes effect without re-login.
- **Settings is not Super-Admin-only** (1.9) — an Admin *can* be granted it. Confirm the policy.
- **Concurrent queue writes** (2.14, 8.9) — I found no optimistic locking on queue updates.
- **Bookings-page check-in → queue sync** (3.3) — whether checking in from Bookings moves the
  queue row.
- **Editing participants on an existing booking** (3.8) — whether capacity is re-checked.
- **Editing a session that has bookings** (5.4) — the highest-risk unknown; booking date/time and
  session date/time may be able to diverge.
- **Reducing capacity below seats taken** (5.5) — refused, warned, or silently allowed.
- **Deleting a workshop with bookings** (5.7) — events are guarded; workshops may not be.
- **Walk-in overbooking** (8.4) — whether the With Instructor walk-in path checks session capacity.
- **Ready-for-Pickup SMS wording** (4.3) — record verbatim on the first run.
