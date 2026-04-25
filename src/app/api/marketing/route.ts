import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGLM } from '@/lib/glm'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, itemName, itemDescription, itemPrice } = await req.json()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  // Gather data
  const [ordersRes, itemsRes] = await Promise.all([
    supabase.from('orders').select('total_price, status, created_at, channel').eq('business_id', business.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('items').select('name, price, available').eq('business_id', business.id),
  ])

  const orders = ordersRes.data || []
  const items = itemsRes.data || []
  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s: number, o: { total_price: number }) => s + o.total_price, 0)
  const orderCount = orders.length

  let prompt = ''
  if (type === 'insight') {
    prompt = `Business advisor. Give 3 SHORT growth ideas (1-2 sentences each). Focus on upselling, new products, repeat customers.

Business: ${business.name} (${business.category})
Revenue: RM ${totalRevenue.toFixed(2)} | Orders: ${orderCount} | Products: ${items.length}
Top items: ${items.slice(0, 5).map(i => i.name).join(', ')}`
  } else if (type === 'post') {
    prompt = `Write a short social media post (Facebook/Instagram/Telegram) for this business. Use emojis, be catchy, Malaysian-friendly, include a call to action. Max 120 words.

Business: ${business.name} (${business.category})
Products: ${items.slice(0, 3).map(i => i.name).join(', ')}`
  } else if (type === 'item-post') {
    prompt = `Write a vibrant Instagram/Facebook post for this item. Use emojis, bold language, call to action. End with 4-5 hashtags. Max 120 words. Malaysian-friendly.

Business: ${business.name}
Item: ${itemName}
${itemDescription ? `Description: ${itemDescription}` : ''}
${itemPrice ? `Price: RM${itemPrice}` : ''}`
  } else if (type === 'promo') {
    prompt = `Give 1 short promotional campaign idea for this business. Include: mechanic, duration, example copy. Max 120 words. Malaysian-friendly.

Business: ${business.name} (${business.category})
Products: ${items.slice(0, 3).map(i => i.name).join(', ')}`
  } else {
    prompt = `Give a short marketing strategy for ${business.name} (${business.category}). Products: ${items.slice(0, 3).map(i => i.name).join(', ')}. Max 120 words.`
  }

  const tokenMap: Record<string, number> = {
    insight: 2048,
    post: 2048,
    'item-post': 2048,
    promo: 2048,
  }

  let content: string
  try {
    content = await callGLM([{ role: 'user', content: prompt }], { temperature: 0.8, max_tokens: tokenMap[type] ?? 300 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('GLM error:', err)
    return NextResponse.json({ error: `AI generation failed: ${message}` }, { status: 500 })
  }

  // Save insight
  await supabase.from('ai_insights').insert({
    business_id: business.id,
    type,
    content,
  })

  return NextResponse.json({ content })
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
  if (!business) return NextResponse.json({ insights: [] })

  const { data } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ insights: data || [] })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  await supabase.from('ai_insights').delete().eq('id', id).eq('business_id', business.id)
  return NextResponse.json({ success: true })
}
