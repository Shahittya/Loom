import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { success: false, error: 'Supabase environment variables are missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const body = await req.json()
  const { businessId, customerName, customerContact, deliveryAddress, notes, receiptUrl, cart, total, promoCode, discountAmount } = body

  if (!businessId || !customerName || !cart?.length) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      business_id: businessId,
      customer_name: customerName,
      customer_contact: customerContact,
      delivery_address: deliveryAddress || null,
      notes: notes || null,
      receipt_url: receiptUrl || null,
      total_price: total,
      status: 'pending',
      channel: 'web',
      promo_code: promoCode || null,
      discount_amount: discountAmount || 0,
    })
    .select()
    .single()

  if (error || !order) {
    console.error('Order insert error:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Insert failed' }, { status: 500 })
  }

  const orderItems = cart.map((c: { item_id: string; quantity: number; price: number }) => ({
    order_id: order.id,
    item_id: c.item_id,
    quantity: c.quantity,
    price: c.price,
  }))

  await supabase.from('order_items').insert(orderItems)

  // Increment promo usage if a promo code was applied
  if (promoCode) {
    await supabase.rpc('increment_promo_uses', { promo_code: promoCode, bid: businessId })
  }

  return NextResponse.json({ success: true, orderId: order.id })
}
