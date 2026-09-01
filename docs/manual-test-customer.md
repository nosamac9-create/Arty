# Customer Site — Manual Test Plan

Scope: the **customer-facing site only**. The staff console is a separate plan.

## Before you start

**Environment**

- Run the site locally (`npx vite`, then `http://localhost:5173/`) or against the deployed customer URL.
- Have the Supabase **SQL Editor** open in another tab — several expected results are database
  facts, not screen facts, and are only checkable there.
- Have a phone that can receive SMS, for the piece-status and cancellation tests.

**Two things must be applied first, or a number of tests below will fail for reasons unrelated
to what they are testing:**

1. Migration `supabase/migrations/0017_cancel_own_booking.sql` must be applied in the SQL
   editor. Without it, self-cancellation (flow 4) calls an RPC that does not exist.
2. The Edge Function must be deployed at its current version
   (`npx supabase functions deploy auto-cancel-bookings`). The previously deployed build still
   contains the removed unpaid-payment rule, which will cancel `Unpaid` test bookings and make
   flow 4 results misleading.

**Test data you will need**

| Needed | How to get it |
|---|---|
| A published workshop with ≥2 future sessions and free seats | Staff console → Workshops |
| A workshop whose only future session has **0** seats left | Book it out, or set `capacity` low |
| A **Draft** (unpublished) workshop | Staff console → save as draft |
| A published **Event** | Staff console → Events |
| A customer with pottery pieces in several statuses | Staff console → Pieces |
| An **unclaimed** walk-in customer record (a `customers` row with `user_id` null) | Insert via SQL, or a staff-created walk-in |

**Reset between runs.** Bookings, queue rows and notifications accumulate. Note the ids you
create so you can delete them afterwards.

**Two structural notes that affect how you test** — read these before flow 6:

- **There is no URL routing.** `App.tsx:90-100` renders sections from a `customerTab` state
  value; every page is the same URL. So "type a URL you shouldn't reach" is not performable.
  Tests 6.6–6.8 substitute the equivalent reachable negative paths.
- **There is no separate Events page.** Published events render as a section on the Home page
  (`HomeSection.tsx:111`). Flow 2 tests them there.

---

## 1. Account

### 1.1 Sign up with a new email

- **Preconditions:** Signed out. An email address not already in `customers` or `auth.users`.
- **Steps:**
  1. Header → **Login** → **Create Account** tab.
  2. Enter name, a real email you can read, phone (`05XXXXXXXX`), password, confirm password.
  3. Submit.
- **Expected:**
  - No error banner; the UI reports the account was created.
  - `auth.users` has a new row for that address.
  - `customers` has a row with `user_id` = that auth id, `source = 'Website Registration'`
    (created by the `resolve_customer_record` RPC, `AppContext.tsx:695`).
  - Phone stored normalized — check `normalized_phone` is digits-only national form.
- **Actual / Notes:**

### 1.2 Email verification

- **Preconditions:** Test 1.1 just completed.
- **Steps:**
  1. Open the inbox for that address, find the Supabase confirmation email, click the link.
  2. Return to the site and sign in.
