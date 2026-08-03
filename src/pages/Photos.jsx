import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

export default function Photos() {
  const { couple, user, profile } = useAuth()
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')

  useEffect(() => {
    if (!couple) return
    const q = query(
      collection(db, 'couples', couple.id, 'photos'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [couple])

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file || !couple) return
    setUploading(true)
    try {
      const path = `couples/${couple.id}/photos/${Date.now()}_${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await addDoc(collection(db, 'couples', couple.id, 'photos'), {
        url,
        path,
        caption,
        uploadedBy: profile?.displayName || user.uid,
        createdAt: serverTimestamp(),
      })
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
    try {
      await deleteObject(ref(storage, photo.path))
    } catch {
      // ignore if already gone
    }
    await deleteDoc(doc(db, 'couples', couple.id, 'photos', photo.id))
  }

  return (
    <div className="screen with-nav">
      <h2>📸 Photo Memories</h2>
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
            <img src={p.url} alt={p.caption || 'memory'} />
            {p.caption && <div className="photo-caption">{p.caption}</div>}
            <div className="photo-meta">
              <span>{p.uploadedBy}</span>
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
