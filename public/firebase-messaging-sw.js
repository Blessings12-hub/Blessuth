// Required by Firebase Cloud Messaging for background push — this is what
// lets a notification show up even when Blessuth isn't open. It's loaded
// directly by the browser (not bundled by Vite), so it can't read the
// VITE_FIREBASE_* env vars from src/firebase.js — the same public config
// values are just pasted in again below.
//
// Fill these in from Firebase Console → Project Settings → General →
// "Your apps" → Web app → SDK setup and configuration. They're the exact
// same values as the VITE_FIREBASE_* env vars in Vercel/.env — all public,
// safe to have in this static file.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'REPLACE_WITH_VITE_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'REPLACE_WITH_VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REPLACE_WITH_VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REPLACE_WITH_VITE_FIREBASE_APP_ID',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Blessuth'
  const body = payload.notification?.body || ''
  const link = payload.fcmOptions?.link || payload.data?.link || '/'
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { link },
  })
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
