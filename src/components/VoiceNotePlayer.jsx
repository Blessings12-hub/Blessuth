import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'

const SIGNED_URL_TTL = 60 * 60

// Resolves a private-storage path to a playable signed URL and renders the
// browser's native audio player — deliberately minimal, no custom waveform
// or scrubber, since the built-in controls already cover play/pause/seek.
export default function VoiceNotePlayer({ path }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .storage
      .from('photos')
      .createSignedUrl(path, SIGNED_URL_TTL)
      .then(({ data }) => {
        if (!cancelled && data?.signedUrl) setUrl(data.signedUrl)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  if (!url) return <p className="subtitle small-note">Loading voice note…</p>
  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio controls src={url} className="voice-note-player" style={{ maxWidth: '100%', height: 32 }} />
}
