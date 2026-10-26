# Ivy Hub

Visitor tracking for **The Ivy Group**. Reception records everyone who walks in. Clients feed the marketing reports.
Staff visitors, deliveries and interviews are logged too, and the person they came to see is told they've arrived.

React + Vite + TypeScript · Tailwind CSS · Motion · Three.js · Recharts ·
**Neon** (Postgres, Managed Better Auth, Data API with row-level security) · **Vercel** (hosting + `/api` functions) ·
**Twilio** (WhatsApp, and email through Twilio SendGrid)

---

## 1. Try it now (demo mode)

```bash
npm install
npm run dev          # http://localhost:5173
```

With no Neon settings, the app runs in **demo mode** on about 11 weeks of sample data kept in your browser. On the
login card, tap **Marketing Lead** (admin) or **Receptionist**.

## 2. Go live

**Follow [docs/GO-LIVE.md](docs/GO-LIVE.md)**, a click-by-click guide. In short:

1. **Collect five values from Neon:** Auth URL, JWKS URL, Data API URL, connection string, and your site address.
2. **Put them in `.env.local`** with the first admin's name, email and temporary password.
3. **Run the setup commands:**
   ```bash
   npm install
   npm run env:check      # checks your values and connections (never prints secrets)
   npm run db:setup       # tables, permissions, audit trail + the "How did you hear about us?" list
   npm run db:seed-users  # the first admin (and the receptionist, if SEED_RECEPTIONIST_* is filled in)
   ```
4. **Deploy on Vercel** with six environment variables:
   - `VITE_NEON_AUTH_URL`
   - `VITE_NEON_DATA_API_URL`
   - `DATABASE_URL`
   - `NEON_AUTH_JWKS_URL`
   - `APP_URL`
   - `CRON_SECRET`
5. **Sign in as the admin** and set your own password. Then add the real projects (**Settings**), staff (**Team**) and the receptionist (**Users → New user**).

**Keys and passwords never go into the code or chat.** They live only in `.env.local` (git-ignored) and in Vercel.

## 3. WhatsApp and email (Twilio)

| Channel  | Provider                                | Notes                                                                                |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| WhatsApp | **Twilio** (default) or Meta            | Sandbox for testing; approved sender + templates for production                      |
| Email    | **Twilio SendGrid** (default) or Resend | SendGrid is Twilio's email product, with its own API key (Twilio Console → SendGrid) |

**Testing with the Twilio sandbox (free trial):**

1. Twilio Console → **Messaging → Try it out → Send a WhatsApp message**. Each sales person or host sends
   `join <your-code>` to `+1 415 523 8886` from their own WhatsApp, once.
2. Set `TWILIO_WHATSAPP_FROM=+14155238886`.

Trial accounts only reach numbers that joined the sandbox or were verified, and messages carry a "Sent from
your Twilio trial account" prefix.

**Production:** register a WhatsApp sender in Twilio. WhatsApp only delivers business-initiated messages through
pre-approved templates, so create two in **Content Template Builder** and put their SIDs (`HX…`) in the two
`TWILIO_WHATSAPP_*_CONTENT_SID` variables. Both templates get the same five variables:

| Variable | Client arrival         | Visitor arrival        |
| -------- | ---------------------- | ---------------------- |
| `{{1}}`  | Recipient's first name | Recipient's first name |
| `{{2}}`  | Visitor's name         | Visitor's name         |
| `{{3}}`  | Time                   | Time                   |
| `{{4}}`  | Project – unit type    | Organisation / purpose |
| `{{5}}`  | Visitor's phone        | Visitor's phone        |

**Email:** verify a sender (or your domain) in SendGrid, then set `EMAIL_FROM`.

**Until keys are set**, walk-ins still save and notifications show **Pending setup**. Failed sends retry up to 3
times; they can also be resent from the record drawer. A daily cron job retries anything left behind (Vercel Hobby
allows daily; on Pro you can change `vercel.json` to every few minutes).

## 4. Visitors who aren't clients

The form starts with **Reason for the visit**:

| Reason                    | Form asks for                                    | Who is notified  | Counts in marketing reports |
| ------------------------- | ------------------------------------------------ | ---------------- | --------------------------- |
| Client – property enquiry | Project, unit type, how they heard, sales person | The sales person | ✓                           |
| Meeting / visiting staff  | Here to see, organisation, purpose               | The host         | – ("Other visitors" card)   |
| Delivery / courier        | Here to see, organisation, purpose               | The host         | –                           |
| Job interview             | Here to see, purpose                             | The host         | –                           |
| Other visit               | Here to see, purpose (required)                  | The host         | –                           |

