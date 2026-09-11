import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { PlayIcon, PauseIcon } from '../components/Icons'
import PageIntro from '../components/PageIntro'
import { connectSpotify, disconnectSpotify, getValidSpotifyToken, isSpotifyConfigured, isSpotifyConnected } from '../spotifyAuth'
import { createSpotifyPlayer, spotifyPause, spotifyPlayTrack, spotifyResume, spotifySearch } from '../spotifyPlayer'

const MOODS = ['Happy', 'In love', 'Sleepy', 'Sad', 'Frustrated', 'Celebrating', 'Content', 'Not feeling well', 'Anxious', 'Missing you']

const GENRES = [
  'Pop',
  'Hip-Hop',
  'R&B',
  'Afrobeats',
  'K-Pop',
  'Rock',
  'Country',
  'Latin',
  'Reggae',
  'Electronic',
  'Jazz',
  'Classical',
]

async function searchItunes(term) {
  const res = await fetch(`/api/itunes-search?term=${encodeURIComponent(term)}`)
  if (!res.ok) throw new Error('Search failed — try again in a moment.')
  const data = await res.json()
  return (data.results || []).map((r) => ({
    id: String(r.trackId),
    title: r.trackName,
    artist: r.artistName,
    artwork: r.artworkUrl100,
    previewUrl: r.previewUrl,
    genre: r.primaryGenreName,
  }))
}

