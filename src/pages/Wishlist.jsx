import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { resizeImage } from '../imageResize'

const SIGNED_URL_TTL = 60 * 60

export default function Wishlist() {
  const { couple, user, profile, partnerUid, partnerName } = useAuth()
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('theirs')
  const [formOpen, setFormOpen] = useState(false)

  const [linkInput, setLinkInput] = useState('')
  const [unfurling, setUnfurling] = useState(false)
  const [unfurlError, setUnfurlError] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploadPath, setUploadPath] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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

  function resetForm() {
    setLinkInput('')
    setUnfurlError('')
    setTitle('')
    setNote('')
    setPrice('')
    setImageUrl('')
    setUploadPath('')
  }

  async function fetchPreview() {
    if (!linkInput.trim()) return
    setUnfurling(true)
    setUnfurlError('')
    try {
      const res = await fetch('/api/unfurl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkInput.trim() }),
      })
      const data = await res.json()
      if (data.error) {
        setUnfurlError(data.error)
      } else {
        if (data.image) setImageUrl(data.image)
        if (data.title && !title) setTitle(data.title)
      }
    } catch {
      setUnfurlError('Could not reach that link — you can still fill it in by hand.')
    } finally {
      setUnfurling(false)
    }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]
    if (!file || !couple) return
    setUploading(true)
    try {
      const resized = await resizeImage(file, 800, 0.85)
      const path = `${couple.id}/wishlist/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, resized)
      if (uploadError) throw uploadError
      setUploadPath(path)
      const { data: signed } = await supabase.storage.from('photos').createSignedUrl(path, SIGNED_URL_TTL)
      setImageUrl(signed?.signedUrl || '')
    } catch (err) {
      setUnfurlError(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function submitItem() {
    if (!title.trim()) return
    setSubmitting(true)
    await supabase.from('wishlist_items').insert({
      couple_id: couple.id,
      user_id: user.id,
      user_name: profile?.display_name || 'You',
      title: title.trim(),
      image_url: uploadPath ? null : imageUrl || null,
      path: uploadPath || null,
      link_url: linkInput.trim() || null,
      price: price.trim() || null,
      note: note.trim() || null,
    })
    setSubmitting(false)
    resetForm()
    setFormOpen(false)
  }

  async function toggleGotIt(item) {
    await supabase
      .from('wishlist_items')
      .update({ purchased: !item.purchased, purchased_by: !item.purchased ? user.id : null })
      .eq('id', item.id)
  }

  async function deleteItem(item) {
    if (!confirm('Remove this from your wishlist?')) return
    if (item.path) await supabase.storage.from('photos').remove([item.path])
    await supabase.from('wishlist_items').delete().eq('id', item.id)
  }

  const mine = items.filter((i) => i.user_id === user.id)
  const theirs = items.filter((i) => i.user_id === partnerUid)
  const shown = tab === 'mine' ? mine : theirs

  return (
    <div className="screen with-nav">
      <h2>Wishlist</h2>
      <p className="subtitle">Pin things you'd like — paste a link (Pinterest works great) or add your own photo.</p>

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
              <div className="wishlist-form-row">
                <input
                  type="text"
                  placeholder="Paste a link (Pinterest, Amazon, Etsy, anywhere)"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="word-input pictionary-guess-input"
                />
                <button className="link-btn small" onClick={fetchPreview} disabled={unfurling || !linkInput.trim()}>
                  {unfurling ? 'Fetching…' : 'Fetch preview'}
                </button>
              </div>
              {unfurlError && <p className="error">{unfurlError}</p>}

              <p className="wishlist-form-or">— or —</p>
              <label className="upload-btn">
                {uploading ? 'Uploading…' : '+ Upload a photo'}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} hidden />
              </label>

              {imageUrl && (
                <div className="wishlist-preview">
                  <img src={imageUrl} alt="" />
                </div>
              )}

              <input
                type="text"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="word-input pictionary-guess-input"
              />
              <input
                type="text"
                placeholder="Price (optional)"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="word-input pictionary-guess-input"
              />
              <textarea
                className="surprise-textarea"
                rows={2}
                placeholder="Note (optional) — size, color, why you want it…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <div className="wishlist-form-actions">
                <button
                  className="link-btn"
                  onClick={() => {
                    resetForm()
                    setFormOpen(false)
                  }}
                >
                  Cancel
                </button>
                <button className="primary-btn" onClick={submitItem} disabled={submitting || !title.trim()}>
                  {submitting ? 'Adding…' : 'Add to wishlist'}
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
              <p className="wishlist-card-title">{item.title}</p>
              {item.price && <p className="wishlist-card-price">{item.price}</p>}
              {item.note && <p className="wishlist-card-note">{item.note}</p>}
              {item.link_url && (
                <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="wishlist-card-link">
                  View link ↗
                </a>
              )}

              {tab === 'mine' ? (
                <button className="link-btn small" onClick={() => deleteItem(item)}>
                  remove
                </button>
              ) : (
                <button
                  className={'wishlist-got-it-btn' + (item.purchased ? ' done' : '')}
                  onClick={() => toggleGotIt(item)}
                >
                  {item.purchased ? '✓ Got it' : '🎁 Mark as got it'}
                </button>
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
