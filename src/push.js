import { supabase } from './supabase/config'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

export async function registerServiceWorker() {
  if (!pushSupported()) return null
  return navigator.serviceWorker.register('/sw.js')
}

export async function getPushSubscriptionState() {
  if (!pushSupported()) return { supported: false, permission: 'unsupported', subscribed: false }
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  return {
    supported: true,
    permission: Notification.permission,
    subscribed: !!existing,
  }
}

export async function enablePush(user, couple) {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device/browser.')
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey)
    throw new Error(
      'Push notifications need a one-time setup step first — see "Turn on push notifications" in the README (add VITE_VAPID_PUBLIC_KEY in Vercel, then redeploy).'
    )

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      couple_id: couple.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw error
  return subscription
}

export async function disablePush() {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

// Sends a push straight to this device's own subscription, bypassing the
// database webhook entirely. Lets you tell apart "the webhook isn't firing"
// from "push itself is misconfigured" — the two most common ways this
// silently breaks — without needing to inspect server logs.
export async function sendTestPush() {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device/browser.')
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) throw new Error('Turn notifications on first.')
  const json = subscription.toJSON()
  const res = await fetch('/api/notify-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Test notification failed to send.')
  return true
}
