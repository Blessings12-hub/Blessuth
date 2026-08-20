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
   v15), the same way — new query, paste, Run. Each one adds a feature that shipped
   after the original `supabase.sql`. `v9` also creates the `avatars` storage bucket for
   profile photos automatically — no separate dashboard step needed for that one, unlike
   the `photos` bucket below. `v15` is only needed if you're setting up push
   notifications (step 6) — safe to skip for now and come back to it later.
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

This uses native **Web Push** with your own **VAPID keys** — a standard built
into every modern browser. There's no company or dashboard involved: you
generate one pair of keys (think of it like a lock and the one key that
opens it), the app uses the public half to "lock" each device's
subscription, and your own server uses the private half to send to it.
Nothing to sign up for, nothing that can expire or hit a usage limit.

**a) Generate your VAPID key pair**

You need Node.js installed on your computer for this one-time step (if you
already ran `npm install` in step "Local development" below, you have it).
In the project folder, run:

```bash
npx web-push generate-vapid-keys
```

This prints two long strings of random-looking characters, labeled
**Public Key** and **Private Key**. Copy both somewhere safe — you'll paste
them in the next step. (The Private Key is a secret, like a password —
never share it or put it in a file that gets committed to GitHub.)

**b) Get your Supabase service role key**

In Supabase → **Project Settings → API**, copy the **service_role** key
(not the anon key — this one is secret too, never put it in `.env` or
anything prefixed `VITE_`).

**c) Add environment variables in Vercel**

Go to your project on Vercel → **Settings → Environment Variables**.
Add each of these one at a time (click **Add New** for each): type the
name on the left, paste the value on the right, and save.

Server-side only (do **not** prefix these with `VITE_` — that prefix is
what would expose a value to the browser, and the private key must never
be exposed):

```
SUPABASE_SERVICE_ROLE_KEY=<the service_role key from step b>
VAPID_PUBLIC_KEY=<the Public Key from step a>
VAPID_PRIVATE_KEY=<the Private Key from step a>
VAPID_SUBJECT=mailto:you@example.com
NOTIFY_WEBHOOK_SECRET=<make up any random string, e.g. mash your keyboard>
```

(`VAPID_SUBJECT` just needs to be a `mailto:` link with any email address —
it's a contact detail push services can use to reach you if your server is
ever sending broken requests. Doesn't need to be a real inbox you check.)

Also add the **public** key a second time, this one *with* the `VITE_`
prefix so the browser is allowed to read it (the public key is safe to
expose — that's the whole point of it being "public"):

```
VITE_VAPID_PUBLIC_KEY=<same Public Key from step a>
```

While you're there, also add `VITE_VAPID_PUBLIC_KEY` (same value) to your
local `.env` file if you want push notifications to work while running the
app on your own computer too.

**Redeploy after adding these** so they take effect — Vercel → your
project → **Deployments** → ⋯ on the latest one → **Redeploy**.

**d) Run the database migration**

In Supabase → **SQL Editor** → **New query**, paste in the contents of
`supabase-migration-v15.sql` and click **Run**. (This reuses a table that
was already created back in `v7`, so if you've run every migration in
order up to `v14`, this step is quick — it just adds one missing
permission.)

**e) Point Supabase at your notify function**

In Supabase → **Database → Webhooks** → **Create a new webhook**:
- Name: `notify-messages`, Table: `messages`, Events: `Insert`
- Type: HTTP Request, Method: `POST`
- URL: `https://your-app.vercel.app/api/notify`
- HTTP Headers: `x-webhook-secret` = the same random string you used for
  `NOTIFY_WEBHOOK_SECRET`

Repeat once more for the `notes` table (same URL and header, Events: Insert).
Repeat again for `daily_answers` and `message_reactions` (same URL and
header, Events: Insert), and once more for `quiz_answers` if you want a
push when your partner finishes a quiz.

Can't find the Webhooks screen? Some Supabase dashboard layouts tuck it away,
or it's occasionally missing depending on your project settings. Use
`supabase-notify-triggers.sql` instead (plus `supabase-migration-v11.sql`
and `supabase-migration-v14.sql`, which add the reaction and quiz
triggers) — same effect, plain SQL pasted into the SQL Editor, no hunting
through menus required.

**f) Turn it on as a user**

Open **Settings** in the app → **Notifications** → toggle it on → allow the
browser permission prompt. On iPhone, push notifications only work for sites
added to the Home Screen (Share → Add to Home Screen), Safari tabs alone
can't receive them — this is an iOS limitation, not something the app can
work around.

**Debugging tip:** if "Send test notification" in the app fails, the error
message it shows is usually specific enough to point at what's missing
(e.g. "no saved subscription found" means the toggle in Settings didn't
actually save one — try turning it off and back on). For anything less
clear, check **Vercel → your project → Deployments → (latest) → Functions**
and look at the logs for `/api/notify-test` — any problem with the VAPID
keys or Supabase connection will show up there as a plain error message.

Note: unlike OneSignal, this approach stores one row per browser/device in
the `push_subscriptions` table — that's expected, not a bug. If you use the
app on both your phone and your laptop, each gets its own row and both can
receive pushes.

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
