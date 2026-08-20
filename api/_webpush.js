// Shared helper used by api/notify.js and api/notify-test.js.
//
// Sends a push to every subscription on file for a given Supabase user id,
// using native Web Push (VAPID) via the `web-push` npm package — no
// third-party notification service involved.
//
// Required environment variables (Vercel → Project → Settings →
// Environment Variables, NOT prefixed with VITE_ so they stay server-only):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT              e.g. "mailto:you@example.com"
// (VITE_VAPID_PUBLIC_KEY, used by the frontend, should be the same value
// as VAPID_PUBLIC_KEY here — see README "Turn on notifications".)

import webpush from 'web-push'

let configured = false
function ensureConfigured() {
  if (configured) return
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    throw new Error(
      'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT are not set in Vercel. See README "Turn on notifications".'
    )
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  configured = true
}

// Sends `payload` (a plain object — sw.js expects { title, body, url }) to
// every push subscription saved for `userId`. Subscriptions that the push
// service reports as gone (410 Gone, or 404 Not Found) are deleted from
// Supabase automatically — that happens naturally over time, e.g. when
// someone clears their browser data.
//
// Returns { sent, total } — `sent` is how many of that user's saved
// subscriptions actually accepted the push.
export async function sendPushToUser(supabase, userId, payload) {
  ensureConfigured()

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) throw error
  if (!subscriptions || subscriptions.length === 0) return { sent: 0, total: 0 }

  const body = JSON.stringify(payload)

  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
        return true
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
        return false
      }
    })
  )

  return { sent: results.filter(Boolean).length, total: subscriptions.length }
}
