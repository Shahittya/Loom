import { BusinessCategory } from './types'
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed,
  MessageSquare, Package, Send, Download, Users,
  Calendar, Wrench, TrendingUp, Settings, LogOut, Megaphone
} from 'lucide-react'

export function getNavItems(category: BusinessCategory) {
  const common = [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
    { label: 'Chat', href: '/dashboard/chat', icon: 'MessageSquare' },
    { label: 'AI Marketing', href: '/dashboard/marketing', icon: 'TrendingUp' },
    { label: 'AI Campaign', href: '/dashboard/campaign', icon: 'Megaphone' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
  ]

  const categoryItems: Record<BusinessCategory, { label: string; href: string; icon: string }[]> = {
    food: [
      { label: 'Orders', href: '/dashboard/orders', icon: 'ShoppingBag' },
      { label: 'Menu', href: '/dashboard/items', icon: 'UtensilsCrossed' },
    ],
    physical: [
      { label: 'Orders', href: '/dashboard/orders', icon: 'ShoppingBag' },
      { label: 'Inventory', href: '/dashboard/items', icon: 'Package' },
    ],
    digital: [
      { label: 'Products', href: '/dashboard/items', icon: 'Package' },
      { label: 'Downloads', href: '/dashboard/orders', icon: 'Download' },
      { label: 'Customers', href: '/dashboard/customers', icon: 'Users' },
    ],
    service: [
      { label: 'Bookings', href: '/dashboard/orders', icon: 'Calendar' },
      { label: 'Services', href: '/dashboard/items', icon: 'Wrench' },
      { label: 'Customers', href: '/dashboard/customers', icon: 'Users' },
    ],
  }

  const merged = [common[0], ...categoryItems[category], ...common.slice(1)]
  return merged
}

export const iconMap: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  MessageSquare,
  Package,
  Send,
  Download,
  Users,
  Calendar,
  Wrench,
  TrendingUp,
  Megaphone,
  Settings,
  LogOut,
}

export const categoryLabels: Record<BusinessCategory, string> = {
  food: '🍔 Food & Beverage',
  physical: '📦 Physical Products',
  digital: '💻 Digital Products',
  service: '🔧 Services',
}

export const categoryColors: Record<BusinessCategory, string> = {
  food: 'bg-orange-500',
  physical: 'bg-blue-500',
  digital: 'bg-violet-500',
  service: 'bg-green-500',
}
