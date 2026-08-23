// Native push notifications via Firebase Cloud Messaging. Firebase manages
// the actual Web Push/VAPID plumbing for us — the only "key" we ever
// handle client-side is the public VAPID key Firebase generates for you
// (Firebase Console → Project Settings → Cloud Messaging → Web Push
// certificates), never a private one.

import { getToken, deleteToken } from 'firebase/messaging'
import { getMessagingIfSupported } from './firebase'
import { supabase } from './supabase/config'

async function currentToken(messaging, registration) {
  return getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  }).catch(() => null)
}

export async function pushSupported() {
  return !!(await getMessagingIfSupported())
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/firebase-messaging-sw.js')
}

export async function getPushSubscriptionState() {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return { supported: false, permission: 'unsupported', subscribed: false }

  const permission = Notification.permission
  if (permission !== 'granted') return { supported: true, permission, subscribed: false }

  const registration = await navigator.serviceWorker.ready.catch(() => null)
  if (!registration) return { supported: true, permission, subscribed: false }

  const token = await currentToken(messaging, registration)
  return { supported: true, permission, subscribed: !!token }
}

export async function enablePush(user, coupleId) {
  const messaging = await getMessagingIfSupported()
  if (!messaging) throw new Error('Push notifications are not supported in this browser.')

  const registration = await registerServiceWorker()
  if (!registration) throw new Error('Could not set up push in this browser.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications permission was not granted.')
  }

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  if (!token) throw new Error('Could not get a push token from this browser.')

  const { error } = await supabase
    .from('fcm_tokens')
    .upsert({ user_id: user.id, couple_id: coupleId, token }, { onConflict: 'token' })
  if (error) throw new Error(error.message)
}

export async function disablePush() {
  const messaging = await getMessagingIfSupported()
  if (!messaging) return

  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const token = registration ? await currentToken(messaging, registration) : null

  if (token) {
    await supabase.from('fcm_tokens').delete().eq('token', token)
  }
  await deleteToken(messaging).catch(() => {})
}

export async function sendTestPush(user) {
  const res = await fetch('/api/notify-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id }),
  })
  const data = await res.json().catch(() => ({}))
  if (data.error) throw new Error(data.error)
  return data
}
