// Vercel Serverless Function: /api/notify-test
//
// Sends a single test push straight to the subscription the browser gives
// it — no database webhook involved. Lets Settings' "Send test
// notification" button tell apart the two most common failure modes:
//   - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing or wrong in Vercel
//     → this endpoint itself fails, with a clear error
//   - everything here is fine, but no notification ever arrives from a
//     real message/note/reaction → the Supabase Database Webhook (README
//     step 6d) isn't configured, or NOTIFY_WEBHOOK_SECRET doesn't match
//
// Requires the same VAPID_* env vars as /api/notify.

import webpush from 'web-push'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const { endpoint, p256dh, auth: authKey } = req.body || {}
  if (!endpoint || !p256dh || !authKey) {
    res.status(400).json({ error: 'Missing subscription details.' })
    return
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    res.status(500).json({
      error:
        'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set in Vercel. Add them in Settings → Environment ' +
        'Variables (see README step 6b/6c) and redeploy.',
    })
    return
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth: authKey } },
      JSON.stringify({
        title: 'Test notification',
        body: 'If you can see this, push itself is working correctly.',
        url: '/#/',
      })
    )
    res.status(200).json({ sent: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send test notification.' })
  }
}
