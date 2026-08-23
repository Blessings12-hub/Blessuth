// Handles incoming push events directly via the standard Push API, rather
// than through Firebase's compat SDK's built-in handler.
//
// Why: Safari/iOS requires a push notification to be displayed
// *immediately and synchronously* inside the push event's waitUntil(), or
// iOS treats it as "invisible" — the push silently never shows, and after
// a few of these iOS can even revoke notification permission for the site
// entirely. Firebase's own background-message handling has a documented,
// still-open reliability issue here (firebase/firebase-js-sdk#8010), so
// this file skips it and calls showNotification() directly ourselves.
//
// No Firebase library is needed in this file at all — once a push
// subscription exists (created client-side via the Firebase JS SDK's
// getToken(), see src/push.js), the browser delivers pushes as plain Push
// API events regardless of what library created the subscription.

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.notification?.title || payload.data?.title || 'Blessuth'
  const body = payload.notification?.body || payload.data?.body || ''
  const link = payload.fcmOptions?.link || payload.data?.link || '/'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { link },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.navigate(link)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(link)
    })
  )
})
