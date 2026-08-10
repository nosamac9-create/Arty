# Arty Café

React + Vite + TypeScript studio management app: a public customer site and a
staff console, sharing one data layer.

## Running locally

```bash
npm install
npm run dev
```

## Supabase migration status

| Stage | Scope | State |
|---|---|---|
| 1a | Postgres schema, RLS, security-definer functions, config seed | `supabase/migrations/0001_init.sql` — apply manually |
| 1b | Supabase client + authentication | done |
| 2 | Move application data off Dexie | not started |

Until Stage 2, **application data still lives in Dexie (IndexedDB)** — workshops,
bookings, queue, pieces and the rest. Only *authentication* runs through
Supabase.

### Environment

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL="https://xxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="..."
```

Both are safe in the browser. **The `service_role` key must never appear in
`.env`, in any `VITE_` variable, or anywhere in frontend code** — it bypasses
Row Level Security.

## First Super Admin

There is no default console account, and no credentials in the source. The
previous hardcoded bootstrap login was removed in Stage 1b: it had been
committed to a public repository and is permanently compromised. If that
password was reused anywhere else, change it there too.

Create the first Super Admin once per environment:

1. Apply `supabase/migrations/0001_init.sql` in the Supabase SQL editor.
2. Get the `service_role` key from Project Settings → API. Keep it in your
   shell only.
3. Run:

```bash
SUPABASE_URL="https://xxxx.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service role key>" \
SUPER_ADMIN_EMAIL="you@artycafe.sa" \
SUPER_ADMIN_PASSWORD='<a strong one-off password>' \
SUPER_ADMIN_NAME="Studio Manager" \
npm run create-super-admin
```

This creates the Supabase Auth user **and** the linked `staff` row with
`role = 'Super Admin'`, `has_console_access = true` and
`password_is_temporary = true`. It is idempotent — re-running reuses the
existing auth user.

4. Open the site, click **Staff Login** in the footer, and sign in. Because the
   account is flagged temporary, the console requires a new password before it
   opens. Do not reuse the one-off password.

Everyone else is added from the console: Settings → Staff Registry. Only a
Super Admin can grant console access or change a role.

### Doing it from the dashboard instead

If you would rather not run the script:

1. Authentication → Users → **Add user**, with "Auto Confirm User" ticked.
2. Copy the new user's UUID.
3. SQL editor:

```sql
insert into public.staff (
  id, user_id, name, email, position, status,
  role, permissions, has_console_access, password_is_temporary
) values (
  'staff-super-admin', '<the UUID>', 'Studio Manager', 'you@artycafe.sa',
  'Studio Manager', 'Active', 'Super Admin', '{}', true, true
);
```

## Authentication model

- **Credentials belong to Supabase Auth.** No password is stored in app tables;
  there is no password column on `customers` or `staff`.
- **Roles are never trusted from the client.** The session yields an auth id;
  the `staff` row is looked up from it and `role` / `permissions` are read from
  that row on every load, so revoking access takes effect immediately.
- **Customer records exist without accounts.** Walk-ins, admin-created and
  booking-derived customers have no auth user. They *claim* their record later,
  which attaches an auth id to the existing row rather than creating a second
  customer.

### Ownership verification (open item)

Claiming a record attaches an account to a customer found by phone or email.
Today the proof of ownership is the Supabase email confirmation link. Phone
sign-in is **not** enabled: a claim must never complete on knowledge of a phone
number alone. The `TODO(stage-2)` markers in `AppContext.tsx`
(`linkAuthToCustomer` and `claimCustomerAccount`) are where
`supabase.auth.verifyOtp()` goes when the phone channel is turned on.
