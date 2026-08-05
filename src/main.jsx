import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { registerServiceWorker } from './push.js'
import { isSpotifyCallbackUrl, handleSpotifyCallback } from './spotifyAuth.js'

// The Spotify OAuth redirect lands on a plain path (not a hash route, since
// redirect_uri can't contain a fragment) — handle it here, before the
// HashRouter-based app even mounts, then hand off to the real app.
if (isSpotifyCallbackUrl()) {
  document.getElementById('root').innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'font-family:Inter,sans-serif;color:#232946;background:#eeeef5;">Connecting Spotify…</div>'
  handleSpotifyCallback().finally(() => {
    window.location.replace('/#/music')
  })
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )

  registerServiceWorker().catch(() => {
    // Push just won't be available on this browser — the rest of the app
    // works fine without it.
  })
}
