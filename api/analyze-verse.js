// Vercel Serverless Function: /api/analyze-verse
//
// Given either typed text or a photo (e.g. a screenshot of a Bible app or a
// photo of a page), identifies the reference and writes a few short,
// specific prayer points — then, if BIBLE_API_KEY is set, fetches the
// *real* NIV verse text from API.Bible instead of trusting the AI's own
// recollection of the wording. AI-recalled scripture text can drift from
// the actual translation; a real Bible database is accurate by
// construction instead.
//
// Tries Groq first for the AI part, and falls back to Gemini if Groq fails
// (busy, rate limited, or not configured) — two independent free
// providers, so a demand spike on one doesn't leave this feature broken.
//
// Environment variables (all optional, but you need at least one AI
// provider for this to do anything):
//   GROQ_API_KEY — free, from console.groq.com → API Keys.
//   GEMINI_API_KEY — free, from Google AI Studio (aistudio.google.com).
//   BIBLE_API_KEY — free (non-commercial use) from scripture.api.bible →
//   sign up → Applications → create one → copy the key. NIV's exact
//   availability on the free tier isn't guaranteed by their own docs — this
//   code checks what Bibles your key can actually see and only uses NIV if
//   it's there; otherwise it quietly falls back to the AI's own wording, so
//   the feature still works either way.

const SYSTEM_PROMPT = `You help a couple with their shared Bible study. Given either a passage of Bible text (possibly informally typed, possibly with a reference, possibly without) or a photo of a Bible page or app screenshot, do three things:
1. Identify the most likely Bible reference (book, chapter, verse) if you can determine it. If genuinely uncertain, use null.
2. Transcribe/confirm the verse text as accurately as you can — this is a fallback only, used if a real Bible database lookup isn't available.
3. Write 3 to 5 short, specific prayer points (one sentence each) inspired by the themes, promises, or instructions in this passage — practical and personal, not generic platitudes.

Respond with ONLY a JSON object matching this exact shape, no other text:
{"reference": "Book Chapter:Verse" or null, "verseText": "...", "prayerPoints": ["...", "...", "..."]}`

const GEMINI_MODEL = 'gemini-flash-latest'
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

// Free-tier Gemini occasionally returns a transient "model overloaded"
// (503) or rate-limit (429) error during demand spikes. `maxAttempts` is
// tuned by the caller: 2 when Gemini is the only configured provider (so
// it's worth a retry), 1 when it's only being used as a fallback after
// Groq already failed (so the remaining time budget isn't spent retrying
// twice) — Vercel's free Hobby plan caps functions at 10 seconds total.
async function callGemini(apiKey, body, maxAttempts) {
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await response.json()
    if (!data.error) {
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      return JSON.parse(raw)
    }

    lastError = data.error
    const retryable = data.error.code === 503 || data.error.code === 429
    if (!retryable || attempt === maxAttempts) break
    await new Promise((resolve) => setTimeout(resolve, 600))
  }

  const err = new Error(lastError?.message || 'Gemini returned an error.')
  err.overloaded = lastError?.code === 503 || lastError?.code === 429
  throw err
}

async function callGroq(apiKey, { text, imageBase64, imageMediaType }) {
  const content = []
  if (imageBase64) {
    content.push({ type: 'text', text: 'Here is a photo of a Bible verse or passage.' })
    content.push({ type: 'image_url', image_url: { url: `data:${imageMediaType || 'image/jpeg'};base64,${imageBase64}` } })
  } else {
    content.push({ type: 'text', text })
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 600,
    }),
  })
  const data = await response.json()
  if (data.error) throw new Error(data.error.message || 'Groq returned an error.')

  const raw = data?.choices?.[0]?.message?.content || ''
  return JSON.parse(raw)
}

function stripBibleMarkup(str) {
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cached for the life of a warm serverless instance — avoids re-fetching
// the full Bible list on every request. Best-effort only: a cold start
// just looks it up again, which is fine.
let cachedNivBibleId = null
let cachedAt = 0
const NIV_CACHE_TTL_MS = 60 * 60 * 1000

async function findNivBibleId(apiKey) {
  if (cachedNivBibleId && Date.now() - cachedAt < NIV_CACHE_TTL_MS) return cachedNivBibleId

  const response = await fetch('https://api.scripture.api.bible/v1/bibles?language=eng', {
    headers: { 'api-key': apiKey },
  })
  const data = await response.json()
  const bibles = data?.data || []
  const niv = bibles.find(
    (b) => (b.abbreviation || '').toUpperCase() === 'NIV' || /new international version/i.test(b.name || '')
  )
  cachedNivBibleId = niv?.id || null
  cachedAt = Date.now()
  return cachedNivBibleId
}

// Returns the real NIV text for a reference, or null if NIV isn't
// available on this key's plan, the reference wasn't found, or
// BIBLE_API_KEY isn't set — any of those are a normal "fall back to the
// AI's own wording" case, not an error worth surfacing.
async function fetchRealNivText(reference) {
  const apiKey = process.env.BIBLE_API_KEY
  if (!apiKey || !reference) return null

  try {
    const bibleId = await findNivBibleId(apiKey)
    if (!bibleId) return null

    const response = await fetch(
      `https://api.scripture.api.bible/v1/bibles/${bibleId}/search?query=${encodeURIComponent(reference)}&limit=1`,
      { headers: { 'api-key': apiKey } }
    )
    const data = await response.json()
    const passage = data?.data?.passages?.[0]
    if (passage?.content) return stripBibleMarkup(passage.content)
    const verse = data?.data?.verses?.[0]
    if (verse?.text) return stripBibleMarkup(verse.text)
    return null
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  if (!groqKey && !geminiKey) {
    res.status(200).json({
      error: "AI analysis isn't set up yet — add GROQ_API_KEY or GEMINI_API_KEY in Vercel.",
    })
    return
  }

  const { text, imageBase64, imageMediaType } = req.body || {}
  if (!text && !imageBase64) {
    res.status(400).json({ error: 'missing text or image' })
    return
  }

  let parsed = null
  let lastErr = null

  if (groqKey) {
    try {
      parsed = await callGroq(groqKey, { text, imageBase64, imageMediaType })
    } catch (err) {
      lastErr = err
    }
  }

  if (!parsed && geminiKey) {
    const parts = imageBase64
      ? [
          { inline_data: { mime_type: imageMediaType || 'image/jpeg', data: imageBase64 } },
          { text: 'Here is a photo of a Bible verse or passage.' },
        ]
      : [{ text }]

    try {
      parsed = await callGemini(
        geminiKey,
        {
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts }],
          generationConfig: { responseMimeType: 'application/json' },
        },
        groqKey ? 1 : 2
      )
    } catch (err) {
      lastErr = err
    }
  }

  if (!parsed) {
    res.status(200).json({
      error: lastErr?.overloaded
        ? 'The AI service is busy right now — please try again in a minute.'
        : 'Could not analyze that verse — you can still save it as you typed it.',
    })
    return
  }

  const reference = parsed.reference || null
  const realNivText = await fetchRealNivText(reference)

  res.status(200).json({
    reference,
    verseText: realNivText || parsed.verseText || text || '',
    verseSource: realNivText ? 'NIV' : null,
    prayerPoints: Array.isArray(parsed.prayerPoints) ? parsed.prayerPoints.slice(0, 5) : [],
  })
}
