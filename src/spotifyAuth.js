// Spotify OAuth using Authorization Code + PKCE. No client secret is
// involved anywhere — PKCE is specifically designed for public clients
// like this one, so the whole flow runs safely in the browser.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = `${window.location.origin}/spotify-callback`
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state',
].join(' ')

const TOKEN_KEY = 'blescy_spotify_tokens'
const VERIFIER_KEY = 'blescy_spotify_verifier'
const STATE_KEY = 'blescy_spotify_state'

function randomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => chars[v % chars.length]).join('')
}

async function sha256Base64Url(input) {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(digest)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function isSpotifyConfigured() {
  return !!CLIENT_ID
}

export function isSpotifyConnected() {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return false
  try {
    return !!JSON.parse(raw).refresh_token
  } catch {
    return false
  }
}

export async function connectSpotify() {
  if (!CLIENT_ID) throw new Error('Spotify is not configured yet (missing VITE_SPOTIFY_CLIENT_ID).')
  const verifier = randomString(64)
  const state = randomString(16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)
  const challenge = await sha256Base64Url(verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
}

export function disconnectSpotify() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isSpotifyCallbackUrl() {
  return window.location.pathname === '/spotify-callback'
}

// Runs once at app boot (see main.jsx) if the URL is the OAuth redirect.
export async function handleSpotifyCallback() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const savedState = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)

  if (!code || !state || state !== savedState || !verifier) {
    return { ok: false, error: 'Spotify sign-in could not be verified — please try connecting again.' }
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  })

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return { ok: false, error: 'Spotify sign-in failed — please try again.' }
  const json = await res.json()
  storeTokens(json)
  return { ok: true }
}

function storeTokens(json) {
  const existing = readTokens() || {}
  const tokens = {
    access_token: json.access_token,
    refresh_token: json.refresh_token || existing.refresh_token,
    expires_at: Date.now() + (json.expires_in || 3600) * 1000 - 30000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
  return tokens
}

function readTokens() {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Returns a currently-valid access token, refreshing first if needed.
export async function getValidSpotifyToken() {
  const tokens = readTokens()
  if (!tokens || !tokens.refresh_token) return null
  if (tokens.access_token && Date.now() < tokens.expires_at) return tokens.access_token

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: CLIENT_ID,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    disconnectSpotify()
    return null
  }
  const json = await res.json()
  const updated = storeTokens(json)
  return updated.access_token
}
