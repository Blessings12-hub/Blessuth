import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { resizeImage } from '../imageResize'

const SIGNED_URL_TTL = 60 * 60

function titleFromFilename(name) {
  const base = name.replace(/\.[^/.]+$/, '')
  const spaced = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const titled = spaced.replace(/\b\w/g, (c) => c.toUpperCase())
  return titled || 'Wishlist item'
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
  const shown = tab === 'mine' ? mine : theirs

  return (
    <div className="screen with-nav">
      <h2>Wishlist</h2>
      <p className="subtitle">Pin things you'd like — paste links (Pinterest works great) or add photos, several at once.</p>

      <div className="play-tabs">
        <button className={'play-tab' + (tab === 'theirs' ? ' active' : '')} onClick={() => setTab('theirs')}>
          For {partnerName || 'them'}
        </button>
        <button className={'play-tab' + (tab === 'mine' ? ' active' : '')} onClick={() => setTab('mine')}>
          For you
        </button>
      </div>

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
              <img src={item.displayUrl || item.image_url} alt={item.title} className="wishlist-card-img" />
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
    </div>
  )
}
