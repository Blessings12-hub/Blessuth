import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { PlayIcon, PauseIcon } from '../components/Icons'

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

async function searchTracks(term) {
  const res = await fetch(
    `https://itunes.apple.com/search?media=music&entity=song&limit=15&term=${encodeURIComponent(term)}`
  )
  if (!res.ok) throw new Error('Search failed — try again in a moment.')
  const data = await res.json()
  return data.results.map((r) => ({
    id: String(r.trackId),
    title: r.trackName,
    artist: r.artistName,
    artwork: r.artworkUrl100,
    previewUrl: r.previewUrl,
    genre: r.primaryGenreName,
  }))
}

export default function Music() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()

  // Search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Playback (one shared <audio> element; only one track plays at a time)
  const audioRef = useRef(null)
  const [playingId, setPlayingId] = useState(null)

  // Mood + now playing
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const [mood, setMood] = useState('Happy')

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
    if (!couple) return
    loadMoods()
    loadPlaylist()
    const moodsChannel = supabase
      .channel(`moods-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'moods', filter: `couple_id=eq.${couple.id}` },
        loadMoods
      )
      .subscribe()
    const playlistChannel = supabase
      .channel(`playlist-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playlist_tracks', filter: `couple_id=eq.${couple.id}` },
        loadPlaylist
      )
      .subscribe()
    return () => {
      supabase.removeChannel(moodsChannel)
      supabase.removeChannel(playlistChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, partnerUid])

  function togglePlay(track) {
    const audio = audioRef.current
    if (!track.previewUrl) return
    if (playingId === track.id) {
      audio.pause()
      setPlayingId(null)
      return
    }
    audio.src = track.previewUrl
    audio.play()
    setPlayingId(track.id)
  }

  async function runSearch(term) {
    const q = term ?? query
    if (!q.trim()) return
    setSearching(true)
    setSearchError('')
    try {
      const tracks = await searchTracks(q)
      setResults(tracks)
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function saveMood(e) {
    e.preventDefault()
    await supabase.from('moods').upsert({
      couple_id: couple.id,
      user_id: user.id,
      mood,
      label: profile?.display_name || 'Me',
      updated_at: new Date().toISOString(),
    })
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
    await supabase.from('playlist_tracks').insert({
      couple_id: couple.id,
      track_id: track.id,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      preview_url: track.previewUrl,
      added_by: profile?.display_name || 'Me',
      added_by_uid: user.id,
    })
  }

  async function removeFromPlaylist(id) {
    await supabase.from('playlist_tracks').delete().eq('id', id)
  }

  return (
    <div className="screen with-nav">
      <h2>Mood & Music</h2>
      <p className="subtitle">Search real songs, play previews, and build a playlist together.</p>

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      {/* Mood picker */}
      <form onSubmit={saveMood} className="mood-form">
        <div className="mood-picker">
          {MOODS.map((m) => (
            <button
              type="button"
              key={m}
              className={'mood-btn' + (m === mood ? ' active' : '')}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <button type="submit">Update mood</button>
      </form>

      <div className="mood-cards">
        <div className="mood-card">
          <div className="mood-card-title">You</div>
          <div className="mood-emoji">{mine?.mood || '—'}</div>
          {mine?.now_playing && (
            <div className="now-playing-chip" onClick={() => togglePlay(mine.now_playing)}>
              <img src={mine.now_playing.artwork} alt="" />
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
              <img src={theirs.now_playing.artwork} alt="" />
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
          onChange={(e) => setQuery(e.target.value)}
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

      <div className="track-list">
        {results.map((track) => (
          <div key={track.id} className="track-row">
            <button className="track-play" onClick={() => togglePlay(track)} disabled={!track.previewUrl}>
              {playingId === track.id ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
            {track.artwork && <img src={track.artwork} alt="" className="track-artwork" />}
            <div className="track-info">
              <div className="track-title">{track.title}</div>
              <div className="track-artist">{track.artist}</div>
            </div>
            <div className="track-actions">
              <button className="link-btn small" onClick={() => setNowPlaying(track)}>
                Set as playing
              </button>
              <button className="link-btn small" onClick={() => addToPlaylist(track)}>
                + Playlist
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Shared playlist */}
      <h3 className="section-title">Our playlist</h3>
      <div className="track-list">
        {playlist.map((track) => (
          <div key={track.id} className="track-row">
            <button
              className="track-play"
              onClick={() => togglePlay({ id: track.id, previewUrl: track.preview_url })}
              disabled={!track.preview_url}
            >
              {playingId === track.id ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
            {track.artwork && <img src={track.artwork} alt="" className="track-artwork" />}
            <div className="track-info">
              <div className="track-title">{track.title}</div>
              <div className="track-artist">
                {track.artist} · added by {track.added_by}
              </div>
            </div>
            {track.added_by_uid === user.id && (
              <button className="link-btn small" onClick={() => removeFromPlaylist(track.id)}>
                remove
              </button>
            )}
          </div>
        ))}
        {playlist.length === 0 && (
          <p className="empty-state">No songs yet — search above and add your first one</p>
        )}
      </div>
    </div>
  )
}
