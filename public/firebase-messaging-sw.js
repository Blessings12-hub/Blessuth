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
  apiKey: "AIzaSyCovZwLVNvqvsEou4-gsNAraVtTT8BHSrU",
  authDomain: "blessuth.firebaseapp.com",
  projectId: "blessuth",
  storageBucket: "blessuth.firebasestorage.app",
  messagingSenderId: "56653414958",
  appId: "1:56653414958:web:e6f34c507a0f75b35f15bf",
  measurementId: "G-RC9MWNPEMY"
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
