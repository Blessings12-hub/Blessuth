import { useEffect, useState } from 'react'
import { supabase } from '../supabase/config'
import { useAuth } from '../context/AuthContext'
import DistanceWidget from '../components/DistanceWidget'

export default function LocationPage() {
  const { couple, user, partnerUid, partnerName, profile } = useAuth()
  const [sharing, setSharing] = useState(false)
  const [partnerSharing, setPartnerSharing] = useState(false)
  const [error, setError] = useState('')

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

  async function toggleSharing() {
    await supabase
      .from('profiles')
      .update({ location_sharing_enabled: !profile?.location_sharing_enabled })
      .eq('id', user.id)
    // Get an immediate fix the moment it's turned on, rather than waiting
    // for the next background tick.
    if (!profile?.location_sharing_enabled) shareLocation()
  }

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

  return (
    <div className="screen with-nav">
      <h2>Distance between you</h2>
      <p className="subtitle">Turn on live sharing so you can both see how far apart you are.</p>

      <div className="sharing-toggle-row">
        <div>
          <div className="sharing-toggle-label">Share my live location</div>
          <div className="sharing-toggle-status">
            {profile?.location_sharing_enabled ? 'You are sharing' : 'Off — turn on to start sharing'}
          </div>
        </div>
        <button
          className={'toggle-switch' + (profile?.location_sharing_enabled ? ' on' : '')}
          onClick={toggleSharing}
          aria-pressed={!!profile?.location_sharing_enabled}
        >
          <span className="toggle-knob" />
        </button>
      </div>

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
