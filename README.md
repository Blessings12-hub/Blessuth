# Blescy

A private app for long-distance couples: shared canvas, photo memories, quizzes,
mood/music sharing, location distance, and love notes.

Built with Vite + React + Supabase (Postgres, Auth, Storage, Realtime — all on
Supabase's free tier, no credit card required).

## 1. Create a Supabase project (free)

1. Go to https://supabase.com → **Start your project** → sign in → **New project**.
2. Pick any name and a database password (save it somewhere), any region → **Create**.
3. Wait ~1 minute for it to spin up.

## 2. Set up the database

1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Open `supabase.sql` from this project, copy the whole file, paste it in, and click **Run**.
   This creates all the tables, security rules, and a `pair_with_code` function in one go.
3. Then run each `supabase-migration-vN.sql` file in this project, in order (v2, v3, v4,
   v5, v6, v7), the same way — new query, paste, Run. Each one adds a feature that
   shipped after the original `supabase.sql`.
4. Go to **Storage** (left sidebar) → **New bucket** → name it exactly `photos` →
   leave "Public bucket" **unchecked** → Create.
5. For frictionless testing, go to **Authentication → Providers → Email** and turn
   **off** "Confirm email" (so accounts work immediately without a verification click).
   You can turn this back on later once you deploy for real use.

## 3. Add your Supabase config

1. In Supabase, go to **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.
2. Rename `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. You can leave `VITE_VAPID_PUBLIC_KEY` for later —
   it's only needed if you set up push notifications in step 6.

## 4. Push to GitHub

Unzip this, then from the folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

(GitHub's mobile web UI also lets you upload the unzipped files directly if you
prefer not to use git commands.)

## 5. Deploy on Vercel

1. Go to https://vercel.com → **Add New → Project** → import your GitHub repo.
2. Framework preset should auto-detect as **Vite**.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   from your `.env`.
4. Deploy. You'll get a live `.vercel.app` URL.

## 6. Turn on push notifications (optional)

This uses standard Web Push — no third-party notification service, no CLI. It
needs one Supabase table (already in `supabase-migration-v7.sql`), one small
serverless function that already lives in this repo at `api/notify.js`, and
two things to wire up by hand in the dashboards.

**a) Get your Supabase service role key**
In Supabase → **Project Settings → API**, copy the **service_role** key (not
the anon key — this one is secret, never put it in `.env` or anything
prefixed `VITE_`).

**b) VAPID keys**
A key pair was generated for you so you don't need any CLI:

```
VAPID_PUBLIC_KEY=BJ6wm20j0ahtaYYVWE1QqssaVLOqdyxhmxvwdta5Px4fJHrtyik0-M8xD2450tfKbTWJ_nuBH0x_i_AOHhkELzQ
VAPID_PRIVATE_KEY=uZuN7thCw1wp3YOs6haZ-GkAg-M-PPBng-Pjfq4FJIg
```

These are fine to use as-is for a personal two-person app, but since they
passed through this chat, treat the private one as not fully secret — if
you'd rather generate your own privately, any "generate VAPID keys" web tool
works (search for one), or run `npx web-push generate-vapid-keys` if you ever
have CLI access.

**c) Add environment variables in Vercel**
Project → **Settings → Environment Variables** → add these (server-side only,
do **not** prefix with `VITE_`):

```
SUPABASE_SERVICE_ROLE_KEY=<the service_role key from step a>
VAPID_PUBLIC_KEY=<from step b>
VAPID_PRIVATE_KEY=<from step b>
VAPID_SUBJECT=mailto:you@example.com
NOTIFY_WEBHOOK_SECRET=<make up any random string>
```

Also add the **public** VAPID key to your `.env` (and to Vercel, this one
*with* the `VITE_` prefix so the browser can use it):

```
VITE_VAPID_PUBLIC_KEY=<same value as VAPID_PUBLIC_KEY from step b>
```

Redeploy after adding these so they take effect.

**d) Point Supabase at your notify function**
In Supabase → **Database → Webhooks** → **Create a new webhook**:
- Name: `notify-messages`, Table: `messages`, Events: `Insert`
- Type: HTTP Request, Method: `POST`
- URL: `https://your-app.vercel.app/api/notify`
- HTTP Headers: `x-webhook-secret` = the same random string you used for
  `NOTIFY_WEBHOOK_SECRET`

Repeat once more for the `notes` table (same URL and header, Events: Insert).

**e) Turn it on as a user**
Open **Settings** in the app → **Notifications** → toggle it on → allow the
browser permission prompt. On iPhone, push notifications only work for sites
added to the Home Screen (Share → Add to Home Screen), Safari tabs alone
can't receive them — this is an iOS limitation, not something the app can
work around.

## 7. Use it

1. Both partners sign up with email + password.
2. Each of you lands on a **Pair up** screen showing a 6-character code.
3. One of you enters the *other's* code to link your accounts.
4. You're in — explore the tabs at the bottom: Canvas, Photos, Quiz, Map, Mood, Notes.

## Notes on the features

- **Canvas**: real-time — strokes sync between both of you via Supabase Realtime.
- **Photos**: uploads go to Supabase Storage, shown in a shared gallery.
- **Quizzes**: three built-in quiz sets; each answers privately, results reveal once both are in.
- **Location**: uses your phone's GPS (you tap "Share my location"), shows both pins on a
  free OpenStreetMap map and the distance between you. No API key needed.
- **Mood/Music**: a mood status + "currently listening to" text field, shared live.
- **Love Notes**: a lightweight shared message feed.
- **Chat**: a real-time running conversation — online dot, typing indicator, day
  dividers, "Delivered"/"Seen" status, edit/delete on your own messages, "Load
  earlier messages" pagination, and an unread badge on the Chat tab. If you set
  up your database before this update, run `supabase-migration-v6.sql` then
  `supabase-migration-v7.sql` once in the Supabase SQL Editor.
- **Next visit countdown**: tap the card on the home screen to set a date.
- **Pairing**: handled by a Postgres function (`pair_with_code`) so both accounts get
  linked atomically and safely — a plain client update can't touch your partner's row.

## Local development

```bash
npm install
npm run dev
```

## Extending it later

Ideas for v2: Spotify OAuth for real "currently playing" instead
of manual entry, a shared calendar, video call deep-link.
