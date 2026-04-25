import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!business) return NextResponse.json({ error: 'No business' }, { status: 404 })

  const [ordersRes, itemsRes, orderItemsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total_price, status, channel, created_at')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('items')
      .select('id, name')
      .eq('business_id', business.id),
    supabase
      .from('order_items')
      .select('item_id, quantity, order_id'),
  ])

  const orders = ordersRes.data || []
  const items = itemsRes.data || []
  const orderItems = orderItemsRes.data || []

  const validOrders = orders.filter(o => o.status !== 'cancelled')
  const totalOrders = orders.length
  const totalRevenue = validOrders.reduce((s, o) => s + (o.total_price || 0), 0)
  const pendingOrders = orders.filter(o => o.status === 'pending').length
  const totalItems = items.length

  // Last 7 days
  const today = new Date()
  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
  const recentDayStats = recentDays.map(date => {
    const dayOrders = orders.filter(o => o.created_at.startsWith(date) && o.status !== 'cancelled')
    return {
      date,
      count: orders.filter(o => o.created_at.startsWith(date)).length,
      revenue: dayOrders.reduce((s, o) => s + (o.total_price || 0), 0),
    }
  })

  // Channel breakdown
  const channelBreakdown = {
    web: orders.filter(o => o.channel === 'web').length,
    telegram: orders.filter(o => o.channel === 'telegram').length,
  }

  // Top items by quantity ordered
  const itemMap: Record<string, { name: string; count: number }> = {}
  const orderIdSet = new Set(orders.map(o => o.id))
  for (const oi of orderItems) {
    if (!orderIdSet.has(oi.order_id)) continue
    const item = items.find(i => i.id === oi.item_id)
    if (!item) continue
    if (!itemMap[oi.item_id]) itemMap[oi.item_id] = { name: item.name, count: 0 }
    itemMap[oi.item_id].count += oi.quantity || 1
  }
  const topItems = Object.values(itemMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return NextResponse.json({
    totalOrders,
    totalRevenue,
    pendingOrders,
    totalItems,
    recentDays: recentDayStats,
    channelBreakdown,
    topItems,
  })
}
