// Turns a freshly-inserted row (from messages / notes / daily_answers /
// message_reactions / quiz_answers) into the title/body/url for an in-app
// alert. `partnerName` is passed in by the caller (already known from
// AuthContext) rather than looked up here, since this only ever runs for
// events caused by your partner.

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
      url: '/quizzes',
    }
  }

  return null
}

// The row's "who did this" column differs by table.
export function senderIdOf(table, record) {
  if (table === 'notes') return record.from_uid
  return record.sender_id || record.user_id
}
