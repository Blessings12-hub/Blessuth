import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'

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

  async function loadLocations() {
    const { data } = await supabase.from('locations').select('*').eq('couple_id', couple.id)
    setMine(data?.find((r) => r.user_id === user.id) || null)
    setTheirs(data?.find((r) => r.user_id === partnerUid) || null)
  }

  useEffect(() => {
    if (!couple) return
    loadLocations()
    const channel = supabase
      .channel(`locations-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations', filter: `couple_id=eq.${couple.id}` },
        loadLocations
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, partnerUid])

  function shareLocation() {
    setError('')
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device.')
      return
    }
    setSharing(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await supabase.from('locations').upsert({
          couple_id: couple.id,
          user_id: user.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: profile?.display_name || 'Me',
          updated_at: new Date().toISOString(),
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
