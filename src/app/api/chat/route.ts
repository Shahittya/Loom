import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGLM, buildSystemPrompt, detectEscalationLevel } from '@/lib/glm'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, sessionId } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

  // Get business
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'No business found' }, { status: 404 })

  // Get items for context
  const { data: items } = await supabase
    .from('items')
    .select('name, description, price, available, stock')
    .eq('business_id', business.id)
    .eq('available', true)

  const itemList = items?.map(i => `- ${i.name}: RM${i.price}${i.description ? ` (${i.description})` : ''}${i.stock !== null ? ` [Stock: ${i.stock}]` : ''}`).join('\n') || 'No items listed yet.'

  // Get chat history for session
  let history: { role: 'user' | 'assistant'; content: string }[] = []
  if (sessionId) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('sender, message_text')
      .eq('business_id', business.id)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(20)

    history = (msgs || []).map(m => ({
      role: m.sender === 'customer' ? 'user' : 'assistant',
      content: m.message_text,
    }))
  }

  // Detect escalation
  const escalation = detectEscalationLevel(message)

  const systemPrompt = buildSystemPrompt(business) + `\n\nCurrent products/services:\n${itemList}\n\nEscalation level for this message: ${escalation.toUpperCase()}\n${escalation === 'high' ? 'IMPORTANT: This customer needs urgent attention. Flag this for the owner immediately and be empathetic.' : ''}`

  // Save customer message
  await supabase.from('messages').insert({
    business_id: business.id,
    sender: 'customer',
    message_text: message,
    session_id: sessionId,
    channel: 'web',
  })

  let reply: string
  try {
    reply = await callGLM([
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ])
  } catch {
    reply = "I'm sorry, I'm having trouble connecting right now. Please try again in a moment."
  }

  // Save AI reply
  await supabase.from('messages').insert({
    business_id: business.id,
    sender: 'ai',
    message_text: reply,
    session_id: sessionId,
    channel: 'web',
  })

  // Log escalation action if needed
  if (escalation !== 'low') {
    await supabase.from('ai_actions').insert({
      business_id: business.id,
      action_type: `escalation_${escalation}`,
      status: escalation === 'high' ? 'requires_human' : 'handled',
      result: `Customer message: "${message.substring(0, 100)}"`,
    })
  }

  return NextResponse.json({ reply, escalation })
}
