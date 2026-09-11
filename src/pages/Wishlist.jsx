import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { resizeImage } from '../imageResize'
import PageIntro from '../components/PageIntro'

const SIGNED_URL_TTL = 60 * 60

function titleFromFilename(name) {
  const base = name.replace(/\.[^/.]+$/, '')
  const spaced = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const titled = spaced.replace(/\b\w/g, (c) => c.toUpperCase())
  return titled || 'Wishlist item'
}

// Price is free-form text ("$45", "around $30", "$1,200") so this pulls out
// the first number it can find, for sorting purposes only — display always
// shows the original text as typed.
function parsePrice(price) {
  if (!price) return null
  const match = price.replace(/,/g, '').match(/[\d.]+/)
  return match ? parseFloat(match[0]) : null
}

export default function Wishlist() {
  const { couple, user, profile, partnerUid, partnerName } = useAuth()
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('theirs')
  const [formOpen, setFormOpen] = useState(false)

  // Quick multi-add: paste several links (one per line) and/or pick several
  // photos at once — everything gets added in one pass, no per-item form.
  const [linksText, setLinksText] = useState('')
  const [photoFiles, setPhotoFiles] = useState([])
  const [adding, setAdding] = useState(null) // { done, total } while in progress
  const [addError, setAddError] = useState('')

  // Fill in price/notes/adjust the title afterward, per item, instead of
  // up front — that's what keeps the initial add fast.
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  // window.confirm() is unreliable in iOS home-screen PWAs (a known iOS
  // WebKit limitation) — this app already avoids it everywhere else (see
  // Settings.jsx's disconnect flow) in favor of an inline confirm box.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [sortBy, setSortBy] = useState('newest')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const touchStartX = useRef(null)

  async function loadItems() {
    if (!couple) return
    const { data } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('couple_id', couple.id)
      .order('created_at', { ascending: false })
    const rows = data || []
    const withUrls = await Promise.all(
      rows.map(async (item) => {
        if (!item.path) return item
        const { data: signed } = await supabase.storage.from('photos').createSignedUrl(item.path, SIGNED_URL_TTL)
        return signed?.signedUrl ? { ...item, displayUrl: signed.signedUrl } : item
      })
    )
    setItems(withUrls)
  }

  useEffect(() => {
    if (!couple) return
    loadItems()
    const channel = supabase
      .channel(`wishlist-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wishlist_items', filter: `couple_id=eq.${couple.id}` },
        loadItems
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id])

  async function addAll() {
    const lines = linksText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const files = photoFiles
    const total = lines.length + files.length
    if (total === 0) return

    setAddError('')
    setAdding({ done: 0, total })
    const failures = []

    for (const line of lines) {
      try {
        let previewTitle = null
        let previewImage = null
        try {
          const res = await fetch('/api/unfurl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: line }),
          })
          const data = await res.json()
          if (!data.error) {
            previewTitle = data.title
            previewImage = data.image
          }
        } catch {
          // Unfurl failing just means no auto title/image — still add the link.
        }
        await supabase.from('wishlist_items').insert({
          couple_id: couple.id,
          user_id: user.id,
          user_name: profile?.display_name || 'You',
          title: (previewTitle || line).slice(0, 120),
          image_url: previewImage || null,
          link_url: line,
        })
      } catch {
        failures.push(line)
      }
      setAdding((a) => (a ? { ...a, done: a.done + 1 } : a))
    }

    for (const file of files) {
      try {
        const resized = await resizeImage(file, 800, 0.85)
        const path = `${couple.id}/wishlist/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage.from('photos').upload(path, resized)
        if (uploadError) throw uploadError
        await supabase.from('wishlist_items').insert({
          couple_id: couple.id,
          user_id: user.id,
          user_name: profile?.display_name || 'You',
          title: titleFromFilename(file.name),
          path,
        })
      } catch {
        failures.push(file.name)
      }
      setAdding((a) => (a ? { ...a, done: a.done + 1 } : a))
    }

    setAdding(null)
    if (failures.length > 0) {
      setAddError(`Couldn't add: ${failures.join(', ')} — everything else was added fine.`)
    }
    setLinksText('')
    setPhotoFiles([])
    if (failures.length === 0) setFormOpen(false)
  }

  function startEdit(item) {
    setEditingId(item.id)
    setEditTitle(item.title || '')
    setEditPrice(item.price || '')
    setEditNote(item.note || '')
  }

  async function saveEdit(item) {
    setEditBusy(true)
    await supabase
      .from('wishlist_items')
      .update({
        title: editTitle.trim() || item.title,
        price: editPrice.trim() || null,
        note: editNote.trim() || null,
      })
      .eq('id', item.id)
    setEditBusy(false)
    setEditingId(null)
  }

  async function confirmDelete(item) {
    setDeleteBusy(true)
    if (item.path) await supabase.storage.from('photos').remove([item.path])
    await supabase.from('wishlist_items').delete().eq('id', item.id)
    setDeleteBusy(false)
    setConfirmDeleteId(null)
  }

  async function toggleGotIt(item) {
    await supabase
      .from('wishlist_items')
      .update({ purchased: !item.purchased, purchased_by: !item.purchased ? user.id : null })
      .eq('id', item.id)
  }

  const mine = items.filter((i) => i.user_id === user.id)
  const theirs = items.filter((i) => i.user_id === partnerUid)
  const unsorted = tab === 'mine' ? mine : theirs

  const shown = [...unsorted].sort((a, b) => {
    if (sortBy === 'newest') return 0 // already newest-first from the query
    const pa = parsePrice(a.price)
    const pb = parsePrice(b.price)
    if (pa === null && pb === null) return 0
    if (pa === null) return 1 // items with no price sort to the end either way
    if (pb === null) return -1
    return sortBy === 'price-asc' ? pa - pb : pb - pa
  })
  const lightboxItems = shown.filter((i) => i.displayUrl || i.image_url)

  function openLightbox(item) {
    const idx = lightboxItems.findIndex((i) => i.id === item.id)
    if (idx !== -1) setLightboxIndex(idx)
  }

  function showNext() {
    setLightboxIndex((i) => (i === null ? i : (i + 1) % lightboxItems.length))
  }

  function showPrev() {
    setLightboxIndex((i) => (i === null ? i : (i - 1 + lightboxItems.length) % lightboxItems.length))
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
      <PageIntro eyebrow="Future plans" title="Wishlist" description="Pin things you'd like — paste links or add photos, several at once." />

      <div className="play-tabs">
        <button type="button" role="tab" aria-selected={tab === 'theirs'} className={'play-tab' + (tab === 'theirs' ? ' active' : '')} onClick={() => setTab('theirs')}>
          For {partnerName || 'them'}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={'play-tab' + (tab === 'mine' ? ' active' : '')} onClick={() => setTab('mine')}>
          For you
        </button>
      </div>

      {shown.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0' }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '6px 10px',
              fontSize: '0.8rem',
              background: 'var(--surface)',
              color: 'var(--ink)',
            }}
          >
            <option value="newest">Newest first</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>
      )}

      {tab === 'mine' && (
        <div className="wishlist-add-section">
          {!formOpen ? (
            <button className="primary-btn" onClick={() => setFormOpen(true)}>
              + Add to your wishlist
            </button>
          ) : (
            <div className="wishlist-form">
              <textarea
                className="surprise-textarea"
                rows={3}
                placeholder={'Paste one or more links, one per line\ne.g.\nhttps://pinterest.com/pin/...\nhttps://amazon.com/...'}
                value={linksText}
                onChange={(e) => setLinksText(e.target.value)}
                disabled={!!adding}
              />

              <label className="upload-btn">
                {photoFiles.length > 0 ? `${photoFiles.length} photo(s) selected` : '+ Add photos (pick several at once)'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPhotoFiles(Array.from(e.target.files))}
                  disabled={!!adding}
                  hidden
                />
              </label>

              <p className="subtitle small-note">
                Titles are grabbed automatically — add price or notes afterward by tapping any item.
              </p>

              {adding && (
                <p className="subtitle small-note">
                  Adding {adding.done} of {adding.total}…
                </p>
              )}
              {addError && <p className="error">{addError}</p>}

              <div className="wishlist-form-actions">
                <button
                  className="link-btn"
                  onClick={() => {
                    setLinksText('')
                    setPhotoFiles([])
                    setAddError('')
                    setFormOpen(false)
                  }}
                  disabled={!!adding}
                >
                  Cancel
                </button>
                <button
                  className="primary-btn"
                  onClick={addAll}
                  disabled={!!adding || (!linksText.trim() && photoFiles.length === 0)}
                >
                  {adding ? 'Adding…' : 'Add to wishlist'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="wishlist-grid">
        {shown.map((item) => (
          <div key={item.id} className="wishlist-card">
            {(item.displayUrl || item.image_url) && (
              <img
                src={item.displayUrl || item.image_url}
                alt={item.title}
                className="wishlist-card-img"
                onClick={() => openLightbox(item)}
                style={{ cursor: 'zoom-in' }}
              />
            )}
            <div className="wishlist-card-body">
              {editingId === item.id ? (
                <div className="wishlist-form" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="word-input pictionary-guess-input"
                    placeholder="Title"
                  />
                  <input
                    type="text"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="word-input pictionary-guess-input"
                    placeholder="Price (optional)"
                  />
                  <textarea
                    className="surprise-textarea"
                    rows={2}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Note (optional)"
                  />
                  <div className="wishlist-form-actions">
                    <button className="link-btn small" onClick={() => setEditingId(null)} disabled={editBusy}>
                      Cancel
                    </button>
                    <button className="primary-btn" onClick={() => saveEdit(item)} disabled={editBusy}>
                      {editBusy ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="wishlist-card-title">{item.title}</p>
                  {item.price && <p className="wishlist-card-price">{item.price}</p>}
                  {item.note && <p className="wishlist-card-note">{item.note}</p>}
                  {item.link_url && (
                    <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="wishlist-card-link">
                      View link ↗
                    </a>
                  )}

                  {tab === 'mine' ? (
                    confirmDeleteId === item.id ? (
                      <div className="confirm-box">
                        <p>Remove this item?</p>
                        <div className="row">
                          <button className="danger-btn" onClick={() => confirmDelete(item)} disabled={deleteBusy}>
                            {deleteBusy ? 'Removing…' : 'Yes, remove'}
                          </button>
                          <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={deleteBusy}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button className="link-btn small" onClick={() => startEdit(item)}>
                          edit
                        </button>
                        <button className="link-btn small" onClick={() => setConfirmDeleteId(item.id)}>
                          remove
                        </button>
                      </div>
                    )
                  ) : (
                    <button
                      className={'wishlist-got-it-btn' + (item.purchased ? ' done' : '')}
                      onClick={() => toggleGotIt(item)}
                    >
                      {item.purchased ? '✓ Got it' : '🎁 Mark as got it'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <p className="empty-state">
            {tab === 'mine'
              ? 'Nothing on your wishlist yet — add your first idea above!'
              : `${partnerName || 'They'} haven't added anything yet.`}
          </p>
        )}
      </div>

      {lightboxIndex !== null && lightboxItems[lightboxIndex] && (
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

          {lightboxItems.length > 1 && (
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
            src={lightboxItems[lightboxIndex].displayUrl || lightboxItems[lightboxIndex].image_url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 8,
            }}
          />

          {lightboxItems.length > 1 && (
            <p
              style={{
                position: 'absolute',
                bottom: 'calc(16px + env(safe-area-inset-bottom))',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.8rem',
              }}
            >
              {lightboxIndex + 1} / {lightboxItems.length}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
