import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { buildAlert, senderIdOf } from '../notifications'

const TABLES = ['messages', 'notes', 'daily_answers', 'message_reactions', 'quiz_answers', 'wishlist_items']
const AUTO_DISMISS_MS = 7000

// Alerts only fire while this tab/app is open — there's no service worker
// or server involved, just a live Supabase Realtime subscription over
// WebSocket. That's the tradeoff for skipping all push/VAPID setup.
export function useInAppAlerts({ coupleId, partnerUid, partnerName, muted }) {
  const [alerts, setAlerts] = useState([])
  const nextId = useRef(1)
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  useEffect(() => {
    if (!coupleId || !partnerUid || muted) return

    const channel = supabase.channel(`in-app-alerts-${coupleId}`)

    for (const table of TABLES) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const record = payload.new || {}
          // Only alert on things your partner did, never your own actions.
          if (senderIdOf(table, record) !== partnerUid) return
          const alert = buildAlert(table, record, partnerName)
          if (!alert) return
          const id = nextId.current++
          setAlerts((prev) => [...prev, { id, ...alert }])
          timers.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
        }
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      Object.values(timers.current).forEach(clearTimeout)
      timers.current = {}
    }
  }, [coupleId, partnerUid, partnerName, muted, dismiss])

  return { alerts, dismiss }
}
