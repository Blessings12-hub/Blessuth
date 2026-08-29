import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase/config'
import { buildAlert, senderIdOf } from '../notifications'

// Most tables use the same "sender caused an event, notify their partner"
// pattern — a simple INSERT check against senderIdOf() covers all of these.
const ACTIVITY_TABLES = [
  'messages',
  'notes',
  'daily_answers',
  'message_reactions',
  'quiz_answers',
  'wishlist_items',
  'word_guesses',
  'truth_or_dare_state',
  'this_or_that_answers',
  'nhie_answers',
  'pictionary_rounds',
  'twenty_q_rounds',
  'twenty_q_questions',
  'emoji_charades_rounds',
  'story_chain_lines',
  'bible_verses',
]

// Tic-Tac-Toe/Connect Four don't fit that pattern — the recipient is
// whoever `turn` currently points to, not "whoever didn't cause the
// event" (a fresh game can hand the very first turn to either player).
const TURN_TABLES = ['tictactoe_games', 'connect4_games']

const AUTO_DISMISS_MS = 7000

// Alerts only fire while this tab/app is open — there's no service worker
// or server involved on this path, just a live Supabase Realtime
// subscription over WebSocket.
export function useInAppAlerts({ coupleId, userId, partnerUid, partnerName, muted }) {
  const [alerts, setAlerts] = useState([])
  const nextId = useRef(1)
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  useEffect(() => {
    if (!coupleId || !userId || !partnerUid || muted) return

    const channel = supabase.channel(`in-app-alerts-${coupleId}`)

    function push(alert) {
      if (!alert) return
      const id = nextId.current++
      setAlerts((prev) => [...prev, { id, ...alert }])
      timers.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    }

    for (const table of ACTIVITY_TABLES) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const record = payload.new || {}
          if (senderIdOf(table, record) !== partnerUid) return
          push(buildAlert(table, record, partnerName))
        }
      )
    }

    for (const table of TURN_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `couple_id=eq.${coupleId}` },
        (payload) => {
          const record = payload.new || {}
          if (record.winner) return // game just ended, no one needs to move next
          if (record.turn !== userId) return
          if (payload.eventType === 'INSERT' && record.created_by === userId) return // your own coin-flip result
          push(buildAlert(table, record, partnerName))
        }
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
      Object.values(timers.current).forEach(clearTimeout)
      timers.current = {}
    }
  }, [coupleId, userId, partnerUid, partnerName, muted, dismiss])

  return { alerts, dismiss }
}
