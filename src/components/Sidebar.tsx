'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bot, LogOut, ChevronRight } from 'lucide-react'
import { getNavItems, iconMap, categoryColors } from '@/lib/nav'
import { Business } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useState, useEffect, useRef } from 'react'

const ORDER_HREFS = ['/dashboard/orders']

export default function Sidebar({ business }: { business: Business }) {
  const pathname = usePathname()
  const router = useRouter()
  const navItems = getNavItems(business.category)
  const colorClass = categoryColors[business.category]
  const [pendingCount, setPendingCount] = useState(0)
  const prevCountRef = useRef(0)
  const supabase = createClient()

  useEffect(() => {
    fetchPending()
    const interval = setInterval(fetchPending, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  async function fetchPending() {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'pending')
    const newCount = count ?? 0
    if (newCount > prevCountRef.current && prevCountRef.current !== 0) {
      toast(`🛎️ ${newCount - prevCountRef.current} new order${newCount - prevCountRef.current > 1 ? 's' : ''}!`, { duration: 5000 })
    }
    prevCountRef.current = newCount
    setPendingCount(newCount)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Logged out')
    router.push('/')
    router.refresh()
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">LOOM</span>
        </Link>
      </div>

      {/* Business info */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center text-white text-sm font-bold mb-2`}>
          {business.name.charAt(0).toUpperCase()}
        </div>
        <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{business.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 capitalize">{business.category}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const Icon = iconMap[item.icon]
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          const showBadge = ORDER_HREFS.includes(item.href) && pendingCount > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
              {!showBadge && active && <ChevronRight className="w-3 h-3" />}
            </Link>
          )
        })}
      </nav>

      {/* Store link */}
      <div className="px-3 py-3 border-t border-gray-100">
        <Link
          href={`/store/${business.id}`}
          target="_blank"
          className="flex items-center gap-2 text-xs text-violet-600 hover:text-violet-700 font-medium px-3 py-2 hover:bg-violet-50 rounded-lg transition-colors"
        >
          <span>View Public Store</span>
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Logout */}
      <div className="px-3 pb-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
