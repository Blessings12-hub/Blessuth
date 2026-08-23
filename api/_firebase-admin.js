// Shared Firebase Admin helper for sending push notifications via FCM.
//
// Needs one environment variable in Vercel:
//   FIREBASE_SERVICE_ACCOUNT — the full contents of the service account
//   JSON file downloaded from Firebase Console → Project Settings →
//   Service Accounts → Generate new private key. Paste the whole JSON
//   (as one line or multi-line, both work) into this one env var.
//
// Unlike the old VAPID setup, there's no private key for us to manage
// directly — Firebase's own servers hold that, and we authenticate to
// Firebase using this service account instead.

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

function ensureApp() {
  if (getApps().length) return
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set')
  const serviceAccount = JSON.parse(raw)
  initializeApp({ credential: cert(serviceAccount) })
}

const APP_URL = process.env.APP_URL || 'https://blessuth.vercel.app'

// Sends `payload` ({ title, body, url }) to every device this user has
// registered. Tokens that are no longer valid (uninstalled, permission
// revoked, etc.) are deleted automatically so they stop being tried.
export async function sendPushToUser(supabase, userId, payload) {
  ensureApp()

  const { data: rows } = await supabase.from('fcm_tokens').select('token').eq('user_id', userId)
  const tokens = (rows || []).map((r) => r.token)
  if (tokens.length === 0) return { sent: 0, total: 0 }

  const link = payload.url ? `${APP_URL}/#${payload.url}` : APP_URL
  const messaging = getMessaging()

  let sent = 0
  const staleTokens = []

  for (const token of tokens) {
    try {
      await messaging.send({
        token,
        notification: { title: payload.title, body: payload.body },
        webpush: {
          fcmOptions: { link },
          notification: { icon: '/icon-192.png' },
        },
      })
      sent++
    } catch (err) {
      const code = err?.errorInfo?.code || err?.code || ''
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) {
        staleTokens.push(token)
      }
    }
  }

  if (staleTokens.length > 0) {
    await supabase.from('fcm_tokens').delete().in('token', staleTokens)
  }

  return { sent, total: tokens.length }
}
