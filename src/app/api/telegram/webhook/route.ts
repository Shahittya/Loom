import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { callGLM, buildSystemPrompt, detectEscalationLevel } from '@/lib/glm'
import axios from 'axios'

async function sendTelegramMessage(token: string, chatId: string | number, text: string) {
  await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  })
}

export async function POST(req: NextRequest) {
  // Use service role for webhook (no auth context)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: 'Supabase environment variables are missing' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const body = await req.json()
  const message = body?.message
  if (!message) return NextResponse.json({ ok: true })

  const chatId = message.chat?.id
  const text: string = message.text || ''
  const customerName = message.from?.first_name || 'Customer'

  if (!chatId || !text) return NextResponse.json({ ok: true })

  // Find business by Telegram bot token matching (via settings)
  // Token is embedded in the webhook URL query param by the setup route
  const botToken = req.nextUrl.searchParams.get('token') || process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return NextResponse.json({ ok: true })

  const { data: settings } = await supabase
    .from('business_settings')
    .select('*, businesses(*)')
    .eq('telegram_bot_token', botToken)
    .single()

  if (!settings?.businesses) {
    await sendTelegramMessage(botToken, chatId, "Sorry, this bot is not configured yet.")
    return NextResponse.json({ ok: true })
  }

  const business = settings.businesses as { id: string; name: string; category: string; mode: string }

  // Get or create Telegram session
  let { data: session } = await supabase
    .from('telegram_sessions')
    .select('*')
    .eq('business_id', business.id)
    .eq('telegram_chat_id', String(chatId))
    .single()

  if (!session) {
    const { data: newSession } = await supabase
      .from('telegram_sessions')
      .insert({ business_id: business.id, telegram_chat_id: String(chatId), customer_name: customerName })
      .select()
      .single()
    session = newSession
  }

  // Get items
  const { data: items } = await supabase
    .from('items')
    .select('id, name, description, price, available, stock')
    .eq('business_id', business.id)
    .eq('available', true)

  const itemList = items?.map(i => `- ${i.name}: RM${i.price}${i.description ? ` (${i.description})` : ''}`).join('\n') || 'No items available.'

  // Check for receipt upload (photo)
  if (message.photo && session?.state === 'awaiting_receipt') {
    const fileId = message.photo[message.photo.length - 1]?.file_id
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileId}`

    // Create the order from cart
    const cart = session.cart || []
    if (cart.length > 0) {
      const total = cart.reduce((s: number, c: { price: number; qty: number }) => s + c.price * c.qty, 0)
      const { data: order } = await supabase.from('orders').insert({
        business_id: business.id,
        customer_name: session.customer_name || customerName,
        customer_contact: `Telegram: ${customerName}`,
        customer_telegram_id: String(chatId),
        total_price: total,
        status: 'confirmed',
        delivery_address: session.customer_address || null,
        channel: 'telegram',
        receipt_url: fileUrl,
      }).select().single()

      if (order) {
        for (const cartItem of cart) {
          await supabase.from('order_items').insert({
            order_id: order.id,
            item_id: cartItem.item_id,
            quantity: cartItem.qty,
            price: cartItem.price,
          })
        }
      }

      // Reset session
      await supabase.from('telegram_sessions').update({ state: 'idle', cart: [] }).eq('id', session.id)
      await sendTelegramMessage(botToken, chatId, `✅ Receipt received! Your order has been confirmed. Thank you, ${session.customer_name || customerName}! We'll prepare your order shortly.`)
    }
    return NextResponse.json({ ok: true })
  }

  // Get chat history for this session
  const { data: history } = await supabase
    .from('messages')
    .select('sender, message_text')
    .eq('business_id', business.id)
    .eq('channel', 'telegram')
    .order('created_at', { ascending: true })
    .limit(15)

  const chatHistory = (history || []).map(m => ({
    role: (m.sender === 'customer' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.message_text,
  }))

  const escalation = detectEscalationLevel(text)

  const telegramExtra = `\n\nFor ORDER TAKING via Telegram:
1. When customer clearly wants to order, collect their name, delivery address (if needed), and order items
2. When order is confirmed, reply with EXACTLY this JSON block wrapped in <ORDER_CONFIRMED> tags:
<ORDER_CONFIRMED>
{"items":[{"item_id":"...","name":"...","price":0,"qty":1}],"customer_name":"...","address":"...","total":0}
</ORDER_CONFIRMED>
3. After confirming order, tell customer to pay and send their payment receipt as a photo in this chat.
4. Available items:\n${itemList}`

  const systemPrompt = buildSystemPrompt(business) + telegramExtra

  // Save customer message
  await supabase.from('messages').insert({
    business_id: business.id,
    sender: 'customer',
    message_text: `[${customerName}] ${text}`,
    channel: 'telegram',
  })

  let reply: string
  try {
    reply = await callGLM([
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: text },
    ])
  } catch {
    reply = "Sorry, I'm having a technical issue. Please try again in a moment."
  }

  // Check for order confirmation in reply
  const orderMatch = reply.match(/<ORDER_CONFIRMED>([\s\S]*?)<\/ORDER_CONFIRMED>/)
  if (orderMatch) {
    try {
      const orderData = JSON.parse(orderMatch[1].trim())
      // Update session with cart
      await supabase.from('telegram_sessions').update({
        state: 'awaiting_receipt',
        cart: orderData.items,
        customer_name: orderData.customer_name || customerName,
        customer_address: orderData.address || null,
      }).eq('id', session.id)

      // Get payment method
      const { data: pm } = await supabase.from('payment_methods').select('*').eq('business_id', business.id).single()

      let paymentInfo = ''
      if (pm?.type === 'qr') {
        paymentInfo = `\n\n💳 *Payment:* Please transfer RM${orderData.total?.toFixed(2)} and send your receipt as a photo here.\nQR Code: ${pm.qr_url || 'Contact owner'}`
      } else if (pm?.type === 'bank') {
        paymentInfo = `\n\n💳 *Payment:* Please transfer RM${orderData.total?.toFixed(2)} to:\n🏦 ${pm.bank_name}\n📋 Account: ${pm.account_number}\n👤 ${pm.account_holder}\n\nThen send your receipt as a photo here.`
      }

      const cleanReply = reply.replace(/<ORDER_CONFIRMED>[\s\S]*?<\/ORDER_CONFIRMED>/, '').trim()
      reply = (cleanReply || `✅ Order confirmed! Total: RM${orderData.total?.toFixed(2)}`) + paymentInfo
    } catch {
      // Parse failed, send original reply
    }
  }

  // Save AI reply
  await supabase.from('messages').insert({
    business_id: business.id,
    sender: 'ai',
    message_text: reply,
    channel: 'telegram',
  })

  // Log escalation
  if (escalation !== 'low') {
    await supabase.from('ai_actions').insert({
      business_id: business.id,
      action_type: `telegram_escalation_${escalation}`,
      status: escalation === 'high' ? 'requires_human' : 'handled',
      result: `Telegram msg from ${customerName}: "${text.substring(0, 100)}"`,
    })
  }

  await sendTelegramMessage(botToken, chatId, reply)
  return NextResponse.json({ ok: true })
}
