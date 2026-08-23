import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { HeartIcon } from './Icons'

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

function timeAgo(iso) {
  if (!iso) return null
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DistanceWidget() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)

  async function load() {
    if (!couple) return
    const { data } = await supabase.from('locations').select('*').eq('couple_id', couple.id)
    setMine(data?.find((r) => r.user_id === user.id) || null)
    setTheirs(data?.find((r) => r.user_id === partnerUid) || null)
  }

  useEffect(() => {
    if (!couple) return
    load()
    const channel = supabase
      .channel(`distance-widget-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations', filter: `couple_id=eq.${couple.id}` },
        load
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, partnerUid])

  // Only trust a location row if lat/lng actually came through as real
  // numbers — guards against showing a broken "NaN km" if a row exists but
  // is somehow malformed, instead of silently failing.
  const validPoint = (row) => row && Number.isFinite(row.lat) && Number.isFinite(row.lng)
  const haveMine = validPoint(mine)
  const haveTheirs = validPoint(theirs)
  const distance = haveMine && haveTheirs ? haversineKm(mine, theirs) : null
  const myInitial = (profile?.display_name || '?')[0].toUpperCase()
  const theirInitial = (partnerName || '?')[0].toUpperCase()

  return (
    <div className="distance-widget">
      <div className="distance-widget-track">
        <span className="distance-node mine">{myInitial}</span>
        <span className="distance-path">
          <span className="distance-path-line" />
          <span className="distance-path-icon"><HeartIcon size={16} /></span>
        </span>
        <span className="distance-node theirs">{theirInitial}</span>
      </div>

      {distance !== null && Number.isFinite(distance) ? (
        <>
          <div className="distance-widget-value">
            {Math.round(distance).toLocaleString()}
            <span className="unit">km apart</span>
          </div>
          <div className="distance-widget-meta">
            you {timeAgo(mine?.updated_at)} · {partnerName || 'them'} {timeAgo(theirs?.updated_at)}
          </div>
        </>
      ) : (
        <>
          <div className="distance-widget-value muted">— km</div>
          <div className="distance-widget-status">
            <span className={haveMine ? 'ready' : 'pending'}>
              {haveMine ? '✓ You shared' : "You haven't shared yet"}
            </span>
            <span className={haveTheirs ? 'ready' : 'pending'}>
              {haveTheirs
                ? `✓ ${partnerName || 'They'} shared`
                : `Waiting for ${partnerName || 'them'} to share`}
            </span>
          </div>
          <Link to="/location" className="distance-widget-cta">
            {haveMine ? 'Manage location sharing →' : 'Share your location →'}
          </Link>
        </>
      )}
    </div>
  )
}