- **Here to see** lists everyone on the **Team** page: sales persons and other staff, e.g. the CEO or Accounts.
- If the person isn't listed, choose **Someone not on the list** and type their name. That visit is logged, but nobody is notified.
- The busiest-hours heatmap counts every visitor, since it measures how busy reception is.

## 5. Changing passwords

| Who                        | How                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Anyone signed in           | Top bar → key icon → **Change password**                                               |
| An admin, for another user | **Users** → **Reset password** → hold to confirm. They must change it at next sign-in. |
| An admin who forgot theirs | Login → **Forgot password?** → email link (sent by Neon Auth) → `/reset-password`      |
| A receptionist             | Ask an admin                                                                           |
| Locked out of every admin  | Neon Console → Better Auth → Users → set a password / **Make admin**                   |

New accounts and admin resets always start with a temporary password, and the app forces a change before anything
else. Passwords need 8+ characters with a letter and a number. Every change is in the activity log.

## 6. Roles and permissions

Enforced by Postgres row-level security through the Neon Data API, not just hidden in the UI.

| Action                                         | Receptionist                           | Admin |
| ---------------------------------------------- | -------------------------------------- | ----- |
| Record walk-ins and visitors, view and search  | ✓                                      | ✓     |
| Edit a record                                  | Own records, within 24h (configurable) | Any   |
| Add a sales person from the walk-in form       | ✓                                      | ✓     |
| Delete a record (soft delete, reason required) | –                                      | ✓     |
| Export CSV / Excel                             | Off by default (Settings toggle)       | ✓     |
| Dashboard, settings, users, team               | –                                      | ✓     |
| Activity log (read-only for everyone)          | –                                      | ✓     |

## 7. Security

- **Lockout:** 5 failed sign-ins lock an account for 15 minutes, tracked in the database by `/api/login-guard`.
- **Idle sign-out** after 30 minutes. With "Remember me" off, the session ends when the browser closes.
- **Profiles gate everything:** a Neon Auth account without an active Ivy Hub profile can't read or write anything.
- **Audit trail:** written by database triggers, append-only even for the database owner.
- **Server-only secrets:** `DATABASE_URL`, Twilio and SendGrid keys live only in Vercel/`.env.local` and are used
  only by `/api` functions. Those functions verify the caller's Neon Auth token before doing anything.
- **Consent** is required for every visitor (Kenya Data Protection Act 2019).
- **Browser note:** Neon Auth keeps the session in a secure cross-site cookie. Chrome and Edge are fine. Safari
  (or strict "block third-party cookies" settings) may need the site allowed.

## 8. Offline mode and installing

- **Install:** open the site in Chrome or Edge and choose **Install Ivy Hub**.
- **Saving offline:** if the internet drops, visitors are saved to a local queue. The top bar shows
  `Offline – N walk-ins waiting to sync`.
- **Syncing:** the queue syncs automatically, in order, when the connection returns, keeping each original visit
  time. Each record has its own ID, so retries never duplicate it. Notifications go out after the sync.

## 9. Scripts

```bash
npm run dev                    # app + local /api functions (reads .env.local)
npm run build                  # type-check (app, api, config) + production build
npm run format                 # Prettier
npm run env:check              # check .env.local values and connections
npm run db:setup [-- --samples] # create/upgrade the database (+ optional sample projects/team)
npm run db:test                # permission checks in an in-memory Postgres
npm run db:seed-users          # first admin (temporary password from SEED_TEMP_PASSWORD)
```

## 10. Project layout

```
src/
  auth/        session, idle sign-out, forced password change
  components/  logo, loaders, receipt printer, ticket, UI kit, walk-in + records pieces
  data/        Api interface · demo/ (in-browser) · neon/ (live) · reference-data cache
  offline/     IndexedDB outbox + sync
  pages/       Login, Walk-in, Records, Dashboard, Team, Settings, Activity log, password pages
api/           Vercel functions: login-guard, notify, cron/notify-sweep (+ _lib)
db/            migrations/001_ivy_hub.sql (schema, RLS, triggers) · seed.sql (default lists) · sample-data.sql (optional)
scripts/       db-migrate.mjs · seed-users.mjs · check-env.mjs · db-test.mjs · build-logo-assets.py
docs/          GO-LIVE.md (step-by-step deployment)
public/        sw.js, manifest, icons, textures, logo
```
