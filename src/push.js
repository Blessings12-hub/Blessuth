// Notifications, powered by native Web Push (VAPID) — no third-party
// service, no account signup, entirely free forever.
//
// How it fits together:
//   1. You generate one VAPID key pair (a one-time `npx web-push
//      generate-vapid-keys` command — see README "Turn on notifications").
//   2. The browser's built-in PushManager uses the public half of that
//      key pair to create a "subscription" for this browser — basically a
//      unique URL plus two encryption keys. We save that to Supabase.
//   3. Later, api/notify.js sends a push to that URL using the private
//      half of the key pair (via the `web-push` npm package). Only
//      someone holding the private key can send to that subscription,
//      which is what makes Web Push secure without needing an account
//      anywhere.
//   4. public/sw.js (our own service worker, registered below) receives
//      the push in the background and shows the OS notification.

import { supabase } from './supabase/config'

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

// Registers our service worker. Safe to call more than once — the browser
// no-ops if it's already registered and unchanged.
export async function registerServiceWorker() {
  if (!pushSupported()) return null
  return navigator.serviceWorker.register('/sw.js')
}

// PushManager wants the VAPID public key as a Uint8Array, not the
// base64url string it's normally shared as — this converts between them.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export async function getPushSubscriptionState() {
  if (!pushSupported()) return { supported: false, permission: 'unsupported', subscribed: false }
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const subscription = registration ? await registration.pushManager.getSubscription() : null
  return {
    supported: true,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
    subscribed: !!subscription,
  }
}

// Subscribes this browser to push and saves the subscription to Supabase,
// tied to this Supabase user id, so /api/notify can look it up later.
export async function enablePush(user, coupleId) {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device/browser.')

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey)
    throw new Error(
      'Push notifications need a one-time setup step first — see "Turn on notifications" in the README (add VITE_VAPID_PUBLIC_KEY in Vercel, then redeploy).'
    )

  const registration = await navigator.serviceWorker.ready
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }))

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      couple_id: coupleId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw error
}

export async function disablePush() {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const subscription = registration ? await registration.pushManager.getSubscription() : null
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

// Sends a test push to this account's saved subscription(s) via our own
// /api/notify-test endpoint (which holds the private VAPID key — that key
// must never reach the browser).
export async function sendTestPush(user) {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device/browser.')
  const res = await fetch('/api/notify-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Test notification failed to send.')
  return true
}
