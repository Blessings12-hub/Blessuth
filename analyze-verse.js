// Vercel Serverless Function: /api/analyze-verse
//
// Given either typed text or a photo (e.g. a screenshot of a Bible app or a
// photo of a page), asks Gemini to identify the reference, transcribe the
// verse, and write a few short, specific prayer points inspired by it.
//
// Needs one environment variable in Vercel:
//   GEMINI_API_KEY — free, from Google AI Studio (aistudio.google.com) →
//   Get API key. No credit card required. Gemini's Flash models have a
//   genuine free tier (not a trial credit) generous enough for a couple
//   occasionally sharing verses — well under the daily limit.

const SYSTEM_PROMPT = `You help a couple with their shared Bible study. Given either a passage of Bible text (possibly informally typed, possibly with a reference, possibly without) or a photo of a Bible page or app screenshot, do three things:
1. Identify the most likely Bible reference (book, chapter, verse) if you can determine it. If genuinely uncertain, use null.
2. Transcribe/confirm the verse text as accurately as you can.
3. Write 3 to 5 short, specific prayer points (one sentence each) inspired by the themes, promises, or instructions in this passage — practical and personal, not generic platitudes.

Respond with ONLY a JSON object matching this exact shape, no other text:
{"reference": "Book Chapter:Verse" or null, "verseText": "...", "prayerPoints": ["...", "...", "..."]}`

const MODEL = 'gemini-flash-latest'

// Free-tier Gemini occasionally returns a transient "model overloaded"
// error (503) or rate-limit error (429) during demand spikes — retrying
// once after a short pause clears most of these. Kept to a single retry
// with a short delay: Vercel's free Hobby plan caps functions at 10
// seconds total, so there isn't room for a longer retry budget.
async function callGemini(apiKey, body) {
  const maxAttempts = 2
  let lastError = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )
    const data = await response.json()
    if (!data.error) return data

    lastError = data.error
    const retryable = data.error.code === 503 || data.error.code === 429
    if (!retryable || attempt === maxAttempts) break
    await new Promise((resolve) => setTimeout(resolve, 600))
  }

  const err = new Error(lastError?.message || 'The AI service returned an error.')
  err.overloaded = lastError?.code === 503 || lastError?.code === 429
  throw err
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(200).json({ error: "AI analysis isn't set up yet — GEMINI_API_KEY is missing in Vercel." })
    return
  }

  const { text, imageBase64, imageMediaType } = req.body || {}
  if (!text && !imageBase64) {
    res.status(400).json({ error: 'missing text or image' })
    return
  }

  const parts = []
  if (imageBase64) {
    parts.push({ inline_data: { mime_type: imageMediaType || 'image/jpeg', data: imageBase64 } })
    parts.push({ text: 'Here is a photo of a Bible verse or passage.' })
  } else {
    parts.push({ text })
  }

  try {
    const data = await callGemini(apiKey, {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json' },
    })

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const parsed = JSON.parse(raw)

    res.status(200).json({
      reference: parsed.reference || null,
      verseText: parsed.verseText || text || '',
      prayerPoints: Array.isArray(parsed.prayerPoints) ? parsed.prayerPoints.slice(0, 5) : [],
    })
  } catch (err) {
    res.status(200).json({
      error: err.overloaded
        ? "Google's AI is busy right now — please try again in a minute."
        : 'Could not analyze that verse — you can still save it as you typed it.',
    })
  }
}
