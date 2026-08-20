// Vercel Serverless Function: /api/notify-test
//
// Sends a single test push to every subscription saved for the requesting
// account, using native Web Push (VAPID) — see api/_webpush.js. Always
// returns real JSON with a specific reason on failure, unlike a raw
// web-push crash that could come back as a blank/HTML error page.

import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from './_webpush.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const { userId } = req.body || {}
  if (!userId) {
    res.status(400).json({ error: 'Missing userId.' })
    return
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const result = await sendPushToUser(supabase, userId, {
      title: 'Test notification',
      body: 'If you can see this, push itself is working correctly.',
      url: '/',
    })

    if (result.total === 0) {
      res.status(500).json({
        error:
          'No saved subscription found for this account. Make sure notifications are turned on in ' +
          'Settings and the browser permission prompt was allowed, then try again.',
      })
      return
    }

    if (result.sent === 0) {
      res.status(500).json({
        error:
          'Found a saved subscription but the push service rejected it (it may be stale). Try turning ' +
          'notifications off and back on in Settings.',
      })
      return
    }

    res.status(200).json({ sent: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send test notification.' })
  }
}
