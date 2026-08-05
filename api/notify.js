// Vercel Serverless Function: /api/notify
//
// Triggered by a Supabase Database Webhook on INSERT into `messages`,
// `notes`, or `daily_answers`. Looks up the recipient's push subscription(s)
// and sends a Web Push notification. Runs entirely server-side — the
// service role key and VAPID private key never reach the browser.
//
// Required environment variables (set in Vercel → Project → Settings →
// Environment Variables, NOT prefixed with VITE_ so they stay server-only):
//   VITE_SUPABASE_URL          (same value already used by the frontend)
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase → Settings → API → service_role key)
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT               e.g. mailto:you@example.com
//   NOTIFY_WEBHOOK_SECRET       any random string you choose

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// `supabase` is only used by the daily_answers case, to look up the
// sender's display name (that table doesn't store it on the row itself).
async function buildNotification(table, record, supabase) {
  if (table === 'messages') {
    return {
      title: record.sender_name || 'New message',
      body: (record.text || '').slice(0, 140) || 'sent you a message',
      url: '/#/chat',
      senderId: record.sender_id,
      coupleId: record.couple_id,
    }
  }
  if (table === 'notes') {
    return {
      title: record.from_name || 'New note',
      body: (record.text || '').slice(0, 140) || 'sent you a note',
      url: '/#/notes',
      senderId: record.from_uid || record.sender_id,
      coupleId: record.couple_id,
    }
  }
  if (table === 'daily_answers') {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', record.user_id)
      .maybeSingle()
    return {
      title: data?.display_name ? `${data.display_name} answered today's question` : "Today's question was answered",
      body: 'Tap to answer yours and see what they said.',
      url: '/#/',
      senderId: record.user_id,
      coupleId: record.couple_id,
    }
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  if (req.headers['x-webhook-secret'] !== process.env.NOTIFY_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const { table, record } = req.body || {}

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:hello@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const notification = record ? await buildNotification(table, record, supabase) : null

  if (!notification || !notification.senderId || !notification.coupleId) {
    res.status(200).json({ skipped: true })
    return
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('couple_id', notification.coupleId)
    .neq('user_id', notification.senderId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    url: notification.url,
  })

  const results = await Promise.allSettled(
    (subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
        throw err
      }
    })
  )

  res.status(200).json({ attempted: results.length })
}
