# Ivy Hub

Walk-in visitor tracking for **The Ivy Group**. Reception records every walk-in; marketing sees which channels bring
people in and which sales person they came to see.

React + Vite + TypeScript · Tailwind CSS · Motion · Three.js · Recharts · Supabase (Postgres, Auth, RLS, Edge Functions)

---

## 1. Try it now (demo mode)

```bash
npm install
npm run dev          # http://localhost:5173
```

With no Supabase keys configured, the app runs in **demo mode**: about 11 weeks of sample data, kept in your browser.
Tap a demo account on the login card:

| Role                   | Username    | Password        |
| ---------------------- | ----------- | --------------- |
| Admin (Marketing Lead) | `admin`     | `IvyAdmin#2026` |
| Receptionist           | `reception` | `IvyDesk#2026`  |

Settings → General has **Hold to reset demo data**. Settings → Notifications lets you simulate notifications
being sent, failing or waiting for setup.

## 2. Go live with Supabase

1. **Create a project** at [supabase.com](https://supabase.com) (region: closest to Nairobi, e.g. `eu-west`).
2. **Create the database.** In the SQL editor, run `supabase/migrations/20261026000000_ivy_hub.sql`, then
   `supabase/seed.sql`. (Or with the CLI: `supabase init`, `supabase link`, `supabase db push`.)
3. **Lock down sign-ups.** Authentication → Providers → Email: turn **off** “Allow new users to sign up”.
   Only admins create accounts.
4. **URLs.** Authentication → URL configuration: set the Site URL to your app's address and add
   `https://<your-app>/reset-password` to the redirect URLs.
5. **Create the first admin and the receptionist** (on your own machine; never commit the service key):

   ```bash
   export SUPABASE_URL=https://<ref>.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=<service-role key>
   npm run create-user -- --name "Grace Wanjiru" --email grace@theivygroup.co.ke --username grace --role admin --password "ChangeMe#2026"
   npm run create-user -- --name "Mercy Achieng" --email reception@theivygroup.co.ke --username reception --role receptionist --password "ChangeMe#2026"
   ```

6. **Front-end keys.** Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (Project settings → API). Demo mode switches off automatically.
7. **Edge functions and notification secrets.**

   ```bash
   cp supabase/functions/.env.example supabase/functions/.env   # fill in keys (git-ignored)
   supabase secrets set --env-file supabase/functions/.env
   supabase functions deploy notify-walk-in
   supabase functions deploy admin-users
   ```

8. **Host it** on Vercel or Netlify (`vercel.json` and `public/_redirects` are included). Build command `npm run build`,
   output `dist`, plus the two `VITE_` variables.
9. _Optional:_ `supabase/optional/notification-retry-cron.sql` retries leftover notifications every 5 minutes.

## 3. Changing passwords

| Who                           | How                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| An admin, for any user        | Settings → Users → **Reset password** → hold to confirm. Share the new password privately.                          |
| An admin who forgot their own | Login → **Forgot password?** → email link → `/reset-password`.                                                      |
| A receptionist                | Ask an admin (Settings → Users).                                                                                    |
| Locked out of every admin     | Supabase dashboard → Authentication → Users → the user → **Send password recovery** (or `create-user` a new admin). |

Every reset is recorded in the activity log. Passwords need 8+ characters with a letter and a number.

## 4. Roles and permissions

Enforced in the database with row-level security, not just hidden in the UI.

| Action                                         | Receptionist                           | Admin |
| ---------------------------------------------- | -------------------------------------- | ----- |
| Record walk-ins, view and search records       | ✓                                      | ✓     |
| Edit a record                                  | Own records, within 24h (configurable) | Any   |
| Add a sales person from the walk-in form       | ✓                                      | ✓     |
| Delete a record (soft delete, reason required) | –                                      | ✓     |
| Export CSV / Excel                             | Off by default (Settings toggle)       | ✓     |
| Dashboard, settings, users, sales persons      | –                                      | ✓     |
| Activity log (read-only for everyone)          | –                                      | ✓     |

Nothing is ever hard-deleted: walk-ins are soft-deleted, while sales persons, users, projects, unit types and sources
are deactivated or archived, so history keeps its labels.

## 5. Security

- **Lockout:** 5 failed sign-ins lock an account for 15 minutes (tracked in the database). Also enable Supabase's
  Auth rate limits, since the lockout guards the app's sign-in path rather than the raw Auth API.
- **Idle sign-out** after 30 minutes without input, shared across tabs. “Remember me” off keeps the session for that tab only.
- **Audit trail:** database triggers write the activity log, so it cannot be skipped. Its rows cannot be updated or deleted, even with the service key.
- **Data protection:** consent is required for every walk-in (Kenya Data Protection Act 2019).
- **Secrets:** provider keys and the service-role key live only in edge-function secrets.

Timings live in `src/lib/config.ts`; the edit window, office hours and export permission are in Settings.

## 6. Sales-person notifications

When a walk-in is saved with source **Sales Person**, the database queues an email and a WhatsApp, and the
`notify-walk-in` function sends them. Failed sends are retried up to 3 times. You can see the status in the walk-in drawer and resend from there.

- **Email:** [Resend](https://resend.com) (default) or SendGrid. Verify your sending domain, then set `EMAIL_FROM`.
- **WhatsApp:** the Meta WhatsApp Business Cloud API (default) or Twilio. Meta only delivers business-initiated messages
  through an **approved template**. Create one with five body variables (sales person's first name, client name,
  time, project – unit type, client phone) and set `WHATSAPP_TEMPLATE_NAME`.
- **Before keys are configured**, walk-ins still save and notifications show **Pending setup**. Settings →
  Notifications shows which providers are configured.

## 7. Offline mode and installing

- **Install:** open the app in Chrome or Edge on the reception computer or tablet and choose **Install Ivy Hub**
  (address-bar icon or browser menu).
- **Offline saving:** if the internet drops, walk-ins (and sales persons added from the form) are saved to a local
  queue in IndexedDB.
- **Status pill:** the top bar shows `Offline – N walk-ins waiting to sync`.
- **Syncing:** when the connection returns, the queue syncs automatically in the original order, keeping each original
  visit time. You can also press **Sync now**. Each record carries a client-generated ID, so a retry can never
  create a duplicate. Sales persons sync before the walk-ins that reference them, and notifications go out after
  the sync.
- **Lists:** dropdown lists are cached for offline use.

## 8. Components

| Component             | Where it's used                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `IvyLogo`             | Login card (draw-on → gold fill → light sweep), sidebar and slips (static, hover glow)                                             |
| `LogoTraceLoader`     | App boot, sign-in in progress (resolves into the logo), first load of Dashboard/Records/Activity, route loading, offline-sync pill |
| `HoldToConfirmButton` | Delete walk-in, deactivate user or sales person, reset password, delete project / unit type / source, reset demo data              |
| `ReceiptPrinter`      | Walk-in saved: “Saving walk-in…” → “Printing slip…” → “Walk-in recorded” (or “Saved offline. Will sync”)                           |
| `DynamicButton`       | Save walk-in, Export, Resend notification, Add sales person, Sync now, settings saves                                              |
| `Ticket`              | Visitor pass after saving, summary card in the walk-in drawer, printable pass                                                      |

The logo is 11 separate centre-line strokes (`src/lib/logo.ts`). `public/ivy-logo.svg`, the favicon and PWA icons
are generated from the same data: `python scripts/build-logo-assets.py`.

## 9. Scripts

```bash
npm run dev            # dev server
npm run build          # type-check + production build
npm run format         # Prettier (+ Tailwind class sorting)
npm run create-user    # create a user with the service-role key (see above)
```

## 10. Project layout

```
src/
  auth/        session, lockout, idle sign-out
  components/  logo, loaders, receipt printer, ticket, UI kit, walk-in + records pieces
  data/        Api interface · demo/ (in-browser) · supabase/ (live) · reference-data cache
  offline/     IndexedDB outbox + sync provider
  pages/       Login, Walk-in, Records, Dashboard, Sales persons, Settings, Activity log
supabase/
  migrations/  schema, RLS, triggers, RPCs
  functions/   notify-walk-in, admin-users
  seed.sql     sample projects, unit types, sources, sales persons
public/        sw.js, manifest, icons, textures, logo
```
