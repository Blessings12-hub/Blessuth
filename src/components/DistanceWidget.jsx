import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import { HeartIcon } from './Icons'

const STALE_AFTER_MIN = 180

// Only write a new location if we've moved meaningfully or enough time
// passed — keeps things "live" without hammering the database on every
// GPS tick. (Moved here from Dashboard.jsx so all location logic — the
// toggle, the tracking, the display — lives in one place.)
const MIN_MOVE_KM = 0.5
const MIN_INTERVAL_MS = 5 * 60 * 1000

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

function minutesAgo(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

function timeAgo(mins) {
  if (mins === null) return null
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// Tries for a precise fix first, then falls back to a coarser, more
// forgiving one — a tight high-accuracy timeout is the single most common
// reason this silently never gets a position (indoors, weak GPS, slow first
// fix). Only used for the immediate one-off fix when sharing is switched
// on; ongoing updates come from watchPosition below.
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      () => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 60000,
        })
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    )
  })
}

export default function DistanceWidget() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [mine, setMine] = useState(null)
  const [theirs, setTheirs] = useState(null)
  const [partnerSharing, setPartnerSharing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')
  const lastWrite = useRef({ coords: null, at: 0 })

  async function load() {
    if (!couple) return
    const { data, error: loadError } = await supabase
      .from('locations')
      .select('user_id, lat, lng, label, updated_at')
      .eq('couple_id', couple.id)
    if (loadError) {
      setError('Location sharing is temporarily unavailable.')
      return
    }
    setMine(data?.find((r) => r.user_id === user.id) || null)
    setTheirs(data?.find((r) => r.user_id === partnerUid) || null)
  }

  async function loadPartnerSharing() {
    if (!partnerUid) return
    const { data } = await supabase
      .from('profiles')
      .select('location_sharing_enabled')
      .eq('id', partnerUid)
      .single()
    setPartnerSharing(data?.location_sharing_enabled || false)
  }

  useEffect(() => {
    if (!couple) return
    load()
    loadPartnerSharing()

    const locationsChannel = supabase
      .channel(`distance-widget-locations-${couple.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'locations', filter: `couple_id=eq.${couple.id}` },
        load
      )
      .subscribe()

    const sharingChannel = partnerUid
      ? supabase
          .channel(`distance-widget-sharing-${partnerUid}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${partnerUid}` },
            loadPartnerSharing
          )
          .subscribe()
      : null

    return () => {
      supabase.removeChannel(locationsChannel)
      if (sharingChannel) supabase.removeChannel(sharingChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, partnerUid])

  // The web fallback tracks while this screen is open. Native shells can expose
  // window.NativeLocation.start/stop so a platform background location service
  // continues while the app is closed; the service writes the same Supabase row.
  useEffect(() => {
    if (!couple || !profile?.location_sharing_enabled) return
    const nativeLocation = window.NativeLocation
    if (nativeLocation?.start) {
      nativeLocation.start({ coupleId: couple.id, userId: user.id, label: profile?.display_name || 'Me' })
      return () => nativeLocation.stop?.()
    }
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const last = lastWrite.current
        const elapsed = Date.now() - last.at
        const moved = last.coords ? haversineKm(last.coords, coords) : Infinity
        if (elapsed < MIN_INTERVAL_MS && moved < MIN_MOVE_KM) return
        lastWrite.current = { coords, at: Date.now() }
        supabase.from('locations').upsert({
          couple_id: couple.id,
          user_id: user.id,
          lat: coords.lat,
          lng: coords.lng,
          label: profile?.display_name || 'Me',
          updated_at: new Date().toISOString(),
        })
      },
      () => {
        // Silently ignore — permission may have been revoked after
        // initially granting; toggling off/on again surfaces a clear error.
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [couple?.id, user?.id, profile?.display_name, profile?.location_sharing_enabled])

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [couple?.id])

  async function toggleSharing() {
    setError('')
    if (profile?.location_sharing_enabled) {
      // Turning off also clears your stored location — otherwise "off"
      // would be cosmetic only, and your last known spot would keep
      // silently showing to your partner.
      const { error: profileError } = await supabase.from('profiles').update({ location_sharing_enabled: false }).eq('id', user.id)
      const { error: locationError } = await supabase.from('locations').delete().eq('couple_id', couple.id).eq('user_id', user.id)
      if (profileError || locationError) {
        setError('Could not turn off location sharing. Please try again.')
      }
      return
    }

    setSharing(true)
    try {
      const pos = await getPosition()
      lastWrite.current = { coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, at: Date.now() }
      const { error: locationError } = await supabase.from('locations').upsert({
        couple_id: couple.id,
        user_id: user.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: profile?.display_name || 'Me',
        updated_at: new Date().toISOString(),
      })
      const { error: profileError } = await supabase.from('profiles').update({ location_sharing_enabled: true }).eq('id', user.id)
      if (locationError || profileError) throw new Error('Could not save your location sharing setting.')
    } catch (err) {
      setError(
        err.code === 1
          ? "Location access is blocked — check your browser or phone's location permissions."
          : err.message || 'Could not get your location — try again in a moment.'
      )
    } finally {
      setSharing(false)
    }
  }

  const bothSharing = !!profile?.location_sharing_enabled && partnerSharing
  const distance = bothSharing && mine && theirs ? haversineKm(mine, theirs) : null
  const myMinsAgo = minutesAgo(mine?.updated_at)
  const theirMinsAgo = minutesAgo(theirs?.updated_at)
  const stale = (myMinsAgo !== null && myMinsAgo > STALE_AFTER_MIN) || (theirMinsAgo !== null && theirMinsAgo > STALE_AFTER_MIN)
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

      {distance !== null ? (
        <>
          <div className="distance-widget-value">
            {Math.round(distance).toLocaleString()}
            <span className="unit">km apart</span>
          </div>
          <div className="distance-widget-meta">
            you {timeAgo(myMinsAgo)} · {partnerName || 'them'} {timeAgo(theirMinsAgo)}
            {stale && ' · may be outdated'}
          </div>
        </>
      ) : (
        <div className="distance-widget-value muted">
          {!profile?.location_sharing_enabled
            ? 'Not sharing'
            : !partnerSharing
              ? `Waiting for ${partnerName || 'them'}`
              : '— km'}
        </div>
      )}

      <button className="toggle-row" onClick={toggleSharing} disabled={sharing}>
        <span>{sharing ? 'Getting your location…' : profile?.location_sharing_enabled ? 'Sharing on' : 'Share your location'}</span>
        <span className={'toggle-switch' + (profile?.location_sharing_enabled ? ' on' : '')}>
          <span className="toggle-knob" />
        </span>
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