function formatDuration(ms) {
  if (!ms) return ''
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// No auth, no subscription check, nothing to configure — these just open a
// search for the track in whichever app/service the person already has.
// The trade-off vs. embedded playback: it hands off to another app instead
// of playing inline, but it works for every listener on the first try.
function externalLinks(title, artist) {
  const q = encodeURIComponent(`${title} ${artist}`)
  return {
    spotify: `https://open.spotify.com/search/${q}`,
    apple: `https://music.apple.com/search?term=${q}`,
    youtube: `https://music.youtube.com/search?q=${q}`,
  }
}

export default function Music() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()

  // Search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  // 30s-preview playback
  const audioRef = useRef(null)
  const spotifyRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)
  const [spotifyReady, setSpotifyReady] = useState(false)
  const [spotifyConnected, setSpotifyConnected] = useState(false)
  const [spotifyDeviceId, setSpotifyDeviceId] = useState(null)
  const [spotifyTrackId, setSpotifyTrackId] = useState(null)
  const [providerError, setProviderError] = useState('')
  const [youtubeTrack, setYoutubeTrack] = useState(null)

  // Mood + now playing
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const [mood, setMood] = useState('Happy')
  const [moodSaved, setMoodSaved] = useState(false)

  // Shared playlist
  const [playlist, setPlaylist] = useState([])

  async function loadMoods() {
    if (!couple) return
    const { data } = await supabase.from('moods').select('*').eq('couple_id', couple.id)
    const mineRow = data?.find((r) => r.user_id === user.id) || null
    setMine(mineRow)
    if (mineRow) setMood(mineRow.mood)
    setTheirs(data?.find((r) => r.user_id === partnerUid) || null)
  }

  async function loadPlaylist() {
    if (!couple) return
    const { data } = await supabase
      .from('playlist_tracks')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
    setPlaylist(data || [])
  }

  useEffect(() => {
    setSpotifyConnected(isSpotifyConnected())
    return () => {
      spotifyRef.current?.disconnect()
      spotifyRef.current = null
    }
  }, [])

  async function startSpotify() {
    setProviderError('')
    if (!isSpotifyConfigured()) {
      setProviderError('Spotify playback needs VITE_SPOTIFY_CLIENT_ID configured for this app.')
      return
    }
    if (!spotifyConnected) {
      await connectSpotify()
      return
    }
    if (spotifyRef.current) return
    try {
      spotifyRef.current = await createSpotifyPlayer(getValidSpotifyToken, {
        onReady: (deviceId) => { setSpotifyDeviceId(deviceId); setSpotifyReady(true) },
        onNotReady: () => setSpotifyReady(false),
        onStateChanged: (state) => setSpotifyTrackId(state?.track_window?.current_track?.id || null),
        onError: setProviderError,
      })
    } catch (error) {
      setProviderError(error.message)
    }
  }

  async function playSpotifyTrack(track) {
    setProviderError('')
    if (!spotifyConnected) {
      setProviderError('Connect Spotify first to play full songs inline.')
      return
    }
    if (!spotifyRef.current || !spotifyDeviceId) await startSpotify()
    const token = await getValidSpotifyToken()
    if (!token || !spotifyDeviceId || !track.uri) {
      setProviderError('Spotify player is still starting. Try again in a moment.')
      return
    }
    if (spotifyTrackId === track.id) await spotifyResume(token, spotifyDeviceId)
    else await spotifyPlayTrack(token, spotifyDeviceId, track.uri)
    setSpotifyTrackId(track.id)
  }

  async function playFullSong(track) {
    const token = await getValidSpotifyToken()
    if (!token) {
      setProviderError('Connect Spotify first to play full songs inline.')
      return
    }
    const matches = await spotifySearch(token, `${track.title} ${track.artist}`)
    const match = matches[0]
    if (!match) {
      setProviderError('That song was not found on Spotify. Try YouTube instead.')
      return
    }
    await playSpotifyTrack(match)
  }

  async function runSearch(term) {

    const q = term ?? query
    if (!q.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      setResults(await searchItunes(q))
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
      setHasSearched(true)
    }
  }

  async function pickMood(m) {
    setMood(m)
    await supabase.from('moods').upsert({
      couple_id: couple.id,
      user_id: user.id,
      mood: m,
      label: profile?.display_name || 'Me',
      updated_at: new Date().toISOString(),
    })
    setMoodSaved(true)
    setTimeout(() => setMoodSaved(false), 1500)
  }

  async function setNowPlaying(track) {
    await supabase.from('moods').upsert({
      couple_id: couple.id,
      user_id: user.id,
      mood: mine?.mood || mood,
      now_playing: track,
      label: profile?.display_name || 'Me',
      updated_at: new Date().toISOString(),
    })
  }

  async function addToPlaylist(track) {
    if (playlist.some((item) => item.track_id === track.id)) return
    await supabase.from('playlist_tracks').insert({
      couple_id: couple.id,
      track_id: track.id,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      preview_url: track.previewUrl || null,
      added_by: profile?.display_name || 'Me',
      added_by_uid: user.id,
    })
  }

  async function removeFromPlaylist(id) {
    await supabase.from('playlist_tracks').delete().eq('id', id)
  }

  function playPlaylistTrack(track) {
    togglePlay({ id: track.id, previewUrl: track.preview_url })
  }

  return (
    <div className="screen with-nav">
      <PageIntro eyebrow="Set the tone" title="Mood & Music" description="Search songs, preview them here, and keep a shared soundtrack together." />

      <section className="music-provider-panel" aria-label="Full song playback">
        <div>
          <p className="eyebrow">Full-song playback</p>
          <h2>Choose how to listen</h2>
          <p className="subtitle">Spotify plays inline for Premium listeners. YouTube opens the official search in a new tab.</p>
        </div>
        <div className="music-provider-actions">
          <button type="button" className="primary-btn" onClick={startSpotify}>
            {spotifyConnected ? (spotifyReady ? 'Spotify ready' : 'Start Spotify') : 'Connect Spotify'}
          </button>
          {spotifyConnected && <button type="button" className="secondary-btn" onClick={() => { disconnectSpotify(); spotifyRef.current?.disconnect(); setSpotifyConnected(false); setSpotifyReady(false) }}>Disconnect</button>}
        </div>
      </section>
      {providerError && <p className="error" role="alert">{providerError}</p>}

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      {/* Mood picker */}
      <div className="mood-picker">
        {MOODS.map((m) => (
          <button
            type="button"
            key={m}
            className={'mood-btn' + (m === mood ? ' active' : '')}
            onClick={() => pickMood(m)}
          >
            {m}
          </button>
        ))}
      </div>
      {moodSaved && <p className="mood-saved-hint">Mood updated</p>}

      <div className="mood-cards">
        <div className="mood-card">
          <div className="mood-card-title">You</div>
          <div className="mood-emoji">{mine?.mood || '—'}</div>
          {mine?.now_playing && (
            <div className="now-playing-chip" onClick={() => togglePlay(mine.now_playing)}>
              {mine.now_playing.artwork && <img src={mine.now_playing.artwork} alt="" />}
              <span className="now-playing-label">
                {playingId === mine.now_playing.id ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                {mine.now_playing.title}
              </span>
            </div>
          )}
        </div>
        <div className="mood-card">
          <div className="mood-card-title">{partnerName || 'Partner'}</div>
          <div className="mood-emoji">{theirs?.mood || '—'}</div>
          {theirs?.now_playing && (
            <div className="now-playing-chip" onClick={() => togglePlay(theirs.now_playing)}>
              {theirs.now_playing.artwork && <img src={theirs.now_playing.artwork} alt="" />}
              <span className="now-playing-label">
                {playingId === theirs.now_playing.id ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                {theirs.now_playing.title}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <h3 className="section-title">Find a song</h3>
      <form
        className="music-search-row"
        onSubmit={(e) => {
          e.preventDefault()
          runSearch()
        }}
      >
        <input
          type="text"
          placeholder="Search song or artist…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHasSearched(false)
          }}
        />
        <button type="submit" disabled={searching}>
          {searching ? '…' : 'Search'}
        </button>
      </form>

      <div className="genre-chips">
        {GENRES.map((g) => (
          <button
            key={g}
            className="genre-chip"
            onClick={() => {
              setQuery(g)
              runSearch(g)
            }}
          >
            {g}
          </button>
        ))}
      </div>

      {searchError && <p className="error">{searchError}</p>}

      {!searching && !searchError && hasSearched && results.length === 0 && (
        <p className="empty-state">No songs found for "{query.trim()}" — try a different spelling or artist name.</p>
      )}

      <div className="track-list">
        {results.map((track) => {
          const links = externalLinks(track.title, track.artist)
          return (
            <div key={track.id} className="track-row">
              <button type="button" className="track-play" aria-label={playingId === track.id ? `Pause ${track.title}` : `Play preview of ${track.title}`} onClick={() => togglePlay(track)} disabled={!track.previewUrl}>
                {playingId === track.id ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
              </button>
              {track.artwork && <img src={track.artwork} alt="" className="track-artwork" />}
              <div className="track-info">
                <div className="track-title">{track.title}</div>
                <div className="track-artist">
                  {track.artist}
                  {track.durationMs ? ` · ${formatDuration(track.durationMs)}` : ''}
                </div>
                <div className="track-external-links">
                  Play full song:{' '}
                  <a href={links.spotify} target="_blank" rel="noreferrer">
                    Spotify
                  </a>{' '}
                  <a href={links.apple} target="_blank" rel="noreferrer">
                    Apple Music
                  </a>{' '}
                  <a href={links.youtube} target="_blank" rel="noreferrer">
                    YouTube
                  </a>
                </div>
              </div>
              <div className="track-actions">
                <button className="link-btn small" onClick={() => playFullSong(track)}>
                  Spotify full song
                </button>
                <a className="link-btn small" href={links.youtube} target="_blank" rel="noreferrer">
                  YouTube full song
                </a>
                <button className="link-btn small" onClick={() => setNowPlaying(track)}>
                  Set as playing
                </button>
                <button className="link-btn small" onClick={() => addToPlaylist(track)}>
                  + Playlist
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Shared playlist */}
      <h3 className="section-title">Our playlist</h3>
      <div className="track-list">
        {playlist.map((track) => {
          const links = externalLinks(track.title, track.artist)
          return (
            <div key={track.id} className="track-row">
              <button className="track-play" onClick={() => playPlaylistTrack(track)} disabled={!track.preview_url}>
                {playingId === track.id ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
              </button>
              {track.artwork && <img src={track.artwork} alt="" className="track-artwork" />}
              <div className="track-info">
                <div className="track-title">{track.title}</div>
                <div className="track-artist">
                  {track.artist} · added by {track.added_by}
                </div>
                <div className="track-external-links">
                  Play full song:{' '}
                  <a href={links.spotify} target="_blank" rel="noreferrer">
                    Spotify
                  </a>{' '}
                  <a href={links.apple} target="_blank" rel="noreferrer">
                    Apple Music
                  </a>{' '}
                  <a href={links.youtube} target="_blank" rel="noreferrer">
                    YouTube
                  </a>
                </div>
              </div>
              {track.added_by_uid === user.id && (
                <button className="link-btn small" onClick={() => removeFromPlaylist(track.id)}>
                  remove
                </button>
              )}
            </div>
          )
        })}
        {playlist.length === 0 && <p className="empty-state">No songs yet — search above and add your first one</p>}
      </div>
    </div>
  )
}
