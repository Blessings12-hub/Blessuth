// Notifications, powered by OneSignal instead of raw Web Push/VAPID.
//
// Why the switch: the old approach (web-push + VAPID keys + a Supabase
// Database Webhook calling our own serverless function) had three separate
// places it could silently break, with almost no way to tell them apart
// from a phone. OneSignal folds subscription management, delivery, and
// retries into one service with its own dashboard — including a "Send
// test message" button in the OneSignal dashboard itself that bypasses
// our code entirely, which is the fastest way to confirm push works at
// all before worrying about our own wiring.
//
// The OneSignal SDK script + init call live in index.html (loaded via
// OneSignalDeferred, OneSignal's recommended pattern). Everything here
// just talks to that already-initialized SDK instance.

// Queues a callback to run once the OneSignal SDK (loaded in index.html)
// has finished initializing, and resolves with whatever it returns. Safe
// to call this before or after the SDK script has finished loading.
function withOneSignal(fn) {
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        resolve(await fn(OneSignal))
      } catch (err) {
        reject(err)
      }
    })
  })
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

// OneSignal registers its own service worker (/OneSignalSDKWorker.js)
// itself once initialized — nothing to do here. Kept so main.jsx doesn't
// need to change.
export async function registerServiceWorker() {
  return null
}

export async function getPushSubscriptionState() {
  if (!pushSupported()) return { supported: false, permission: 'unsupported', subscribed: false }
  return withOneSignal((OneSignal) => ({
    supported: true,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
    subscribed: !!OneSignal.User.PushSubscription.optedIn,
  }))
}

// `user` needs a `.id` — we log OneSignal in under the Supabase user id so
// the server can target this exact person later via include_aliases /
// external_id, no separate subscriptions table required.
export async function enablePush(user) {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device/browser.')
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID
  if (!appId)
    throw new Error(
      'Push notifications need a one-time setup step first — see "Turn on notifications" in the README (add VITE_ONESIGNAL_APP_ID in Vercel, then redeploy).'
    )

  return withOneSignal(async (OneSignal) => {
    await OneSignal.login(user.id)
    await OneSignal.Notifications.requestPermission()
    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      throw new Error('Notification permission was not granted.')
    }
    await OneSignal.User.PushSubscription.optIn()
  })
}

export async function disablePush() {
  if (!pushSupported()) return
  return withOneSignal(async (OneSignal) => {
    await OneSignal.User.PushSubscription.optOut()
  })
}

// Sends a test push to this account via OneSignal's REST API (server
// side), targeted by external_id (the Supabase user id). Unlike the old
// device-specific test, this also exercises the same external_id
// targeting real notifications use — closer to the real path, still with
// nothing on the Supabase side involved.
export async function sendTestPush(user) {
  if (!pushSupported()) throw new Error('Push notifications are not supported on this device/browser.')
  const res = await fetch('/api/notify-test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalId: user.id }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Test notification failed to send.')
  return true
}
