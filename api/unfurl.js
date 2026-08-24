// Vercel Serverless Function: /api/unfurl
//
// Given a URL, fetches the page server-side (avoids the CORS issues that
// would block doing this straight from the browser) and pulls out
// Open Graph / Twitter Card meta tags — image, title, description. This is
// how link-preview features work everywhere (Pinterest pin pages, Amazon,
// Etsy, and most retail/blog pages all set these tags for exactly this
// purpose), so pasting a Pinterest pin link here works the same way it
// would if you pasted it into iMessage or Slack.
//
// This is NOT the official Pinterest API — Pinterest's real API requires a
// developer app, OAuth, and review, which is overkill for a private
// 2-person app. This approach works for any individual link someone
// pastes, Pinterest included, without any of that setup.

function extractMeta(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${prop}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${prop}["']`, 'i'),
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m && m[1]) return m[1]
  }
  return null
}

function decodeEntities(str) {
  if (!str) return str
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const { url } = req.body || {}
  if (!url) {
    res.status(400).json({ error: 'missing url' })
    return
  }

  let parsed
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol')
  } catch {
    res.status(200).json({ error: "That doesn't look like a valid link." })
    return
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; BlessuthLinkPreview/1.0; +https://blessuth.vercel.app) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      redirect: 'follow',
    })
    const html = await response.text()

    const image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image')
    let title = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title')
    if (!title) {
      const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      title = titleTag ? titleTag[1] : null
    }
    const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')

    res.status(200).json({
      title: decodeEntities(title)?.trim() || null,
      image: image || null,
      description: decodeEntities(description)?.trim() || null,
      url: parsed.toString(),
    })
  } catch (err) {
    res.status(200).json({ error: 'Could not fetch a preview for that link — you can still fill it in by hand.' })
  }
}
