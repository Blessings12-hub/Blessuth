// Vercel Serverless Function: /api/notify-test
//
// Sends a single test push through OneSignal's REST API, targeted at the
// requesting account's external_id (the Supabase user id). Always returns
// real JSON with a specific reason on failure, unlike a raw web-push crash
// that could come back as a blank/HTML error page.
//
// Requires ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY (server-side only,
// see README step 6).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const { externalId } = req.body || {}
  if (!externalId) {
    res.status(400).json({ error: 'Missing externalId.' })
    return
  }

  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
    res.status(500).json({
      error:
        'ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY are not set in Vercel. Add them in Settings → Environment ' +
        'Variables (see README step 6) and redeploy.',
    })
    return
  }

  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        target_channel: 'push',
        include_aliases: { external_id: [externalId] },
        headings: { en: 'Test notification' },
        contents: { en: 'If you can see this, push itself is working correctly.' },
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      res.status(500).json({ error: data.errors ? JSON.stringify(data.errors) : 'OneSignal rejected the request.' })
      return
    }

    if (!data.id) {
      res.status(500).json({
        error:
          'OneSignal accepted the request but found no subscribed device for this account. Make sure ' +
          'notifications are turned on in Settings and the browser permission prompt was allowed, then try again.',
      })
      return
    }

    res.status(200).json({ sent: true })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send test notification.' })
  }
}
