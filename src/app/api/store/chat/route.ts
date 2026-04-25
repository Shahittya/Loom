import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callGLM } from '@/lib/glm'

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: 'Supabase environment variables are missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { businessId, message, history } = await req.json()
  if (!businessId || !message?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const [bizRes, itemsRes, settingsRes, promosRes] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', businessId).single(),
    supabase.from('items').select('name, description, price, available, stock, discount_type, discount_value, promo_label').eq('business_id', businessId).eq('available', true),
    supabase.from('business_settings').select('landing_contact, telegram_username').eq('business_id', businessId).single(),
    supabase.from('promos').select('code, description, discount_type, discount_value, max_uses, current_uses').eq('business_id', businessId).eq('active', true),
  ])

  const business = bizRes.data
  const items = itemsRes.data || []
  const settings = settingsRes.data
  const promos = promosRes.data || []

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const categoryLabel: Record<string, string> = {
    food: 'food & beverage', physical: 'physical products', digital: 'digital products', service: 'services'
  }

  const itemList = items.map(i => {
    const discountedPrice = i.discount_type === 'percentage' && i.discount_value
      ? i.price * (1 - i.discount_value / 100)
      : i.discount_type === 'fixed' && i.discount_value
      ? i.price - i.discount_value
      : null
    return `- ${i.name}: RM${i.price}${discountedPrice ? ` (ON PROMO: RM${discountedPrice.toFixed(2)}${i.promo_label ? ` — ${i.promo_label}` : ''})` : ''}${i.description ? ` — ${i.description}` : ''}${i.stock !== null ? ` [Stock: ${i.stock}]` : ''}`
  }).join('\n') || 'No items listed yet.'

  const promoList = promos.length > 0
    ? promos.map(p => `- Code: ${p.code} | ${p.discount_type === 'percentage' ? `${p.discount_value}% off` : `RM${p.discount_value} off`}${p.description ? ` | ${p.description}` : ''}${p.max_uses ? ` | ${p.max_uses - p.current_uses} uses left` : ''}`).join('\n')
    : 'No promo codes available right now.'

  const systemPrompt = `You are a friendly AI assistant for "${business.name}", a ${categoryLabel[business.category] || business.category} business. Help customers with questions, guide them to order, and be warm and helpful.

Available items/services:
${itemList}

Active promo codes:
${promoList}

Owner contact: ${settings?.landing_contact || 'Not provided'}
${settings?.telegram_username ? `Chat via Telegram: ${settings.telegram_username}` : ''}

Rules:
- Always respond in the customer's language
- If asked for owner contact or phone, share the contact info above
- If asked about promos or discounts, list them clearly
- If asked what's on the menu or available, list items with prices
- Be concise, friendly, and use relevant emojis
- Do not make up information not listed above
- Guide customers to add items to cart and complete their order`

  const msgs = [
    { role: 'system' as const, content: systemPrompt },
    ...((history || []) as { role: 'user' | 'assistant'; content: string }[]).slice(-10),
    { role: 'user' as const, content: message },
  ]

  const reply = await callGLM(msgs, { temperature: 0.7, max_tokens: 400 })

  return NextResponse.json({ reply })
}
