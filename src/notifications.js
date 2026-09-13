// Turns a freshly-inserted (or, for a few tables, updated) row into the
// title/body/url for an in-app alert or push notification. `partnerName` is
// passed in by the caller where relevant — most callers already know it
// from AuthContext, and this only ever runs for events caused by your
// partner, never your own actions.

import QUIZ_TOPICS from './data/quizSets.js'

export function buildAlert(table, record, partnerName) {
  const name = partnerName || 'Your partner'

  if (table === 'messages') {
    return {
      title: name,
      body: (record.text || '').slice(0, 140) || 'sent you a message',
      url: '/chat',
    }
  }

  if (table === 'notes') {
    return {
      title: name,
      body: (record.text || '').slice(0, 140) || 'sent you a note',
      url: '/notes',
    }
  }

  if (table === 'daily_answers') {
    return {
      title: `${name} answered today's question`,
      body: 'Tap to answer yours and see what they said.',
      url: '/',
    }
  }

  if (table === 'message_reactions') {
    return {
      title: `${name} reacted ${record.emoji || ''}`.trim(),
      body: 'Tap to see it in Chat.',
      url: '/chat',
    }
  }

  if (table === 'quiz_answers') {
    const [topicKey, subtopicKey] = String(record.quiz_key || '').split('.')
    const subtopicTitle = QUIZ_TOPICS?.[topicKey]?.subtopics?.[subtopicKey]?.title || 'a quiz'
    return {
      title: `${name} finished a quiz!`,
      body: `They completed "${subtopicTitle}". Tap to answer and see how you compare.`,
      url: `/play?tab=quizzes&quiz=${encodeURIComponent(record.quiz_key || '')}`,
    }
  }

  if (table === 'wishlist_items') {
    return {
      title: `${name} added something to their wishlist`,
      body: record.title ? `"${record.title}" — tap to see it.` : 'Tap to see what they added.',
      url: '/wishlist',
    }
  }

  if (table === 'bible_verses') {
    return {
      title: `${name} shared a verse`,
      body: record.reference || (record.verse_text || '').slice(0, 100) || 'Tap to see it and pray together.',
      url: '/bible',
    }
  }

  if (table === 'word_guesses') {
    return {
      title: `${name} guessed in the Word Game`,
      body: 'Come take your turn.',
      url: `/play?tab=games&game=word`,
    }
  }

  if (table === 'truth_or_dare_state') {
    return {
      title: `${name} picked ${record.kind === 'dare' ? 'Dare' : 'Truth'}`,
      body: record.prompt ? record.prompt.slice(0, 100) : 'Come see what came up.',
      url: '/play',
    }
  }

  if (table === 'this_or_that_answers') {
    return {
      title: `${name} finished This or That`,
      body: 'Your turn — see how you match.',
      url: '/play',
    }
  }

  if (table === 'nhie_answers') {
    return {
      title: `${name} finished Never Have I Ever`,
      body: 'Your turn — see where you match.',
      url: '/play',
    }
  }

  if (table === 'pictionary_rounds') {
    return {
      title: `${name} started a Pictionary round`,
      body: 'Your turn to guess!',
      url: '/play',
    }
  }

  if (table === 'twenty_q_rounds') {
    return {
      title: `${name} thought of something`,
      body: 'Your turn to start asking yes/no questions.',
      url: '/play',
    }
  }

  if (table === 'twenty_q_questions') {
    return {
      title: 'New question in 20 Questions',
      body: 'Your turn to answer.',
      url: '/play',
    }
  }

  if (table === 'emoji_charades_rounds') {
    return {
      title: `${name} started Emoji Charades`,
      body: 'Your turn to decode the emojis!',
      url: '/play',
    }
  }

  if (table === 'story_chain_lines') {
    return {
      title: `${name} added to your story`,
      body: 'Your turn to add the next line.',
      url: '/play',
    }
  }

  if (table === 'tictactoe_games') {
    return {
      title: "It's your turn!",
      body: 'Tic-Tac-Toe is waiting on you.',
      url: '/play',
    }
  }

  if (table === 'connect4_games') {
    return {
      title: "It's your turn!",
      body: 'Connect Four is waiting on you.',
      url: '/play',
    }
  }

  return null
}

// The row's "who did this" column differs by table. Not used at all for
// tictactoe_games/connect4_games — those two are turn-based, so the
// recipient is read directly from `turn` instead (see api/notify.js and
// useInAppAlerts.js), not derived from who caused the event.
export function senderIdOf(table, record) {
  if (table === 'notes') return record.from_uid
  if (table === 'truth_or_dare_state') return record.chosen_by
  if (table === 'pictionary_rounds') return record.drawer_id
  if (table === 'twenty_q_rounds') return record.answerer_id
  if (table === 'twenty_q_questions') return record.asked_by
  if (table === 'emoji_charades_rounds') return record.clue_giver_id
  return record.sender_id || record.user_id
}
