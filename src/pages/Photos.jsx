import { useEffect, useRef, useState } from 'react'
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
  const [uploadError, setUploadError] = useState('')

  // window.confirm()/window.alert() are unreliable in iOS home-screen PWAs
  // (a known iOS WebKit limitation) — using the same inline patterns as the
  // rest of the app (Settings.jsx's disconnect flow, Wishlist's delete)
  // instead of the native browser dialogs.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [lightboxIndex, setLightboxIndex] = useState(null)
  const touchStartX = useRef(null)

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
    setUploadError('')
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
      setUploadError('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function confirmDelete(photo) {
    setDeleteBusy(true)
    await supabase.storage.from('photos').remove([photo.path])
    await supabase.from('photos').delete().eq('id', photo.id)
    setDeleteBusy(false)
    setConfirmDeleteId(null)
  }

  function openLightbox(photo) {
    const idx = photos.findIndex((p) => p.id === photo.id)
    if (idx !== -1) setLightboxIndex(idx)
  }

  function showNext() {
    setLightboxIndex((i) => (i === null ? i : (i + 1) % photos.length))
  }

  function showPrev() {
    setLightboxIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length))
  }

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) < 40) return
    if (delta < 0) showNext()
    else showPrev()
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
      {uploadError && <p className="error">{uploadError}</p>}

      <div className="photo-grid">
        {photos.map((p) => (
          <div key={p.id} className="photo-card">
            <img
              src={p.displayUrl || p.url}
              alt={p.caption || 'memory'}
              onClick={() => openLightbox(p)}
              style={{ cursor: 'zoom-in' }}
            />
            {p.caption && <div className="photo-caption">{p.caption}</div>}
            <div className="photo-meta">
              <span>{p.uploaded_by}</span>
              {confirmDeleteId === p.id ? (
                <div className="confirm-box">
                  <p>Delete this memory?</p>
                  <div className="row">
                    <button className="danger-btn" onClick={() => confirmDelete(p)} disabled={deleteBusy}>
                      {deleteBusy ? 'Deleting…' : 'Yes, delete'}
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={deleteBusy}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button className="link-btn small" onClick={() => setConfirmDeleteId(p.id)}>
                  delete
                </button>
              )}
            </div>
          </div>
        ))}
        {photos.length === 0 && <p className="empty-state">No photos yet — add your first memory!</p>}
      </div>

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          onClick={() => setLightboxIndex(null)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            cursor: 'zoom-out',
            touchAction: 'pan-y',
          }}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 'calc(16px + env(safe-area-inset-top))',
              right: 16,
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: 'white',
              width: 36,
              height: 36,
              borderRadius: '50%',
              fontSize: '1.3rem',
              lineHeight: 1,
              cursor: 'pointer',
              zIndex: 1,
            }}
          >
            ×
          </button>

          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  showPrev()
                }}
                aria-label="Previous"
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: 'white',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  fontSize: '1.3rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  showNext()
                }}
                aria-label="Next"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: 'white',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  fontSize: '1.3rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ›
              </button>
            </>
          )}

          <img
            src={photos[lightboxIndex].displayUrl || photos[lightboxIndex].url}
            alt={photos[lightboxIndex].caption || ''}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 8,
            }}
          />

          {photos[lightboxIndex].caption && (
            <p
              style={{
                position: 'absolute',
                bottom: 'calc(48px + env(safe-area-inset-bottom))',
                color: 'white',
                fontSize: '0.85rem',
                textAlign: 'center',
                padding: '0 20px',
              }}
            >
              {photos[lightboxIndex].caption}
            </p>
          )}

          {photos.length > 1 && (
            <p
              style={{
                position: 'absolute',
                bottom: 'calc(16px + env(safe-area-inset-bottom))',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.8rem',
              }}
            >
              {lightboxIndex + 1} / {photos.length}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
