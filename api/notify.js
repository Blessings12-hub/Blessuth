// Vercel Serverless Function: /api/notify
//
// Triggered by the notify_webhook() Postgres trigger (see
// supabase-migration-v18.sql) on INSERT into `messages`, `notes`,
// `daily_answers`, `message_reactions`, or `quiz_answers`. Figures out
// who should be notified (the other half of the couple) and sends a real
// push via Firebase Cloud Messaging — see api/_firebase-admin.js for the
// actual sending + required environment variables.
//
// Reuses buildAlert()/senderIdOf() from src/notifications.js — the same
// logic that drives the in-app alert banners — so the message text always
// matches between the two.

import { createClient } from '@supabase/supabase-js'
import { buildAlert, senderIdOf } from '../src/notifications.js'
import { sendPushToUser } from './_firebase-admin.js'

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
  if (!table || !record) {
    res.status(200).json({ skipped: true })
    return
  }

  const senderId = senderIdOf(table, record)
  const coupleId = record.couple_id
  if (!senderId || !coupleId) {
    res.status(200).json({ skipped: true })
    return
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const recipientId = await findRecipientId(coupleId, senderId, supabase)
  if (!recipientId) {
    res.status(200).json({ skipped: true })
    return
  }

  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', senderId)
    .maybeSingle()

  const alert = buildAlert(table, record, senderProfile?.display_name)
  if (!alert) {
    res.status(200).json({ skipped: true })
    return
  }

  try {
    const result = await sendPushToUser(supabase, recipientId, alert)
    res.status(200).json(result)
  } catch (err) {
    // Don't let a push failure look like a broken webhook to Supabase —
    // log it and return 200 either way; the trigger doesn't retry.
    console.error('push send failed:', err.message)
    res.status(200).json({ error: err.message })
  }
}
