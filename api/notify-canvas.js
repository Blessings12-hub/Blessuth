// Vercel Serverless Function: /api/notify-canvas
//
// Every other push notification in this app fires off a Postgres trigger
// on INSERT (see api/notify.js) — but that pattern doesn't fit Canvas: a
// single drawing gesture inserts one board_strokes row per stroke, so a
// couple mid-drawing could fire dozens of pushes a minute if this used the
// same trigger. Instead, Canvas.jsx debounces client-side — it waits until
// 10 seconds have passed with no new stroke — and only then calls this
// endpoint directly, once, for that drawing session.
//
// Not behind the NOTIFY_WEBHOOK_SECRET used by api/notify.js, since this is
// called from the browser rather than from a Supabase trigger. Anyone
// calling it can only ever notify the *other* member of their own couple
// (see the membership check below) — the same trust boundary as every
// other write this app's users can already make from the client.

import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from './_firebase-admin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const { coupleId, senderId } = req.body || {}
  if (!coupleId || !senderId) {
    res.status(200).json({ skipped: true })
    return
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: couple } = await supabase
    .from('couples')
    .select('member1, member2')
    .eq('id', coupleId)
    .single()
  if (!couple || (couple.member1 !== senderId && couple.member2 !== senderId)) {
    res.status(200).json({ skipped: true })
    return
  }

  const recipientId = couple.member1 === senderId ? couple.member2 : couple.member1

  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', senderId)
    .maybeSingle()
  const name = senderProfile?.display_name || 'Your partner'

  try {
    const result = await sendPushToUser(supabase, recipientId, {
      title: `${name} drew on the canvas`,
      body: 'Tap to see what they drew.',
      url: '/canvas',
    })
    res.status(200).json(result)
  } catch (err) {
    console.error('canvas push send failed:', err.message)
    res.status(200).json({ error: err.message })
  }
}
