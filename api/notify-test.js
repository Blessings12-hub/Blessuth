// Vercel Serverless Function: /api/notify-test
//
// Called from Settings when the person taps "Send test notification" —
// sends a real push to every device they've registered, so they can
// confirm push actually works end-to-end without waiting for their
// partner to do something.

import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from './_firebase-admin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const { userId } = req.body || {}
  if (!userId) {
    res.status(400).json({ error: 'missing userId' })
    return
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  try {
    const result = await sendPushToUser(supabase, userId, {
      title: 'Test notification',
      body: 'If you can see this, push is working! 🎉',
      url: '/',
    })
    if (result.total === 0) {
      res.status(200).json({
        error: 'No saved subscription found — try turning notifications off and back on in Settings.',
      })
      return
    }
    if (result.sent === 0) {
      res.status(200).json({
        error: 'Push was rejected by every registered device — try re-enabling notifications in Settings.',
      })
      return
    }
    res.status(200).json({ ok: true, ...result })
  } catch (err) {
    res.status(200).json({ error: err.message })
  }
}
