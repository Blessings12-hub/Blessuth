// Vercel Serverless Function: /api/itunes-search
//
// The iTunes Search API's CORS headers are inconsistent for non-localhost
// origins — it often works while developing locally and then fails once
// deployed (the classic "Search failed" symptom). Proxying it through a
// server-to-server request sidesteps browser CORS entirely.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const term = (req.query.term || '').toString().trim()
  if (!term) {
    res.status(400).json({ error: 'missing term' })
    return
  }

  try {
    const upstream = await fetch(
      `https://itunes.apple.com/search?media=music&entity=song&limit=15&term=${encodeURIComponent(term)}`
    )
    if (!upstream.ok) {
      res.status(502).json({ error: 'iTunes lookup failed' })
      return
    }
    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60')
    res.status(200).json(data)
  } catch (err) {
    res.status(502).json({ error: 'iTunes lookup failed' })
  }
}
