const DAILY_QUESTIONS = [
  "What's one small thing I did recently that made you smile?",
  'If we could teleport anywhere for just one hour today, where would you pick?',
  "What's a song that reminds you of us right now?",
  'What are you looking forward to this week?',
  "What's one habit of mine you secretly love?",
  'If you could send me one thing in the mail right now, what would it be?',
  "What's a memory of us you thought about recently?",
  'What does your ideal reunion day with me look like, hour by hour?',
  "What's something new you want to try together next?",
  'What made today better or worse than yesterday?',
  "What's a inside joke of ours you thought about recently?",
  'If we had a free weekend together right now, what would we do?',
  "What's something you're proud of yourself for this week?",
  'What food do you wish we could share right now?',
  "What's one thing about your day I wouldn't know unless you told me?",
  'What comfort show or movie are you in the mood for tonight?',
  "What's a compliment you've been meaning to give me?",
  'What place do you want us to visit together someday?',
  "What's something small I could do to make your week easier?",
  'What are you grateful for today?',
  "What's a goal you're working on right now?",
  'If you could hug me right now, how long would you hold on?',
  "What's the best part of your morning so far?",
  'What song should we add to "our" playlist?',
  "What's a childhood memory you haven't told me about yet?",
  'What do you miss most about being in the same room as me?',
  "What's something you want to learn together?",
  'What would our perfect date night look like tonight?',
  "What's one word that describes how you're feeling right now?",
  'What are you most excited for the next time we see each other?',
]

export default DAILY_QUESTIONS

export function todaysQuestion(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((date - start) / 86400000)
  return DAILY_QUESTIONS[dayOfYear % DAILY_QUESTIONS.length]
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}
