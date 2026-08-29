// Vercel Serverless Function: /api/check-bible-reminders
//
// Triggered on a schedule by Vercel Cron (see vercel.json) — checks for any
// reminder that's become due and sends a real push to both partners in
// that couple. One-time reminders are deleted after firing; daily/weekly
// ones get rescheduled to their next occurrence.
//
// Needs one environment variable in Vercel:
//   CRON_SECRET — any random string you choose. Vercel automatically sends
//   it as `Authorization: Bearer <value>` on cron-triggered requests once
//   this env var is set, which is what the check below verifies — this
//   stops anyone else from being able to trigger this endpoint and spam
//   push notifications.

import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from './_firebase-admin.js'

const DAY_MS = 24 * 60 * 60 * 1000

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const now = new Date()

  const { data: due } = await supabase.from('bible_reminders').select('*').lte('remind_at', now.toISOString())

  let fired = 0
  for (const reminder of due || []) {
    // Guard against double-firing if a run overlaps or retries — skip
    // anything already fired in roughly the last cron interval.
    if (reminder.last_fired_at && now - new Date(reminder.last_fired_at) < 50 * 60 * 1000) continue

    const { data: couple } = await supabase
      .from('couples')
      .select('member1, member2')
      .eq('id', reminder.couple_id)
      .single()
    if (!couple) continue

    const payload = { title: '🙏 Bible study reminder', body: reminder.title, url: '/bible' }
    await sendPushToUser(supabase, couple.member1, payload).catch(() => {})
    await sendPushToUser(supabase, couple.member2, payload).catch(() => {})
    fired++

    if (reminder.recurrence === 'daily' || reminder.recurrence === 'weekly') {
      const step = reminder.recurrence === 'daily' ? DAY_MS : 7 * DAY_MS
      await supabase
        .from('bible_reminders')
        .update({
          last_fired_at: now.toISOString(),
          remind_at: new Date(new Date(reminder.remind_at).getTime() + step).toISOString(),
        })
        .eq('id', reminder.id)
    } else {
      // One-time reminder — done, so it's removed rather than left sitting
      // in the past.
      await supabase.from('bible_reminders').delete().eq('id', reminder.id)
    }
  }

  res.status(200).json({ fired })
}
