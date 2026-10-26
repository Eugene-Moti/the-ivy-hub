# Going live: step by step

About 30 minutes. You need: the Neon project **The-ivy-hub**, a free Vercel account (sign in with GitHub), and
this project open in VS Code.

> **Keep secrets out of chat and out of git.** Paste them only into `.env.local` on your computer (git ignores it)
> and into Vercel's Environment Variables screen.

---

## Part A: Collect five values from Neon

Open [console.neon.tech](https://console.neon.tech) → project **The-ivy-hub** (branch **production**).

### A1. Auth URL and JWKS URL

1. Left menu → **Settings** → **Better Auth** (the page in your screenshot).
2. Copy **Auth URL** (copy icon on the right). It looks like
   `https://ep-frosty-queen-….neonauth.c-7.eu-central-1.aws.neon.tech/neondb/auth`
   → this is `VITE_NEON_AUTH_URL`.
3. Copy **JWKS URL** (same page, just below) → this is `NEON_AUTH_JWKS_URL`.

### A2. Turn on the Data API and copy its URL

1. Left menu → **Postgres database** → **Data API**. (If you can't find it, press `Ctrl+K` and type "Data API".)
2. Tick **Use Neon Auth**, leave the rest as it is, then click **Enable Data API**.
3. Copy the **API URL**. It looks like `https://ep-frosty-queen-….apirest.c-7.eu-central-1.aws.neon.tech/neondb/rest/v1`
   → this is `VITE_NEON_DATA_API_URL`.

### A3. Database connection string (secret)

1. Click the green **Connect** button (top left).
2. Choose branch **production**, database **neondb**, role **neondb_owner**.
3. Turn **Connection pooling** on.
4. Click **Show password**, then copy the whole string. It starts with `postgresql://` and contains `-pooler`.
   → this is `DATABASE_URL`. **Treat it like a password.**

### A4. Allow your website address

Still in **Settings → Better Auth → Domains**:

1. Add `https://the-ivy-hub.vercel.app` (or whatever Vercel gives you in Part D; you can come back and add it).
2. Keep **Allow Localhost** on until setup is finished.

---

## Part B: Fill in `.env.local` on your computer

1. In VS Code, right-click `.env.example` → **Copy**, then **Paste** and rename the copy to `.env.local`.
2. Fill in these lines (leave everything else empty for now):

| Line                     | What to put                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| `VITE_NEON_AUTH_URL`     | Auth URL from A1                                                                 |
| `VITE_NEON_DATA_API_URL` | API URL from A2                                                                  |
| `DATABASE_URL`           | Connection string from A3                                                        |
| `NEON_AUTH_JWKS_URL`     | JWKS URL from A1                                                                 |
| `APP_URL`                | `https://the-ivy-hub.vercel.app` (change later if Vercel gives a different name) |
| `CRON_SECRET`            | A random string; see the command below                                           |
| `SEED_TEMP_PASSWORD`     | The admin's first password: 8+ characters with a letter and a number             |
| `SEED_ADMIN_NAME`        | The admin's full name, e.g. `Grace Wanjiru`                                      |
| `SEED_ADMIN_EMAIL`       | The admin's real email; used to sign in and for password resets                  |
| `SEED_ADMIN_USERNAME`    | Optional short sign-in name, e.g. `grace` (defaults to the part before the @)    |
| `SEED_ADMIN_TITLE`       | Optional, e.g. `Marketing Lead`                                                  |

To make a `CRON_SECRET`, open the VS Code terminal (**Terminal → New Terminal**) and run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `CRON_SECRET`.

The receptionist lines (`SEED_RECEPTIONIST_*`) are optional. It's easier to add her from inside the app (Part E).

---

## Part C: Create the database and the first admin

In the VS Code terminal, run these one at a time:

```bash
npm install
npm run env:check      # checks the values above; fix anything marked ✗
npm run db:setup       # creates the tables, permissions and the "How did you hear about us?" list
npm run db:seed-users  # creates the admin account with SEED_TEMP_PASSWORD
```

Then back in Neon:

1. **Postgres database → Data API** → click **Refresh schema cache**.
2. If `db:seed-users` printed "set the admin role manually": go to **Better Auth → Users**, find the admin's email,
   click **⋯ → Make admin**. (This lets the admin create other users in the app.)
3. Run `npm run env:check` again. You should see "Admin also has the Neon Auth admin role".
4. **Settings → Better Auth → Authentication**: turn **off** "Sign-up with Email". Now only the admin can create accounts.

The live database starts **empty of projects and staff**. The sample walk-ins you've seen so far exist only in
demo mode, in your browser. You'll enter the real details in Part E.

---

## Part D: Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → **Import** the GitHub repo `Eugene-Moti/the-ivy-hub`.
2. Vercel detects **Vite**; leave the build settings as they are.
3. Open **Environment Variables** and add these six. Copy each value from your `.env.local`; **don't** add the
   `SEED_*` lines.
   - `VITE_NEON_AUTH_URL`
   - `VITE_NEON_DATA_API_URL`
   - `DATABASE_URL`
   - `NEON_AUTH_JWKS_URL`
   - `APP_URL`
   - `CRON_SECRET`
4. Click **Deploy**. When it finishes, note the address (e.g. `https://the-ivy-hub.vercel.app`).
5. If that address differs from what you used:
   - add it in Neon → **Better Auth → Domains**;
   - update `APP_URL` in Vercel (**Settings → Environment Variables**);
   - redeploy (**Deployments → ⋯ → Redeploy**).

---

## Part E: First sign-in and real data

1. Open the site and sign in with the admin email (or username) and `SEED_TEMP_PASSWORD`.
2. You'll be asked to choose your own password straight away. After that, delete `SEED_TEMP_PASSWORD` from `.env.local`.
3. **Settings → Projects**: add your real projects and their unit types.
4. **Team**: add every sales person and the staff visitors ask for (CEO, Accounts…), with their real phone,
   WhatsApp and email. The WhatsApp/Call buttons and notifications use these.
5. **Settings → Lead sources**: adjust the "How did you hear about us?" list if needed.
6. **Users → New user**: add the receptionist with her name, email, a username (e.g. `mercy`), role
   **Receptionist** and the suggested temporary password. Give her the password privately. She'll be asked to set
   her own at her first sign-in. Add more admins the same way with role **Admin**.

## Later (optional)

- **Automatic WhatsApp and email:** add the `TWILIO_*`, `EMAIL_FROM` and `SENDGRID_API_KEY` variables in Vercel,
  then redeploy. See README → "WhatsApp and email". Until then, use the green **Send on WhatsApp** button after
  each walk-in.
- **Custom domain:**
  1. In Vercel → **Settings → Domains**, add it.
  2. Add it in Neon's **Domains** list.
  3. Update `APP_URL`.
- **Want to try the live system with sample projects and staff first?** Run `npm run db:setup -- --samples`.
  Rename or deactivate those entries later.

## If something goes wrong

- **"Can't reach the server" at sign-in:** check the site address is in Neon → Better Auth → Domains.
- **Signed in but lists are empty or you see a permission error:** click **Refresh schema cache** in Neon → Data API.
- **The admin can't create users:** they need **Make admin** in Neon → Better Auth → Users.
- Run `npm run env:check` again. It points at the problem without printing your secrets.
