# Blessuth

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
3. Then run each `supabase-migration-vN.sql` file in this project, in order (v2 through
   v16), the same way — new query, paste, Run. Each one adds a feature that shipped
   after the original `supabase.sql`. `v9` also creates the `avatars` storage bucket for
   profile photos automatically — no separate dashboard step needed for that one, unlike
   the `photos` bucket below. `v16` turns on notifications (step 6) — quick either way,
   just don't skip it or you won't get in-app alerts.
4. Go to **Storage** (left sidebar) → **New bucket** → name it exactly `photos` →
   leave "Public bucket" **unchecked** → Create.
5. For frictionless testing, go to **Authentication → Providers → Email** and turn
   **off** "Confirm email" (so accounts work immediately without a verification click).
   You can turn this back on later once you deploy for real use.

## 3. Add your Supabase config

1. In Supabase, go to **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.
2. Rename `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.

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

## 6. Notifications (nothing to configure)

Blessuth shows an in-app banner when your partner sends a message, leaves a
note, reacts, answers today's question, or finishes a quiz — powered
directly by Supabase Realtime (a WebSocket connection from the browser to
your database, included free on Supabase's free tier). There's no VAPID
keys, no webhook secret, no service worker, and no serverless function
involved — it just works once you've run the database migrations below.

**The only setup step:** run `supabase-migration-v16.sql` (Supabase →
**SQL Editor** → **New query** → paste the file's contents → **Run**). It
turns on Realtime for the tables the app watches.

If you'd previously started setting up push notifications (VAPID keys, a
Database Webhook, or `supabase-notify-triggers.sql`) in an earlier version
of this project, `v16` also tears all of that down for you — it's safe to
run either way. Afterward you can delete the `VAPID_*`, `SUPABASE_SERVICE_ROLE_KEY`,
and `NOTIFY_WEBHOOK_SECRET` environment variables from Vercel if you'd
added them, and remove any "notify" webhook under Supabase →
**Database → Webhooks** — none of it is used anymore.

**The one tradeoff:** since this isn't real push, alerts only show up while
Blessuth is actually open in a tab or as an installed app — not when the
phone is locked or the app is fully closed. If you outgrow that later, real
push notifications (Web Push/VAPID) are a bigger but doable addition — just
ask.

You can mute the in-app banners from **Settings → Notifications** in the
app if you'd rather not see them at all.

## 7. Use it

1. Both partners sign up with email + password.
2. Each of you lands on a **Pair up** screen showing a 6-character code.
3. One of you enters the *other's* code to link your accounts.
4. You're in — explore the tabs at the bottom: Canvas, Photos, Chat, Quiz, Distance, Mood, Notes.

## Notes on the features

- **Canvas**: real-time — strokes sync between both of you via Supabase Realtime.
- **Photos**: uploads go to Supabase Storage, shown in a shared gallery.
- **Quizzes**: 15 built-in topics, each with two 15-question subtopics (450 questions
  total) — getting to know you, future dreams, long distance life, food, movies,
  communication style, and more. Each of you answers privately (your own honest
  answers, then your guesses at your partner's), results reveal once both are in.
  When you finish a quiz, your partner gets an in-app alert to come take/compare it
  (see "Notifications" above) — run `supabase-migration-v14.sql` if you set up your
  database before this update.
- **Location**: uses your phone's GPS (you tap "Share my location") and shows the live
  distance between you — no map, just the number, updating as you both move. A true
  always-on Home Screen widget (like an iOS WidgetKit widget) isn't something a web app
  can do — that needs a native app. This is the closest equivalent: open the app and the
  distance is right there, live, no page reload needed.
- **Profile photos**: tap your avatar in Settings to upload one — resized and compressed
  in the browser before it uploads, so it stays small either way.
- **Mood/Music**: a mood status shared live, song search with 30-second previews,
  and a shared playlist. Each result also links out to Spotify, Apple Music, and
  YouTube (search-based deep links) so either of you can play the full song in
  whichever app you already use — no login or subscription check needed inside
  Blessuth itself.
- **Love Notes**: a lightweight shared message feed.
- **Chat**: a real-time running conversation — online dot, typing indicator, day
  dividers, "Delivered"/"Seen" status, edit/delete on your own messages, emoji
  reactions on any message, "Load earlier messages" pagination, and an unread
  badge on the Chat tab. If you set up your database before this update, run
  `supabase-migration-v6.sql` through `supabase-migration-v10.sql` in order
  once in the Supabase SQL Editor.
- **On this day**: a card on the dashboard that surfaces a photo or note from
  the same date in a past year, when one exists — quiet otherwise.
- **Next visit / anniversary countdown**: tap either card on the home screen to
  set a date. The anniversary one reuses your "together since" date and shows
  a banner on the day itself.
- **Pairing**: handled by a Postgres function (`pair_with_code`) so both accounts get
  linked atomically and safely — a plain client update can't touch your partner's row.

## Local development

```bash
npm install
npm run dev
```

## Extending it later

Ideas for v3: a shared calendar, a video call deep-link.

Note: `playlist_tracks` still has unused `spotify_uri`/`source` columns from
an earlier Spotify integration that's since been removed in favor of the
external play links described above — they're harmless, no migration needed
to drop them.
