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
   v18), the same way — new query, paste, Run. Each one adds a feature that shipped
   after the original `supabase.sql`. `v9` also creates the `avatars` storage bucket for
   profile photos automatically — no separate dashboard step needed for that one, unlike
   the `photos` bucket below. `v16` and `v18` together set up notifications (step 6) —
   don't skip either or notifications won't work.
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

## 6. Notifications

Blessuth has two layers of notifications, and you get both automatically once
you've set this up:

- **In-app banners** — instant, no setup, powered by Supabase Realtime. Shows
  while the app is open. (This is what `v16` set up — if you already ran it,
  nothing more to do for this layer.)
- **Real push** — shows up even when the app is closed or your phone is
  locked, powered by **Firebase Cloud Messaging (FCM)**. This is the layer
  that needs the setup below. FCM is Google's free, unlimited push
  infrastructure — the same transport nearly every push notification service
  (OneSignal included) runs on under the hood, but used directly here with no
  vendor account or dashboard needed beyond Firebase's own free console.

**a) Create a Firebase project (free, no credit card)**

1. Go to https://console.firebase.google.com → **Create a project** (or **Add
   project**) → give it any name → you can skip Google Analytics if asked →
   **Create project**.
2. Once it's ready, click the **web icon (`</>`)** on the project overview
   page to register a web app → give it any nickname → **Register app**. You
   don't need the Firebase Hosting option — skip it.
3. You'll land on a screen showing a `firebaseConfig` object with values like
   `apiKey`, `authDomain`, `projectId`, etc. Keep this tab open — you'll copy
   these in step (c).

**b) Turn on Cloud Messaging and generate the web push key**

1. In the Firebase console, click the **gear icon → Project settings**.
2. Go to the **Cloud Messaging** tab.
3. Scroll to **Web Push certificates** → click **Generate key pair**. This
   produces one key — copy it. (This is the only "key generation" step, and
   it's a single button in a web page — no terminal needed.)

**c) Add environment variables in Vercel**

Go to your project on Vercel → **Settings → Environment Variables** and add
each of these (all safe to expose to the browser — that's normal for
Firebase's public config):

```
VITE_FIREBASE_API_KEY=<apiKey from step a>
VITE_FIREBASE_AUTH_DOMAIN=<authDomain from step a>
VITE_FIREBASE_PROJECT_ID=<projectId from step a>
VITE_FIREBASE_STORAGE_BUCKET=<storageBucket from step a>
VITE_FIREBASE_MESSAGING_SENDER_ID=<messagingSenderId from step a>
VITE_FIREBASE_APP_ID=<appId from step a>
VITE_FIREBASE_VAPID_KEY=<the key pair from step b>
```

Add these two as well — copy them from your local `.env` (they should
already be there from step 3), Vercel just needs its own copy:

```
NOTIFY_WEBHOOK_SECRET=W0yZoiBBbDxdVXp6c19WEnwcmPpgmCBZ
SUPABASE_SERVICE_ROLE_KEY=<from Supabase → Project Settings → API → service_role key>
```

**d) Generate a service account key (this is the private, server-only one)**

1. Firebase console → **gear icon → Project settings → Service accounts**
   tab.
2. Click **Generate new private key** → confirm → it downloads a `.json`
   file.
3. Open that file (any text/notes app works) and copy its *entire contents*.
4. In Vercel, add one more environment variable:

```
FIREBASE_SERVICE_ACCOUNT=<paste the whole JSON file's contents here>
```

This one is **not** prefixed `VITE_` — it must never be exposed to the
browser, only to the serverless function that sends pushes.

**e) Fill in the service worker's Firebase config**

Open `public/firebase-messaging-sw.js` in this project and replace the 6
placeholder values (`REPLACE_WITH_...`) with the exact same values from step
(a) — this file can't read `VITE_` environment variables since the browser
loads it directly, so the values have to be pasted in as plain text here too.
They're the same public values as the `VITE_FIREBASE_*` vars above, so this
is safe.

**f) Run the database migration and redeploy**

1. Run `supabase-migration-v18.sql` in Supabase's SQL Editor (adds the table
   push tokens are stored in, and reconnects the trigger that calls
   `/api/notify` on new messages/notes/reactions/answers/quiz completions).
2. Redeploy on Vercel so the new environment variables take effect — your
   project → **Deployments** → ⋯ on the latest one → **Redeploy**.

**g) Turn it on as a user**

Open **Settings** in the app → **Notifications** → toggle on **"Turn on push
notifications"** → allow the browser's permission prompt. Use **"Send test
notification"** to confirm it actually arrives. On iPhone, push only works
for sites added to the Home Screen (Share → Add to Home Screen) — an open
Safari tab alone can't receive push, which is an iOS limitation, not
something this app can work around.

**Debugging tip:** if a real push isn't arriving even though the test one
worked, check that the trigger is actually firing — in Supabase's SQL
Editor, run `select * from net._http_response order by id desc limit 20;`
right after sending a message, and look for a non-200 response.

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
