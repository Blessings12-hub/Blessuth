// Vercel Serverless Function: /api/analyze-verse
//
// Given either typed text or a photo (e.g. a screenshot of a Bible app or a
// photo of a page), asks Claude to identify the reference, transcribe the
// verse, and write a few short, specific prayer points inspired by it.
//
// Needs one environment variable in Vercel:
//   ANTHROPIC_API_KEY — from console.anthropic.com → API Keys. This is a
//   separate account/key from anything else in this project; there's a
//   small usage-based cost per request (typically a fraction of a cent
//   each for a task this size).

const SYSTEM_PROMPT = `You help a couple with their shared Bible study. Given either a passage of Bible text (possibly informally typed, possibly with a reference, possibly without) or a photo of a Bible page or app screenshot, do three things:
1. Identify the most likely Bible reference (book, chapter, verse) if you can determine it. If genuinely uncertain, use null.
2. Transcribe/confirm the verse text as accurately as you can.
3. Write 3 to 5 short, specific prayer points (one sentence each) inspired by the themes, promises, or instructions in this passage — practical and personal, not generic platitudes.

Respond with ONLY a JSON object, no markdown fences, no preamble, no explanation:
{"reference": "Book Chapter:Verse" or null, "verseText": "...", "prayerPoints": ["...", "...", "..."]}`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    res.status(200).json({ error: 'AI analysis isn\'t set up yet — ANTHROPIC_API_KEY is missing in Vercel.' })
    return
  }

  const { text, imageBase64, imageMediaType } = req.body || {}
  if (!text && !imageBase64) {
    res.status(400).json({ error: 'missing text or image' })
    return
  }

  const content = []
  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageBase64 },
    })
    content.push({ type: 'text', text: 'Here is a photo of a Bible verse or passage.' })
  } else {
    content.push({ type: 'text', text })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      }),
    })

    const data = await response.json()
    if (data.error) {
      res.status(200).json({ error: data.error.message || 'The AI service returned an error.' })
      return
    }

    const raw = data?.content?.find((b) => b.type === 'text')?.text || ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    res.status(200).json({
      reference: parsed.reference || null,
      verseText: parsed.verseText || text || '',
      prayerPoints: Array.isArray(parsed.prayerPoints) ? parsed.prayerPoints.slice(0, 5) : [],
    })
  } catch (err) {
    res.status(200).json({ error: "Could not analyze that verse — you can still save it as you typed it." })
  }
}
