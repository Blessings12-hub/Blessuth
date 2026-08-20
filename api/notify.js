// Vercel Serverless Function: /api/notify
//
// Triggered by a Supabase Database Webhook on INSERT into `messages`,
// `notes`, `daily_answers`, or `message_reactions`. Figures out who should
// be notified (the other half of the couple) and sends a push through
// OneSignal's REST API, targeted by that person's external_id (their
// Supabase user id) — no per-device subscription bookkeeping needed on
// our side, OneSignal handles all of that.
//
// Required environment variables (Vercel → Project → Settings →
// Environment Variables, NOT prefixed with VITE_ so they stay server-only):
//   VITE_SUPABASE_URL          (same value already used by the frontend)
//   SUPABASE_SERVICE_ROLE_KEY  (Supabase → Settings → API → service_role key)
//   ONESIGNAL_APP_ID
//   ONESIGNAL_REST_API_KEY
//   NOTIFY_WEBHOOK_SECRET       any random string you choose

import { createClient } from '@supabase/supabase-js'
import QUIZ_TOPICS from '../src/data/quizSets.js'

// `supabase` is only used by the daily_answers/message_reactions cases, to
// look up the sender's display name (those tables don't store it on the
// row itself).
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
  if (table === 'message_reactions') {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', record.user_id)
      .maybeSingle()
    return {
      title: data?.display_name ? `${data.display_name} reacted ${record.emoji}` : `New reaction ${record.emoji}`,
      body: 'Tap to see it in Chat.',
      url: '/#/chat',
      senderId: record.user_id,
      coupleId: record.couple_id,
    }
  }
  if (table === 'quiz_answers') {
    const [topicKey, subtopicKey] = String(record.quiz_key || '').split('.')
    const subtopicTitle = QUIZ_TOPICS?.[topicKey]?.subtopics?.[subtopicKey]?.title || 'a quiz'
    const name = record.user_name || 'Your partner'
    return {
      title: `${name} finished a quiz!`,
      body: `They completed "${subtopicTitle}". Tap to answer and see how you compare.`,
      url: '/#/quizzes',
      senderId: record.user_id,
      coupleId: record.couple_id,
    }
  }
  return null
}

async function findRecipientId(coupleId, senderId, supabase) {
  const { data } = await supabase.from('couples').select('member1, member2').eq('id', coupleId).single()
  if (!data) return null
  return data.member1 === senderId ? data.member2 : data.member1
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
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const notification = record ? await buildNotification(table, record, supabase) : null

  if (!notification || !notification.senderId || !notification.coupleId) {
    res.status(200).json({ skipped: true })
    return
  }

  const recipientId = await findRecipientId(notification.coupleId, notification.senderId, supabase)
  if (!recipientId) {
    res.status(200).json({ skipped: true })
    return
  }

  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
    res.status(500).json({ error: 'ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY are not set in Vercel.' })
    return
  }

  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        target_channel: 'push',
        include_aliases: { external_id: [recipientId] },
        headings: { en: notification.title },
        contents: { en: notification.body },
      }),
    })
    const data = await response.json().catch(() => ({}))
    res.status(200).json({ attempted: true, sent: !!data.id, oneSignalErrors: data.errors })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send notification.' })
  }
}
