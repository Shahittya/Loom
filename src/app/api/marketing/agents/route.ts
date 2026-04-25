import { NextRequest } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { callGLM } from '@/lib/glm'

export const maxDuration = 120

// Service role client — no cookie dependency, safe inside ReadableStream
function serviceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { goal, budget, extraContext } = await req.json()

  // Auth & business fetch BEFORE stream starts (cookies available here)
  const ssrSupabase = createServerClient()
  const { data: { user } } = await ssrSupabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: biz } = await ssrSupabase
    .from('businesses')
    .select('id, name, category')
    .eq('user_id', user.id)
    .single()
  if (!biz) return new Response('No business', { status: 404 })

  // Fetch business stats
  const sb = serviceSupabase()
  const [ordersRes, revenueRes, pendingRes, itemsRes] = await Promise.all([
    sb.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', biz.id),
    sb.from('orders').select('total_price').eq('business_id', biz.id).neq('status', 'cancelled'),
    sb.from('orders').select('id', { count: 'exact', head: true }).eq('business_id', biz.id).eq('status', 'pending'),
    sb.from('items').select('id', { count: 'exact', head: true }).eq('business_id', biz.id).eq('available', true),
  ])

  const totalRevenue = (revenueRes.data || []).reduce((s, o) => s + (o.total_price || 0), 0)
  const bizStats = `Business: "${biz.name}" | Category: ${biz.category} | Total orders: ${ordersRes.count || 0} | Revenue: RM${totalRevenue.toFixed(2)} | Pending: ${pendingRes.count || 0} | Products listed: ${itemsRes.count || 0}`
  const ownerInput = `Goal: ${goal} | Budget: RM${budget}${extraContext ? ` | Extra: ${extraContext}` : ''}`

  const MY_CONTEXT = `Malaysia 2025 market: TikTok Shop & LIVE selling exploding, Shopee/Lazada dominant, WhatsApp still #1 for SME customer chat, BNPL (Atome/Split) popular, Ramadan/Raya/CNY drive massive sales spikes, 80%+ users on mobile, price-sensitive buyers respond to bundles & free shipping, Gen Z heavy on Instagram Reels & TikTok.`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // === CEO ===
        send({ agent: 'CEO', status: 'thinking' })
        const ceoPrompt = `You are the CEO of a Malaysian ${biz.category} business. Reply in plain text only, no markdown.
${bizStats}
${ownerInput}

In 3-4 sentences, propose one bold and specific growth strategy. Be direct and action-oriented. Name a real Malaysian platform or trend (e.g. TikTok Shop, Shopee, WhatsApp, Raya campaign).`
        let ceo: string
        try {
          ceo = await callGLM([{ role: 'user', content: ceoPrompt }], { max_tokens: 4096, temperature: 0.8 })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          send({ agent: 'CEO', status: 'done', content: `Generation failed: ${msg}` })
          send({ agent: 'ERROR', status: 'done', content: `CEO agent failed: ${msg}` })
          controller.close(); return
        }
        send({ agent: 'CEO', status: 'done', content: ceo })

        // === CFO + CMO in parallel ===
        send({ agent: 'CFO', status: 'thinking' })
        send({ agent: 'CMO', status: 'thinking' })

        let cfo: string, cmo: string
        try {
          ;[cfo, cmo] = await Promise.all([
            callGLM([{ role: 'user', content: `You are CFO of a Malaysian ${biz.category} business. Reply in plain text only, no markdown. ${bizStats} Budget: RM${budget}. CEO proposed: "${ceo}". In 2-3 sentences: identify the key financial risk and give one specific cost-saving or ROI-maximising suggestion.` }], { max_tokens: 2048, temperature: 0.7 }),
            callGLM([{ role: 'user', content: `You are CMO of a Malaysian ${biz.category} business. Reply in plain text only, no markdown. ${bizStats} Budget: RM${budget}. CEO strategy: "${ceo}". ${MY_CONTEXT} In 2-3 sentences: recommend the best marketing channel for Malaysia and describe one specific campaign idea (e.g. TikTok LIVE, Shopee Ads, WhatsApp blast, Raya bundle).` }], { max_tokens: 2048, temperature: 0.8 }),
          ])
        } catch {
          send({ agent: 'ERROR', status: 'done', content: 'CFO/CMO agents failed. Please retry.' })
          controller.close(); return
        }

        send({ agent: 'CFO', status: 'done', content: cfo })
        send({ agent: 'CMO', status: 'done', content: cmo })

        // === FINAL ACTION PLAN ===
        send({ agent: 'FINAL', status: 'thinking' })
        const finalPrompt = `You are a senior business consultant for Malaysian SMEs. Reply in plain text only, no markdown symbols.
${bizStats}
${ownerInput}

CEO strategy: ${ceo}
CFO caution: ${cfo}
CMO marketing: ${cmo}

Write a numbered 5-step action plan. Each step: Step 1: ... Step 2: ... etc. Be specific, actionable, Malaysia-focused. Include a rough timeline for each step.`
        let final: string
        try {
          final = await callGLM([{ role: 'user', content: finalPrompt }], { max_tokens: 4096, temperature: 0.75 })
        } catch {
          final = 'Unable to generate action plan. Please retry.'
        }
        send({ agent: 'FINAL', status: 'done', content: final })

        // Save to ai_insights
        await sb.from('ai_insights').insert({
          business_id: biz.id,
          type: 'insight',
          content: `AI Board Strategy\nGoal: ${goal} | Budget: RM${budget}\n\nCEO — Growth Strategy:\n${ceo}\n\nCFO — Financial Analysis:\n${cfo}\n\nCMO — Marketing Plan:\n${cmo}\n\nAction Plan:\n${final}`,
        })

        send({ agent: 'DONE', status: 'done' })
      } catch {
        send({ agent: 'ERROR', status: 'done', content: 'Generation failed. Please try again.' })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