- **Expected:** The link completes without an error page; sign-in then succeeds.
- **⚠ Flagged — I could not determine this from the code.** Whether email confirmation is
  *required* before sign-in is a Supabase project setting (Auth → Providers → Email → "Confirm
  email"), not something in this repo. **Check that toggle first and record it here**, because it
  changes the expected result of 1.1 and 1.3: with confirmation ON, sign-in before clicking the
  link should fail; with it OFF, sign-up signs you straight in.
- **Actual / Notes:**

### 1.3 Log in — correct credentials

- **Preconditions:** Verified account from 1.1.
- **Steps:** Login tab → email + password → submit.
- **Expected:** Redirected out of the auth screen; header shows **My Account** rather than
  **Login**; My Bookings and My Pieces are reachable and show *your* records only.
- **Actual / Notes:**

### 1.4 Log in — wrong password (negative)

- **Preconditions:** Same account.
- **Steps:** Login with a deliberately wrong password.
- **Expected:** A readable error (not a raw Supabase message — see `friendlyAuthError`,
  `AppContext.tsx:483`). You remain signed out. **The error must not reveal whether the address
  exists.**
- **Actual / Notes:**

### 1.5 Log in — unknown email (negative)

- **Steps:** Login with an address that has no account.
- **Expected:** The **same** generic failure as 1.4. A different message here would leak which
  addresses are registered — treat any difference as a finding.
- **Actual / Notes:**

### 1.6 Log in by phone

- **Preconditions:** Account from 1.1, whose phone you know.
- **Steps:** Enter the **phone number** instead of the email, with the correct password.
- **Expected:** Sign-in succeeds — the login field accepts either (`loginCustomer`,
  `AppContext.tsx:843`). Try a differently-formatted variant of the same number
  (`+966…`, `00966…`, `05…`); all should resolve to the same account.
- **Actual / Notes:**

### 1.7 Log out

- **Steps:** While signed in, use the sign-out control.
- **Expected:** Header returns to **Login**. My Bookings and My Pieces show the signed-out
  prompt ("Sign In to View Your Reservations"), not another customer's data and not an empty
  list presented as though it were yours.
- **Actual / Notes:**

### 1.8 Password reset — happy path

- **Preconditions:** Signed out. Account from 1.1.
- **Steps:**
  1. Login → **Forgot password**.
  2. Enter the address, submit.
  3. Open the email, click the reset link.
  4. Set a new password; sign in with it.
- **Expected:**
  - The confirmation message is deliberately generic: *"If an account exists for that address, a
    reset link is on its way…"* (`AppContext.tsx:1096`).
  - The link opens the reset screen (reached via `type=recovery`, **not** a `#reset-password`
    fragment — a past bug, `AppContext.tsx:1104-1108`; a link that looks "expired" on first click
    is a regression worth recording).
  - Old password no longer works; new one does.
- **Actual / Notes:**

### 1.9 Password reset — unknown address (negative)

- **Steps:** Request a reset for an address with no account.
- **Expected:** The **identical** generic message as 1.8, and no error. Any difference leaks the
  account list.
- **Actual / Notes:**

### 1.10 Claim a walk-in account

- **Preconditions:** A `customers` row with `user_id` **null**, whose phone or email you know
  (a walk-in the studio created). Signed out.
- **Steps:**
  1. Login tab → enter that phone/email and any password → submit.
  2. The site should offer to **claim** the account rather than failing (`AuthSection.tsx:147-153`).
  3. Set a password (and an email, if you claimed by phone), confirm, submit.
- **Expected:**
  - The claim UI appears rather than a dead-end "wrong password".
  - `customers.user_id` is now the new auth id — **the same row**, not a duplicate. Verify with
    `select id, user_id, email, phone from customers where normalized_phone = '…';` and confirm
    exactly one row.
  - **Their history carries over:** existing bookings for that customer appear in My Reservations,
    existing pieces in My Pieces. This is the point of claiming — a new duplicate row is a failure
    even if sign-in works.
- **Actual / Notes:**

### 1.11 Claim with a mismatched email (negative)

- **Preconditions:** Same unclaimed record.
- **Steps:** Attempt the claim supplying an email that does **not** match the record.
- **Expected:** The claim is refused. `claim_customer_account` (migration 0010) verifies the
  caller's own address and returns null on mismatch — and returns null *identically* for "no such
  record" and "already claimed", so the message must not distinguish them.
- **Actual / Notes:**

### 1.12 Claim an already-claimed account (negative)

- **Steps:** Try to claim a record whose `user_id` is already set (e.g. repeat 1.10).
- **Expected:** Refused, with the same non-specific message as 1.11. **The original owner's
  `user_id` must be unchanged** — verify in SQL. This is the account-takeover case fixed in
  migration 0010; treat any change as critical.
- **Actual / Notes:**

---

## 2. Browsing

### 2.1 Workshops list

- **Preconditions:** Signed out (browsing needs no account). ≥3 published workshops.
- **Steps:** Header → **Workshops**.
- **Expected:** Cards show image, category · skill level over the image, title, description,
  duration + age + instructor with sage icons, and price. Card count matches the number of
  **published** workshops. Images cross-fade if a workshop has more than one photo.
- **Actual / Notes:**

### 2.2 A Draft workshop is not listed (negative)

- **Preconditions:** One workshop saved as **Draft**.
- **Steps:** Browse the Workshops page; also search for its title.
- **Expected:** It does not appear, in the grid or in search results
  (`WorkshopsBrowsingSection.tsx`, drafts filtered before display). Confirm the count excludes it.
- **Actual / Notes:**

### 2.3 Search

- **Steps:** Type part of a workshop title, then part of an instructor name, then a nonsense string.
- **Expected:** Matches filter live by title, hook, or instructor. The nonsense string yields the
  empty state ("No workshops match your filters") with a **Reset All Filters** button that
  restores the full list.
- **Actual / Notes:**

### 2.4 Category and skill-level filters

- **Steps:** Select each category chip, then each skill level, then combine the two.
- **Expected:** Only matching workshops remain; the count updates. Combining filters narrows
  rather than replacing. Reset clears both.
- **Actual / Notes:**

### 2.5 Sorting

- **Steps:** Sort by Price low→high, then high→low, then Popularity.
- **Expected:** Price orders are exact inverses. **Popularity sorts by `spotsLeft` ascending**
  (fewest remaining first) — see Known/Deferred #1, which makes this counter unreliable for
  workshops with walk-ins.
- **Actual / Notes:**

### 2.6 A fully-booked workshop

- **Preconditions:** A workshop whose every future session has 0 remaining.
- **Steps:** View it in the grid, then open it.
- **Expected:** A **FULLY BOOKED** pill on the card; the card is dimmed and not clickable through
  to booking. Judged across *all* published future sessions, not one date
  (`isWorkshopFullyBooked`, `queueUtils.ts:403`) — so a workshop with one full date and one open
  date must **not** show as full.
- **Actual / Notes:**

### 2.7 A workshop with no future sessions

- **Preconditions:** A published workshop whose sessions are all in the past.
- **Expected:** It is **not** marked fully booked — there is simply nothing to book, which is a
  different claim (`queueUtils.ts:409-410`). Record what the booking panel offers instead.
- **Actual / Notes:**

### 2.8 Events on the Home page

- **Preconditions:** ≥1 published event, ≥1 draft event.
- **Steps:** Scroll the Home page to the events section.
- **Expected:** Only **Published** events appear (`HomeSection.tsx:111`); the draft does not.
  Dates render in Gregorian English (the app pins this regardless of device locale).
- **Actual / Notes:**

### 2.9 Birthday packages

- **Steps:** Home → **See packages**; then open one package.
- **Expected:** The overview shows up to the published packages side by side; clicking one opens
  its detail with the image and title animating across. **Back to Workshops** returns to the
  normal catalogue.
- **Actual / Notes:**

---

## 3. Booking

### 3.1 Full booking, signed in

- **Preconditions:** Signed in. A workshop with a future session and ≥2 free seats. **Record
  `spots_left` and the session's remaining seats before you start.**
- **Steps:**
  1. Workshops → open the workshop → pick a session slot.
  2. Set participants to 1 → continue to Customer Information.
  3. Confirm the pre-filled name/email/phone → continue to Payment.
  4. Choose a payment method → complete payment.
- **Expected:**
  - Confirmation screen shows a reference code in the form `ART-#####`.
  - `bookings` has a new row: `status = 'Pending'`, `payment_status = 'Paid'`,
    `source = 'Website'`, correct `session_id`, `participants`, `total_price`.
  - `workshops.spots_left` **decremented by 1**, and session remaining seats decremented
    (`book_session_seats`, `0002_capacity_rpc.sql:104-112`).
  - The booking appears under My Reservations → **Upcoming**.
  - **No SMS and no in-app notification** are expected at booking time — the app sends neither
    on creation. If one arrives, note it.
- **Actual / Notes:**

### 3.2 Guest count and price

- **Steps:** On the detail page, set participants to 1, 2, then 3, watching the total.
- **Expected:** For **Per person** pricing, total = price × participants. For **Per pair**,
  total = price × `ceil(participants / 2)` — so 3 guests bill as 2 pairs. For **Fixed price**,
  the total does not change with guest count (`WorkshopDetailSection.tsx:234-242`).
  Test at least one workshop of each type if you have them.
- **Actual / Notes:**

### 3.3 Add-ons / options

- **⚠ Flagged — I could not find a customer-facing add-on selector.** `workshop_options` and
  `event_options` tables exist, but I found no code in `WorkshopDetailSection` that renders or
  applies them to the total. **Check with staff whether add-ons are supposed to be selectable by
  the customer.** If they are, this is a gap, not a test failure; if they are staff-only, delete
  this test.
- **Actual / Notes:**

### 3.4 Participants exceeding remaining seats (negative)

- **Preconditions:** A session with exactly 2 seats left.
- **Steps:** Set participants to 3 and try to continue.
- **Expected:** Blocked before checkout with a message naming how many seats remain
  (`validation.ts:409-410`). No booking row is created; `spots_left` unchanged.
- **Actual / Notes:**

### 3.5 Zero / invalid participants (negative)

- **Steps:** Try 0, a negative number, a decimal, and (if the field allows) empty.
- **Expected:** "Enter at least 1 participant." (`validation.ts:396-398`). No booking created.
- **Actual / Notes:**

### 3.6 Invalid contact details (negative)

- **Steps:** At Customer Information, clear the name; enter `notanemail`; enter a 3-digit phone.
  Attempt to continue after each.
- **Expected:** Each is rejected with a field-level message; you cannot reach Payment. Record
  exactly which fields are validated — **I have not verified the full set**, so treat anything
  that passes through as a finding to note rather than an expected pass.
- **Actual / Notes:**

### 3.7 Booking without signing in

- **Preconditions:** Signed **out**.
- **Steps:** Attempt the full flow as a guest.
- **Expected:** Record whether the flow permits guest booking or forces sign-in. If it completes,
  the booking is created with a `customer_id` — check whether it is null. **A null `customer_id`
  means the customer will never see this booking in My Reservations**, because the RLS policy
  matches on that column (`0001_init.sql:657`). Note which happens.
- **Actual / Notes:**

### 3.8 Abandoning checkout

- **Steps:** Reach the Payment step, then navigate away via the header without paying.
- **Expected:** **No `bookings` row is created** — the row is only written inside
  `completePayment()` (`CheckoutPaymentSection.tsx:102-112`). `spots_left` unchanged. The held
  seat is not held anywhere. Confirm in SQL that nothing was written.
- **Actual / Notes:**

### 3.9 Double-submit (negative)

- **Steps:** On the Payment step, click the confirm button twice rapidly.
- **Expected:** Exactly **one** booking row, one reference code, `spots_left` decremented once.
  (`isProcessing` guards re-entry, `CheckoutPaymentSection.tsx:103`.) Two rows is a real defect —
  record both ids.
- **Actual / Notes:**

---

## 4. My Reservations

### 4.1 Upcoming vs Past split

- **Preconditions:** Signed in with (a) a booking later **today**, (b) one on a future date,
  (c) one whose session time has passed.
- **Steps:** Open My Reservations; check both tabs.
- **Expected:** (a) and (b) under **Upcoming**; (c) under **Past**. The split uses the real
  session **date + time**, so a 9 pm booking is still Upcoming at 8 pm and moves to Past only
  after 9 pm. Booking (a) is the one that matters — it regressed before.
- **Actual / Notes:**

### 4.2 Only your own bookings

- **Preconditions:** Two customer accounts with bookings.
- **Steps:** Sign in as each in turn.
- **Expected:** Each sees only their own. Cross-check against `bookings` in SQL — the RLS policy
  matches `customer_id` to the signed-in user (`0001_init.sql:657`).
- **Actual / Notes:**

### 4.3 Self-cancel **outside** 24 hours (refundable)

- **Preconditions:** Signed in; a Pending booking **more than 24 h** away. Note `spots_left`.
- **Steps:** My Reservations → Upcoming → **Cancel booking** → confirm.
- **Expected:**
  - The confirm dialog says the payment **will be refunded**.
  - `bookings.status = 'Cancelled'`, `payment_status = 'Refunded'`.
  - A timeline entry: `Booking cancelled by Customer — Refund issued (>24h notice)`.
  - `spots_left` **incremented by 1**.
  - Any linked queue row is `Cancelled`.
  - **SMS: expected to FAIL.** See Known/Deferred #6 — `send-sms` requires a staff session, so a
    customer self-cancel gets a 401. The in-app notification is also refused by RLS. Cancellation
    itself must still succeed. Record what the browser console shows.
- **Actual / Notes:**

### 4.4 Self-cancel **inside** 24 hours (non-refundable)

- **Preconditions:** A Pending booking **less than 24 h** away but not yet started.
- **Steps:** Open My Reservations and look at the cancel control.
- **Expected:** The cancel button is replaced by a disabled **Cancellation closed** control with
  a tooltip: *"less than 24 hours before start"*. Clicking it explains to contact the front desk.
  **The customer cannot self-cancel in this window** — so the non-refundable path is not
  reachable from this screen by design. Confirm the tooltip appears based on the **real** session
  time (a 9 pm session should not show as closed at 10 am).
- **Actual / Notes:**

### 4.5 Cancelling someone else's booking (negative, security)

- **Preconditions:** Signed in as customer A; know a booking id belonging to customer B.
- **Steps:** In the browser console, call the RPC directly with B's id:
  `await supabase.rpc('cancel_own_booking', { p_booking_id: 'ART-…' })`
  (or run it in the SQL editor as an authenticated non-owner).
- **Expected:** `success: false`, `code: 'not_owner'`, and a message that does **not** confirm
  the booking exists. B's booking is **unchanged** in SQL. This is the ownership check in
  migration 0017 — treat any change to B's row as critical.
- **Actual / Notes:**

### 4.6 Cancel an already-cancelled booking (negative)

- **Steps:** Cancel a booking, then attempt to cancel it again (re-invoke the RPC).
- **Expected:** `success: false`, `code: 'already_cancelled'`. No second timeline entry, seats not
  released twice, `spots_left` unchanged by the second attempt.
- **Actual / Notes:**

### 4.7 A cancelled booking's presentation

- **Steps:** After 4.3, look at the cancelled booking in the list.
- **Expected:** It stays visible under **Upcoming** (deliberate — so customers can see what
  happened) with a Cancelled badge and no cancel control.
- **Actual / Notes:**

---

## 5. Pieces

### 5.1 Viewing your pieces

- **Preconditions:** Signed in as a customer with ≥2 pieces in different statuses.
- **Steps:** Header → **My Pieces**.
- **Expected:** Each piece shows its name/code and current status. **Only stages marked
  `visibleToCustomer` appear** (`MyPiecesSection.tsx:51`) — a piece in a hidden internal stage
  should not be listed, or should show its last visible stage. Note which.
- **Actual / Notes:**

### 5.2 Only your own pieces

- **Steps:** Sign in as a different customer.
- **Expected:** Their pieces only. Customers read through a restricted view that **cannot return
  `damage_note`** (`0001_init.sql`, section 6) — confirm no internal damage text is ever visible.
- **Actual / Notes:**

### 5.3 Status change → *Created*

- **Preconditions:** Staff mark a piece **Created** for your test phone.
- **Expected:**
  - My Pieces shows **Created**.
  - In-app notification **and SMS**: *"Your piece "NAME" has been created and is now resting
    before its first burn. We expect it to be ready around DATE."* — the date is included only if
    `expected_ready_date` is set, otherwise the sentence ends after "first burn"
    (`AppContext.tsx:2500-2513`).
- **Actual / Notes:**

### 5.4 Status change → *First Burn and Colored*

- **Expected:** *"Your piece "NAME" has been through its first burn and is now being coloured."*
  In-app + SMS.
- **Actual / Notes:**

### 5.5 Status change → *Ready for Pickup*

- **Expected:** My Pieces shows a ready state; in-app + SMS telling them it can be collected.
  **⚠ I did not read the exact Ready-for-Pickup wording** — record it verbatim on first run so
  later runs have a baseline.
- **Actual / Notes:**

### 5.6 Status change → *Broken*

- **Expected:** *"Unfortunately, your pottery piece CODE was damaged and has been marked as
  broken. Please contact Arty Café so our team can assist you with a replacement."*
  (`AppContext.tsx:2514-2516`). **The internal damage note must not appear** in the SMS, the
  notification, or My Pieces.
- **Actual / Notes:**

### 5.7 Status change → *Collected*

- **Expected:** *"Thank you for picking up your piece "NAME"! We hope you loved crafting it at
  Arty Café."* In-app + SMS.
- **Actual / Notes:**

### 5.8 A stage configured **not** to notify (negative)

- **Preconditions:** In the staff console, set a pipeline stage's `notifyCustomer` to false.
- **Steps:** Move a piece into that stage.
- **Expected:** Status updates on screen, but **no SMS and no in-app notification**
  (`AppContext.tsx:2519-2522`). This is the one case where silence is correct.
- **Actual / Notes:**

### 5.9 No phone on file (negative)

- **Preconditions:** A customer/piece with an empty phone.
- **Steps:** Trigger any notifying status change.
- **Expected:** The status change still succeeds and the in-app notification is still written;
  only the SMS is skipped, with a console line saying no phone was on file. **A failed SMS must
  never block the status change.**
- **Actual / Notes:**

---

## 6. Edge cases and negative paths

### 6.1 Booking the last seat

- **Preconditions:** A session with exactly **1** seat left.
- **Steps:** Book it for 1 participant.
- **Expected:** Booking succeeds; session remaining goes to 0; the workshop now shows
  **FULLY BOOKED** if it has no other open session. `spots_left` decremented and not negative
  (clamped by `greatest(0, …)`, `0002_capacity_rpc.sql:110`).
- **Actual / Notes:**

### 6.2 The session fills while you are in checkout (race)

- **Preconditions:** A session with **1** seat left. Two browsers: A signed in as one customer,
  B as another (or a staff console to take the seat).
- **Steps:**
  1. In A, go all the way to the Payment step but **do not** pay.
  2. In B, book that last seat and complete payment.
  3. In A, complete payment.
- **Expected:** A is **refused**. `book_session_seats` re-checks capacity under a row lock and
  raises *"Only 0 seat(s) left for this session"* (`0002_capacity_rpc.sql:85-101`), so the seat
  cannot be sold twice. A sees an error rather than a confirmation; **no second booking row
  exists** for that session beyond capacity. Verify with
  `select sum(participants) from bookings where session_id = '…' and status <> 'Cancelled';`
  — it must not exceed the session capacity. This is the most important test on this page.
- **Actual / Notes:**

### 6.3 Two customers booking the last seat simultaneously

- **Steps:** As 6.2, but have both click confirm at the same moment.
- **Expected:** Exactly one succeeds, one gets the capacity error. Never two.
- **Actual / Notes:**

### 6.4 Session expiry while signed in

- **Preconditions:** Signed in.
- **Steps:** Leave the tab idle well past the token lifetime (or delete the auth entry from
  `localStorage`), then click My Reservations.
- **Expected:** You are treated as signed out — the sign-in prompt, **not** a crash, a blank
  list, or another customer's data. Record which occurs.
- **Actual / Notes:**

### 6.5 Reload mid-checkout

- **Steps:** Reach the Payment step and refresh the browser.
- **Expected:** Because `pendingBooking` is React state and there is no routing, you land back on
  the Home page and the in-progress booking is lost. No partial `bookings` row is left behind —
  confirm in SQL. Record the behaviour; this is the closest thing to a "deep link" failure here.
- **Actual / Notes:**

### 6.6 My Reservations while signed out (access control)

- **Steps:** Sign out, then open My Reservations and My Pieces from the header.
- **Expected:** Both show the sign-in prompt. Neither renders another customer's records, and
  neither shows an empty list styled as though it were yours.
- **Actual / Notes:**

### 6.7 Reading another customer's data directly (access control)

- **Steps:** Signed in as customer A, in the browser console run:
  `await supabase.from('bookings').select('*')` and the same for `pieces` and `notifications`.
- **Expected:** Only A's rows come back — RLS filters server-side, not the UI. **If another
  customer's rows appear, stop and report it**; that is a data-exposure defect regardless of what
  the UI shows.
- **Actual / Notes:**

### 6.8 Staff-only data from a customer session (access control)

- **Steps:** As a signed-in customer, in the console run
  `await supabase.from('staff').select('*')` and `await supabase.from('queue').select('*')`.
- **Expected:** `staff` returns nothing. `queue` returns **only rows linked to your own customer
  id** (`queue_customer_select`, `0001_init.sql:666-669`), not the studio's whole queue.
- **Actual / Notes:**

### 6.9 Offline / network failure

- **Steps:** Open DevTools → Network → Offline. Try to browse, then to book.
- **Expected:** No white screen. Lists render empty rather than showing stale or invented data
  (there are deliberately no seed-data fallbacks). Booking fails with an error rather than a
  false confirmation.
- **Actual / Notes:**

### 6.10 Arabic / RTL

- **Steps:** Switch the language toggle to Arabic and repeat 2.1, 3.1 and 4.1 briefly.
- **Expected:** Layout mirrors; back-arrows point right; **numbers, dates and times stay
  Gregorian and Latin-digit** (the app pins this deliberately). Prices and phone numbers remain
  readable left-to-right.
- **Actual / Notes:**

---

## Known / Deferred

Do **not** raise these — they are already diagnosed. Noted so a surprise during testing is
recognised rather than re-investigated.

1. **`workshops.spots_left` drifts for walk-in workshop customers.** A staff-added walk-in
   consumes a real session seat (counted by `session_seats_taken`) but never decrements
   `spots_left`. Live "fully booked" checks are correct; the `spots_left` counter — which
   Popularity sorting uses — is not.
2. **Live Queue staff cancel does not release the seat or notify.** It sets the booking to
   `Cancelled` and writes a timeline entry only — no seat release, no refund state, no SMS
   (`AppContext.tsx:2338-2348`).
3. **"Forfeited" on the admin Bookings page still marks the booking Refunded** for bookings more
   than 24 h out, because it passes `undefined` and `cancelBooking` then applies its own rule.
4. **Item sales and counter payments are not tracked at all.** No products/orders/payments table
   exists; walk-in item purchases and counter payments live entirely outside the app, pending a
   client scoping decision.
5. **Payment is simulated.** `completePayment()` is a `setTimeout` that marks the booking `Paid`
   — no gateway, no transaction reference, no verification. Moyasar is not integrated.
6. **Customer self-cancel sends no SMS or in-app notification.** `send-sms` requires an active
   staff session (`is_staff()`), which a customer session cannot satisfy, so the call 401s; the
   in-app notification is separately refused by RLS. The cancellation itself succeeds. Expected
   in 4.3.

---

## Flagged for confirmation

Points where the expected result depends on something I could not establish from the code. Settle
these before the run so results are not ambiguous.

- **Email confirmation required?** (test 1.2) — a Supabase Auth project setting, not in this repo.
- **Customer-facing add-ons** (test 3.3) — `workshop_options` exists, but no customer selector was
  found. Staff-only, or a gap?
- **Guest (signed-out) booking** (test 3.7) — whether it is permitted, and whether it produces a
  booking with a null `customer_id` that the customer can then never see.
- **Contact-field validation coverage** (test 3.6) — I did not verify which fields are validated.
- **Ready-for-Pickup message wording** (test 5.5) — record verbatim on the first run.
