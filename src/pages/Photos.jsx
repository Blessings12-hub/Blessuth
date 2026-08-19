import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

// One hour is comfortably longer than anyone will sit on this screen in one
// sitting, and short enough that a leaked URL stops working reasonably soon.
const SIGNED_URL_TTL = 60 * 60

export default function Photos() {
  const { couple, user, profile } = useAuth()
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')

  async function loadPhotos() {
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
    const rows = data || []

    // The `photos` storage bucket is private (see supabase.sql) — a plain
    // public URL doesn't actually work against it and just shows a broken
    // image. Signed URLs are the private-bucket equivalent, generated fresh
    // each time the gallery loads.
    const withUrls = await Promise.all(
      rows.map(async (p) => {
        if (!p.path) return p
        const { data: signed } = await supabase.storage.from('photos').createSignedUrl(p.path, SIGNED_URL_TTL)
        return signed?.signedUrl ? { ...p, displayUrl: signed.signedUrl } : p
      })
    )
    setPhotos(withUrls)
  }

  useEffect(() => {
    if (!couple) return
    loadPhotos()
    const channel = supabase
      .channel(`photos-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `couple_id=eq.${couple.id}` },
        loadPhotos
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file || !couple) return
    setUploading(true)
    try {
      const path = `${couple.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, file)
      if (uploadError) throw uploadError
      // Storage is private, so this public URL never actually resolves —
      // it's kept only because the column is `not null`; the gallery signs
      // a working URL from `path` instead, every time it loads.
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
      const { error: insertError } = await supabase.from('photos').insert({
        couple_id: couple.id,
        url: urlData.publicUrl,
        path,
        caption,
        uploaded_by: profile?.display_name || user.id,
        uploaded_by_uid: user.id,
      })
      if (insertError) throw insertError
      setCaption('')
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete(photo) {
    if (!confirm('Delete this memory?')) return
    await supabase.storage.from('photos').remove([photo.path])
    await supabase.from('photos').delete().eq('id', photo.id)
  }

  return (
    <div className="screen with-nav">
      <h2>Photo Memories</h2>
      <p className="subtitle">Your shared album, always in sync.</p>

      <div className="upload-box">
        <input
          type="text"
          placeholder="Add a caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <label className="upload-btn">
          {uploading ? 'Uploading…' : '+ Add photo'}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            hidden
          />
        </label>
      </div>

      <div className="photo-grid">
        {photos.map((p) => (
          <div key={p.id} className="photo-card">
            <img src={p.displayUrl || p.url} alt={p.caption || 'memory'} />
            {p.caption && <div className="photo-caption">{p.caption}</div>}
            <div className="photo-meta">
              <span>{p.uploaded_by}</span>
              <button className="link-btn small" onClick={() => handleDelete(p)}>
                delete
              </button>
            </div>
          </div>
        ))}
        {photos.length === 0 && <p className="empty-state">No photos yet — add your first memory!</p>}
      </div>
    </div>
  )
}

