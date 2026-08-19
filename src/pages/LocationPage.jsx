import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import DistanceWidget from '../components/DistanceWidget'

export default function LocationPage() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [sharing, setSharing] = useState(false)
  const [partnerSharing, setPartnerSharing] = useState(false)
  const [error, setError] = useState('')
  const [justShared, setJustShared] = useState(false)

  // Track whether my partner has switched their sharing on too
  useEffect(() => {
    if (!partnerUid) return
    let channel
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('location_sharing_enabled')
        .eq('id', partnerUid)
        .single()
      setPartnerSharing(data?.location_sharing_enabled || false)
    }
    load()
    channel = supabase
      .channel(`partner-sharing-${partnerUid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${partnerUid}` },
        load
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [partnerUid])

  // A single promise wrapper around geolocation that tries for a precise
  // fix first, then falls back to a coarser, more forgiving one — a tight
  // high-accuracy timeout is the single most common reason this silently
  // never gets a position (indoors, weak GPS, slow first fix).
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
        { enableHighAccuracy: true, timeout: 12000 }
      )
    })
  }

  // Toggling on now waits for a real location fix before the "sharing" flag
  // ever turns on — previously the flag flipped on regardless, so a failed
  // or slow GPS read left both of you seeing "sharing" with no distance to
  // show and nothing telling you why.
  async function toggleSharing() {
    setError('')
    if (profile?.location_sharing_enabled) {
      await supabase.from('profiles').update({ location_sharing_enabled: false }).eq('id', user.id)
      return
    }

    setSharing(true)
    try {
      const pos = await getPosition()
      await supabase.from('locations').upsert({
        couple_id: couple.id,
        user_id: user.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: profile?.display_name || 'Me',
        updated_at: new Date().toISOString(),
      })
      await supabase.from('profiles').update({ location_sharing_enabled: true }).eq('id', user.id)
      setJustShared(true)
      setTimeout(() => setJustShared(false), 3000)
    } catch (err) {
      setError(
        err.code === 1
          ? "Location access is blocked for this site — check your browser or phone's location permissions and try again."
          : err.message || 'Could not get your location — try again in a moment.'
      )
    } finally {
      setSharing(false)
    }
  }

  async function shareNow() {
    setError('')
    setSharing(true)
    try {
      const pos = await getPosition()
      await supabase.from('locations').upsert({
        couple_id: couple.id,
        user_id: user.id,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: profile?.display_name || 'Me',
        updated_at: new Date().toISOString(),
      })
      setJustShared(true)
      setTimeout(() => setJustShared(false), 3000)
    } catch (err) {
      setError(err.message || 'Could not get your location — try again in a moment.')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="screen with-nav">
      <h2>Distance between you</h2>
      <p className="subtitle">Turn on live sharing so you can both see how far apart you are.</p>

      <div className="sharing-toggle-row">
        <div>
          <div className="sharing-toggle-label">Share my live location</div>
          <div className="sharing-toggle-status">
            {sharing
              ? 'Getting your location…'
              : profile?.location_sharing_enabled
              ? 'You are sharing'
              : 'Off — turn on to start sharing'}
          </div>
        </div>
        <button
          className={'toggle-switch' + (profile?.location_sharing_enabled ? ' on' : '')}
          onClick={toggleSharing}
          disabled={sharing}
          aria-pressed={!!profile?.location_sharing_enabled}
        >
          <span className="toggle-knob" />
        </button>
      </div>

      {profile?.location_sharing_enabled && (
        <button className="link-btn small" onClick={shareNow} disabled={sharing}>
          {sharing ? 'Refreshing…' : 'Refresh my location now'}
        </button>
      )}
      {justShared && <p className="subtitle small-note">Location shared just now.</p>}

      <div className="sharing-toggle-row">
        <div>
          <div className="sharing-toggle-label">{partnerName || 'Partner'}'s sharing</div>
          <div className="sharing-toggle-status">
            {partnerSharing ? 'They are sharing' : 'Off — waiting for them to turn it on'}
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <DistanceWidget />
    </div>
  )
}

