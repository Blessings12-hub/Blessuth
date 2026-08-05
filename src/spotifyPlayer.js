// Thin wrapper around Spotify's Web Playback SDK + the bits of the Web API
// we need (search, play, pause). One player instance lives for the life of
// the Music page.

let sdkLoadPromise = null

function loadSdkScript() {
  if (sdkLoadPromise) return sdkLoadPromise
  sdkLoadPromise = new Promise((resolve, reject) => {
    if (window.Spotify) {
      resolve()
      return
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    script.onerror = () => reject(new Error('Could not load the Spotify player.'))
    document.head.appendChild(script)
  })
  return sdkLoadPromise
}

// getTokenFn: async () => accessToken
// callbacks: { onReady(deviceId), onNotReady(deviceId), onStateChanged(state), onError(message) }
export async function createSpotifyPlayer(getTokenFn, callbacks = {}) {
  await loadSdkScript()

  const player = new window.Spotify.Player({
    name: 'Blescy',
    getOAuthToken: (cb) => {
      getTokenFn().then((token) => cb(token))
    },
    volume: 0.9,
  })

  player.addListener('ready', ({ device_id }) => callbacks.onReady && callbacks.onReady(device_id))
  player.addListener('not_ready', ({ device_id }) => callbacks.onNotReady && callbacks.onNotReady(device_id))
  player.addListener('player_state_changed', (state) => callbacks.onStateChanged && callbacks.onStateChanged(state))
  ;['initialization_error', 'authentication_error', 'account_error', 'playback_error'].forEach((event) => {
    player.addListener(event, ({ message }) => callbacks.onError && callbacks.onError(message))
  })

  await player.connect()
  return player
}

async function spotifyFetch(token, path, options = {}) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error?.message || `Spotify request failed (${res.status})`)
  }
  return res.status === 200 ? res.json() : null
}

export async function spotifySearch(token, term) {
  const params = new URLSearchParams({ q: term, type: 'track', limit: '15' })
  const data = await spotifyFetch(token, `/search?${params.toString()}`)
  return (data?.tracks?.items || []).map((t) => ({
    id: t.id,
    uri: t.uri,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    artwork: t.album.images?.[1]?.url || t.album.images?.[0]?.url,
    durationMs: t.duration_ms,
  }))
}

export async function spotifyPlayTrack(token, deviceId, uri) {
  await spotifyFetch(token, `/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({ uris: [uri] }),
  })
}

export async function spotifyPause(token, deviceId) {
  await spotifyFetch(token, `/me/player/pause?device_id=${deviceId}`, { method: 'PUT' })
}

export async function spotifyResume(token, deviceId) {
  await spotifyFetch(token, `/me/player/play?device_id=${deviceId}`, { method: 'PUT' })
}
