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
3. Then run each `supabase-migration-vN.sql` file in this project, in order (v2, v3, v4,
   v5, v6, v7, v8, v9), the same way — new query, paste, Run. Each one adds a feature that
   shipped after the original `supabase.sql`. `v9` also creates the `avatars` storage
   bucket for profile photos automatically — no separate dashboard step needed for that
   one, unlike the `photos` bucket below.
4. Go to **Storage** (left sidebar) → **New bucket** → name it exactly `photos` →
   leave "Public bucket" **unchecked** → Create.
5. For frictionless testing, go to **Authentication → Providers → Email** and turn
   **off** "Confirm email" (so accounts work immediately without a verification click).
   You can turn this back on later once you deploy for real use.

## 3. Add your Supabase config

1. In Supabase, go to **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.
2. Rename `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. You can leave `VITE_ONESIGNAL_APP_ID` for later —
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

This uses [OneSignal](https://onesignal.com) (free tier) instead of raw Web
Push/VAPID — it's a hosted service that handles subscriptions and delivery
for you, and its dashboard has its own "Send test message" button that
proves push works *before* any of our own code is involved, which is a much
easier way to debug from a phone than reading serverless function logs.

**a) Create a OneSignal app**
1. Go to https://onesignal.com → sign up (free) → **New App/Website**.
2. Pick a name, choose **Web Push** as the platform, then **Typical Site**
   as the integration type.
3. Enter your Site Name and Site URL (your `.vercel.app` URL, or your custom
   domain if you have one). Default icon is fine. You can skip the
   "Permission Prompt Setup" customization — the app already handles asking
   for permission when someone toggles notifications on in Settings.
4. Finish the setup wizard.

**b) Get your App ID and REST API Key**
In your OneSignal app → **Settings → Keys & IDs**, copy the **OneSignal App
ID** and the **REST API Key**.

**c) Get your Supabase service role key**
In Supabase → **Project Settings → API**, copy the **service_role** key (not
the anon key — this one is secret, never put it in `.env` or anything
prefixed `VITE_`).

**d) Add environment variables in Vercel**
Project → **Settings → Environment Variables** → add these (server-side
only, do **not** prefix with `VITE_`):

```
SUPABASE_SERVICE_ROLE_KEY=<the service_role key from step c>
ONESIGNAL_REST_API_KEY=<REST API Key from step b>
ONESIGNAL_APP_ID=<App ID from step b>
NOTIFY_WEBHOOK_SECRET=<make up any random string>
```

Also add the App ID to your `.env` (and to Vercel, this one *with* the
`VITE_` prefix so the browser can use it):

```
VITE_ONESIGNAL_APP_ID=<same App ID from step b>
```

Redeploy after adding these so they take effect.

**e) Point Supabase at your notify function**
In Supabase → **Database → Webhooks** → **Create a new webhook**:
- Name: `notify-messages`, Table: `messages`, Events: `Insert`
- Type: HTTP Request, Method: `POST`
- URL: `https://your-app.vercel.app/api/notify`
- HTTP Headers: `x-webhook-secret` = the same random string you used for
  `NOTIFY_WEBHOOK_SECRET`

Repeat once more for the `notes` table (same URL and header, Events: Insert).
Repeat a third time for `daily_answers` (same URL and header, Events: Insert) —
this notifies your partner when you've answered today's question.

Can't find the Webhooks screen? Some Supabase dashboard layouts tuck it away,
or it's occasionally missing depending on your project settings. Use
`supabase-notify-triggers.sql` instead — it does the exact same thing with
plain SQL you paste into the SQL Editor, no hunting through menus required.

**f) Turn it on as a user**
Open **Settings** in the app → **Notifications** → toggle it on → allow the
browser permission prompt. On iPhone, push notifications only work for sites
added to the Home Screen (Share → Add to Home Screen), Safari tabs alone
can't receive them — this is an iOS limitation, not something the app can
work around.

**Debugging tip:** if "Send test notification" in the app fails, first try
sending a test from the **OneSignal dashboard itself** (your app → Audience
→ Subscriptions → find your device → send a test). If that works but the
in-app button doesn't, the problem is in `ONESIGNAL_APP_ID`/
`ONESIGNAL_REST_API_KEY` on Vercel. If even the dashboard test doesn't
arrive, the problem is upstream of this app entirely — check the OneSignal
subscription status and browser notification permission.

Note: the old `push_subscriptions` Supabase table (from
`supabase-migration-v7.sql`) is no longer used — OneSignal tracks
subscriptions itself. It's safe to leave that table in place unused, no
migration needed to remove it.

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
  When you finish a quiz, your partner gets a push notification to come take/compare
  it — run `supabase-migration-v14.sql` if you set up your database before this update.
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
