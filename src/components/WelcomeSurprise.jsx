import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase/config'

const HEART_COUNT = 22

function makeHearts() {
  return Array.from({ length: HEART_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 14 + Math.random() * 22,
    duration: 4 + Math.random() * 3,
    delay: Math.random() * 3,
    drift: (Math.random() - 0.5) * 60,
    emoji: ['💛', '💕', '✨', '💖'][i % 4],
  }))
}

export default function WelcomeSurprise() {
  const { user, couple } = useAuth()
  const [dismissing, setDismissing] = useState(false)
  const hearts = useMemo(makeHearts, [couple?.surprise_armed_at])

  const shouldShow =
    !!couple &&
    !!couple.surprise_armed_at &&
    couple.surprise_armed_by !== user?.id &&
    (!couple.surprise_seen_at || new Date(couple.surprise_seen_at) < new Date(couple.surprise_armed_at))

  useEffect(() => {
    setDismissing(false)
  }, [couple?.surprise_armed_at])

  if (!shouldShow) return null

  async function dismiss() {
    setDismissing(true)
    setTimeout(async () => {
      await supabase.from('couples').update({ surprise_seen_at: new Date().toISOString() }).eq('id', couple.id)
    }, 250)
  }

  return (
    <div className={'surprise-overlay' + (dismissing ? ' dismissing' : '')} onClick={dismiss}>
      <div className="surprise-hearts" aria-hidden="true">
        {hearts.map((h) => (
          <span
            key={h.id}
            className="surprise-heart"
            style={{
              left: `${h.left}%`,
              fontSize: `${h.size}px`,
              animationDuration: `${h.duration}s`,
              animationDelay: `${h.delay}s`,
              '--drift': `${h.drift}px`,
            }}
          >
            {h.emoji}
          </span>
        ))}
      </div>

      <div className="surprise-card" onClick={(e) => e.stopPropagation()}>
        <div className="surprise-icon">💌</div>
        <p className="surprise-message">{couple.surprise_message || 'Just a little something to make you smile today.'}</p>
        <button type="button" className="surprise-close" onClick={dismiss}>
          Tap to continue
        </button>
      </div>
    </div>
  )
}
