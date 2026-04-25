import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShoppingBag, Package, TrendingUp, ArrowUpRight, Clock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { categoryLabels } from '@/lib/nav'
import NewUserSetupBanner from '@/components/NewUserSetupBanner'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  const [ordersRes, itemsRes] = await Promise.all([
    supabase.from('orders').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('items').select('count').eq('business_id', business.id),
  ])

  const orders = ordersRes.data || []
  const totalOrders = orders.length
  const totalRevenue = orders.filter(o => o.status !== 'cancelled').reduce((s: number, o: { total_price: number }) => s + (o.total_price || 0), 0)
  const pendingOrders = orders.filter((o: { status: string }) => o.status === 'pending').length
  const itemCount = (itemsRes.data as { count: number }[] | null)?.[0]?.count || 0

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    confirmed: 'bg-blue-50 text-blue-700',
    preparing: 'bg-orange-50 text-orange-700',
    ready: 'bg-cyan-50 text-cyan-700',
    delivered: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-700',
  }

  return (
    <div className="p-8">
      <NewUserSetupBanner userId={user.id} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">
          Welcome back 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {business.name} · {categoryLabels[business.category as keyof typeof categoryLabels]}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { label: 'Total Orders', value: totalOrders, icon: ShoppingBag, color: 'bg-violet-50 text-violet-600', href: '/dashboard/orders' },
          { label: 'Revenue (RM)', value: `${totalRevenue.toFixed(2)}`, icon: TrendingUp, color: 'bg-green-50 text-green-600', href: '/dashboard/orders' },
          { label: 'Pending', value: pendingOrders, icon: Clock, color: 'bg-amber-50 text-amber-600', href: '/dashboard/orders' },
          { label: 'Items Listed', value: itemCount, icon: Package, color: 'bg-blue-50 text-blue-600', href: '/dashboard/items' },
        ].map(({ label, value, icon: Icon, color, href }) => (
          <Link key={label} href={href} className="card hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors" />
            </div>
            <p className="text-2xl font-extrabold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-sm text-violet-600 hover:underline font-medium">
            View all
          </Link>
        </div>
          {orders.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No orders yet. Share your store link to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order: { id: string; customer_name: string; total_price: number; status: string; created_at: string; channel: string }) => (
                <div key={order.id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{order.customer_name}</p>
                    <p className="text-xs text-gray-400">{format(new Date(order.created_at), 'MMM d, h:mm a')} · {order.channel}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 text-sm">RM {order.total_price?.toFixed(2)}</p>
                    <span className={`badge text-xs mt-0.5 ${statusColors[order.status] || 'bg-gray-100 text-gray-600'}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  )
}
