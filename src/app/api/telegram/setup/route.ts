import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'

export async function POST(req: NextRequest) {
  const { token, appUrl } = await req.json()
  if (!token || !appUrl) return NextResponse.json({ ok: false, error: 'Missing token or appUrl' })

  // Telegram requires a public HTTPS URL — localhost will always fail
  if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
    return NextResponse.json({
      ok: false,
      error: 'Telegram webhooks require a public HTTPS URL. Your app is running on localhost. Deploy your app first (e.g. Vercel), then reconnect.',
    })
  }

  // Embed the token in the webhook URL so Telegram sends it back on every update,
  // allowing the handler to identify which bot/business the update belongs to.
  const webhookUrl = `${appUrl}/api/telegram/webhook?token=${encodeURIComponent(token)}`

  try {
    const res = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, {
      url: webhookUrl,
      allowed_updates: ['message'],
    })
    if (res.data.ok) {
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, error: res.data.description })
  } catch (e: unknown) {
    // Extract actual Telegram error description from axios error response
    const axiosError = e as { response?: { data?: { description?: string } }; message: string }
    const telegramMsg = axiosError.response?.data?.description
    return NextResponse.json({ ok: false, error: telegramMsg || axiosError.message })
  }
}
