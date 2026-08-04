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
3. Go to **Storage** (left sidebar) → **New bucket** → name it exactly `photos` →
   leave "Public bucket" **unchecked** → Create.
4. For frictionless testing, go to **Authentication → Providers → Email** and turn
   **off** "Confirm email" (so accounts work immediately without a verification click).
   You can turn this back on later once you deploy for real use.

## 3. Add your Supabase config

1. In Supabase, go to **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.
2. Rename `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

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

## 6. Use it

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
- **Mood/Music**: a simple emoji mood + "currently listening to" text field, shared live.
- **Love Notes**: a lightweight shared message feed.
- **Next visit countdown**: tap the card on the home screen to set a date.
- **Pairing**: handled by a Postgres function (`pair_with_code`) so both accounts get
  linked atomically and safely — a plain client update can't touch your partner's row.

## Local development

```bash
npm install
npm run dev
```

## Extending it later

Ideas for v2: push notifications, Spotify OAuth for real "currently playing" instead
of manual entry, a shared calendar, video call deep-link, streaks/daily-question prompts.
