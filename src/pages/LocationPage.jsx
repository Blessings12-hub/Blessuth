import { useEffect, useState } from 'react'
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

// Default Leaflet marker icons need explicit URLs when bundled
const icon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export default function LocationPage() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!couple) return
    const ref = doc(db, 'couples', couple.id, 'location', user.uid)
    const unsub = onSnapshot(ref, (snap) => setMine(snap.exists() ? snap.data() : null))
    return unsub
  }, [couple, user])

  useEffect(() => {
    if (!couple || !partnerUid) return
    const ref = doc(db, 'couples', couple.id, 'location', partnerUid)
    const unsub = onSnapshot(ref, (snap) => setTheirs(snap.exists() ? snap.data() : null))
    return unsub
  }, [couple, partnerUid])

  function shareLocation() {
    setError('')
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device.')
      return
    }
    setSharing(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await setDoc(doc(db, 'couples', couple.id, 'location', user.uid), {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: profile?.displayName || 'Me',
          updatedAt: serverTimestamp(),
        })
        setSharing(false)
      },
      (err) => {
        setError(err.message)
        setSharing(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const distance = mine && theirs ? haversineKm(mine, theirs) : null
  const center = mine ? [mine.lat, mine.lng] : theirs ? [theirs.lat, theirs.lng] : [20, 0]

  return (
    <div className="screen with-nav">
      <h2>📍 Where you both are</h2>
      <p className="subtitle">Share your location so you can see the distance between you.</p>

      <button onClick={shareLocation} disabled={sharing}>
        {sharing ? 'Getting location…' : 'Share my location'}
      </button>
      {error && <p className="error">{error}</p>}

      {distance !== null && (
        <div className="distance-card">
          <div className="distance-number">{Math.round(distance).toLocaleString()} km</div>
          <div className="distance-label">apart right now</div>
        </div>
      )}

      {(mine || theirs) && (
        <div className="map-wrap">
          <MapContainer center={center} zoom={3} style={{ height: '360px', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {mine && (
              <Marker position={[mine.lat, mine.lng]} icon={icon}>
                <Popup>You</Popup>
              </Marker>
            )}
            {theirs && (
              <Marker position={[theirs.lat, theirs.lng]} icon={icon}>
                <Popup>{partnerName || 'Partner'}</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      )}
    </div>
  )
}
