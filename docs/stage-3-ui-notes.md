# Stage 3 — UI/UX pass

Three things the move to Postgres (Stage 2) changed about how the interface
should behave. None of them are data bugs; all three are cases where the UI
still assumes the instant, always-available local database it used to have.

Recorded so they are handled deliberately in the UI pass rather than discovered
one screen at a time.

---

## 1. Pre-login empty states

**What changed.** Row Level Security now decides what a reader can see.
`bookings`, `queue`, `pieces`, `customers` and `staff` return **an empty list**
to a signed-out visitor — not an error, just nothing. Before Stage 2 every
table was readable from the browser's own copy, so a component could assume
that empty meant "there is genuinely nothing here".

**Why it matters.** "You have no bookings yet" is the wrong message for someone
who simply isn't signed in, and it is indistinguishable from the real empty
case. It reads as data loss.

**Where to look.**
- `MyBookingsSection.tsx` — already gates on `currentUser`, but the empty state
  below it should still distinguish signed-out from genuinely-empty.
- `MyPiecesSection.tsx` — same.
- The customer-facing pieces tracker: a customer reads through the
  `customer_pieces` view, which returns nothing until their account is claimed.
- Admin console pages behave the same way for a staff member whose session has
  expired: the page renders as empty rather than as signed-out.

**What to do.** Three distinct states everywhere a restricted list is rendered:
*loading*, *signed out / no access*, *genuinely empty*. Never let the second
render as the third.

---

## 2. Failed-write visibility

**What changed.** Writes are network calls now. A Dexie write essentially could
not fail; a Supabase write can fail on RLS, connectivity, or a constraint.

**Why it matters.** The confirmation screen used to be safe to show
optimistically. It is not any more — a customer can be told their booking is
confirmed when nothing was saved. That already happened during Stage 2 testing.

**Done so far.** `addBooking` sets `bookingError`, and
`BookingConfirmationSection` shows a failure screen instead of a confirmation,
stating that nothing was reserved and no payment was taken.

**Still swallowed — each only reaches the console.** In `AppContext.tsx`:

| Line | Write | Consequence when it fails silently |
|---|---|---|
| ~1358 | queue item created with a booking | Walk-in/admin booking never reaches the Live Queue |
| ~1382 | pottery piece created with a booking | Customer's piece never appears in their tracker |
| ~962 | `release_booking_seats` on cancel | Seats stay held after a cancellation |
| ~1036 | queue elapsed-minutes tick | Wait times freeze |

**What to do.** Decide per write whether it is user-visible. Anything the
customer or staff member is *told* happened needs a surfaced failure and a
retry; background housekeeping can stay in the console but should not fail
silently forever.

---

## 3. Latency loading states

**What changed.** Reads used to resolve within a frame. They are now round
trips, and `useLiveTable` deliberately returns `undefined` until the first read
resolves, so a list is briefly absent on every page load.

**Why it matters.** Most pages currently render their empty state during that
window — a flash of "no workshops", "no bookings", "no staff" before the data
lands. It looks broken, and it looks exactly like the failure in item 1.

**What exists.** `rawWorkshops === undefined` is the loading signal, and the
admin workshops table already uses it for a skeleton. Nothing else does.

**What to do.**
- Expose the loading flag for each list from `useApp()` — the same
  `raw* === undefined` pattern — rather than only for workshops.
- Skeletons on the list-heavy pages: Dashboard, Bookings, Live Queue, Pieces,
  Customers, Staff, and the customer workshops grid.
- Mutations need a pending state too: buttons that write should disable and
  show progress, since the result is no longer instant. `StaffPasswordChange`
  is the pattern to copy — including the timeout, so a hung request cannot
  leave a button stuck on "Saving…" forever.

---

## Related, not blocking

- `addBooking` still returns its booking object synchronously while the write
  happens in the background. It works because the failure path is now visible,
  but making it `async` and awaiting the write would be more honest.
- There is no startup check that the migrations have been applied. A missing
  one currently surfaces as a confusing failure at the first booking rather
  than as "migration 0002 has not been run".
