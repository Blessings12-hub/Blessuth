// Vercel Serverless Function: /api/analyze-verse
//
// Given either typed text or a photo (e.g. a screenshot of a Bible app or a
// photo of a page), asks an AI model to identify the reference, transcribe
// the verse, and write a few short, specific prayer points inspired by it.
//
// Tries Gemini first, and falls back to Groq if Gemini fails (busy, rate
// limited, or not configured) — two independent free providers, so a
// demand spike on one doesn't leave this feature broken.
//
// Needs at least one of these environment variables in Vercel (both is
// better, for the fallback to actually do anything):
//   GEMINI_API_KEY — free, from Google AI Studio (aistudio.google.com) →
//   Get API key. No credit card required.
//   GROQ_API_KEY — free, from console.groq.com → API Keys. No credit card
//   required. Runs on Groq's own fast inference hardware, so it also tends
//   to respond quicker than Gemini.

const SYSTEM_PROMPT = `You help a couple with their shared Bible study. Given either a passage of Bible text (possibly informally typed, possibly with a reference, possibly without) or a photo of a Bible page or app screenshot, do three things:
1. Identify the most likely Bible reference (book, chapter, verse) if you can determine it. If genuinely uncertain, use null.
2. Transcribe/confirm the verse text as accurately as you can.
3. Write 3 to 5 short, specific prayer points (one sentence each) inspired by the themes, promises, or instructions in this passage — practical and personal, not generic platitudes.

Respond with ONLY a JSON object matching this exact shape, no other text:
{"reference": "Book Chapter:Verse" or null, "verseText": "...", "prayerPoints": ["...", "...", "..."]}`

const GEMINI_MODEL = 'gemini-flash-latest'
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

// Free-tier Gemini occasionally returns a transient "model overloaded"
// (503) or rate-limit (429) error during demand spikes. `maxAttempts` is
// tuned by the caller: 2 when Gemini is the only configured provider (so
// it's worth a retry), 1 when Groq is available as a fallback (so the time
// budget goes toward trying a second provider instead of retrying the
// first) — Vercel's free Hobby plan caps functions at 10 seconds total.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const geminiKey = process.env.GEMINI_API_KEY
  const groqKey = process.env.GROQ_API_KEY
  if (!geminiKey && !groqKey) {
    res.status(200).json({
      error: "AI analysis isn't set up yet — add GEMINI_API_KEY or GROQ_API_KEY in Vercel.",
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

  if (geminiKey) {
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

  if (!parsed && groqKey) {
    try {
      parsed = await callGroq(groqKey, { text, imageBase64, imageMediaType })
    } catch (err) {
      lastErr = err
    }
  }

  if (!parsed) {
    res.status(200).json({
      error: lastErr?.overloaded
        ? "The AI service is busy right now — please try again in a minute."
        : 'Could not analyze that verse — you can still save it as you typed it.',
    })
    return
  }

  res.status(200).json({
    reference: parsed.reference || null,
    verseText: parsed.verseText || text || '',
    prayerPoints: Array.isArray(parsed.prayerPoints) ? parsed.prayerPoints.slice(0, 5) : [],
  })
}
