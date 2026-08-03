# Together 💕

A private app for long-distance couples: shared canvas, photo memories, quizzes,
mood/music sharing, location distance, and love notes.

## 1. Create a Firebase project (free)

1. Go to https://console.firebase.google.com → **Add project** → name it anything.
2. In the project, go to **Build → Authentication → Get started** → enable
   **Email/Password** sign-in method.
3. Go to **Build → Firestore Database → Create database** → start in
   **production mode** → pick any region.
4. Go to **Build → Storage → Get started** → same, production mode.
5. Go to **Project settings (gear icon) → General → Your apps → Add app → Web (`</>`)**.
   Register it (no need for Firebase Hosting). Copy the `firebaseConfig` values.

## 2. Add your Firebase config

Rename `.env.example` to `.env` and fill in the values from step 1.5:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 3. Deploy the security rules

In the Firebase console:
- **Firestore Database → Rules** → paste the contents of `firestore.rules` → Publish.
- **Storage → Rules** → paste the contents of `storage.rules` → Publish.

(These lock data down so only you and your paired partner can read/write your couple's data.)

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
3. Under **Environment Variables**, add the same 6 `VITE_FIREBASE_*` values from your `.env`.
4. Deploy. You'll get a live `.vercel.app` URL.

## 6. Use it

1. Both partners sign up with email + password.
2. Each of you lands on a **Pair up** screen showing a 6-character code.
3. One of you enters the *other's* code to link your accounts.
4. You're in — explore the tabs at the bottom: Canvas, Photos, Quiz, Map, Mood, Notes.

## Notes on the features

- **Canvas**: fully real-time — strokes sync instantly between both of you via Firestore.
- **Photos**: uploads go to Firebase Storage, shown in a shared gallery.
- **Quizzes**: three built-in quiz sets; each answers privately, results reveal once both are in.
- **Location**: uses your phone's GPS (you tap "Share my location"), shows both pins on a
  free OpenStreetMap map and the distance between you. No Google Maps API key needed.
- **Mood/Music**: a simple emoji mood + "currently listening to" text field, shared live.
- **Love Notes**: a lightweight shared message feed.
- **Next visit countdown**: tap the card on the home screen to set a date.

## Local development

```bash
npm install
npm run dev
```

## Extending it later

Ideas for v2: push notifications (Firebase Cloud Messaging), Spotify OAuth for real
"currently playing" instead of manual entry, a shared calendar, video call deep-link,
streaks/daily-question prompts.
