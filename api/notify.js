// Vercel Serverless Function: /api/notify
//
// Triggered by the notify_webhook() Postgres trigger (see
// supabase-migration-v18.sql and v23.sql) on activity across messages,
// notes, daily_answers, message_reactions, quiz_answers, wishlist_items,
// and now every game table too. Figures out who should be notified and
// sends a real push via Firebase Cloud Messaging — see
// api/_firebase-admin.js for the actual sending + required env vars.
//
// Most tables use the same "sender caused an event, notify their partner"
// pattern via buildAlert()/senderIdOf() from src/notifications.js. Tic-Tac-
// Toe and Connect Four don't fit that pattern — the recipient is whoever
// `turn` currently points to, not "whoever didn't cause the event" (a
// fresh game can hand the very first turn to either player) — so those two
// are handled as a special case below instead.

import { createClient } from '@supabase/supabase-js'
import { buildAlert, senderIdOf } from '../src/notifications.js'
import { sendPushToUser } from './_firebase-admin.js'

const TURN_TABLES = ['tictactoe_games', 'connect4_games']

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

  const { table, record, type } = req.body || {}
  if (!table || !record) {
    res.status(200).json({ skipped: true })
    return
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  let recipientId = null
  let senderName = null

  if (TURN_TABLES.includes(table)) {
    if (record.winner) {
      // Game just ended — no one needs to move next, nothing to notify.
      res.status(200).json({ skipped: true })
      return
    }
    if (type === 'INSERT' && record.created_by === record.turn) {
      // The creator won the coin flip to go first — that's their own
      // action, not something their partner needs to be told about.
      res.status(200).json({ skipped: true })
      return
    }
    recipientId = record.turn
    // No sender name needed — buildAlert's board-game messages are
    // deliberately generic ("It's your turn!") rather than name-based.
  } else {
    const senderId = senderIdOf(table, record)
    const coupleId = record.couple_id
    if (!senderId || !coupleId) {
      res.status(200).json({ skipped: true })
      return
    }
    recipientId = await findRecipientId(coupleId, senderId, supabase)
    if (recipientId) {
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', senderId)
        .maybeSingle()
      senderName = senderProfile?.display_name
    }
  }

  if (!recipientId) {
    res.status(200).json({ skipped: true })
    return
  }

  const alert = buildAlert(table, record, senderName)
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
