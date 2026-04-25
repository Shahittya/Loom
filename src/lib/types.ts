export type BusinessCategory = 'food' | 'physical' | 'digital' | 'service'
export type BusinessMode = 'landing' | 'telegram' | 'both'

export interface Profile {
  id: string
  name: string
  role: 'owner' | 'admin'
  status: string
  created_at: string
}

export interface Business {
  id: string
  user_id: string
  name: string
  category: BusinessCategory
  mode: BusinessMode
  status: string
  created_at: string
}

export interface Item {
  id: string
  business_id: string
  name: string
  description: string
  price: number
  type: string
  stock: number | null
  image_url: string | null
  available: boolean
  created_at: string
}

export interface Order {
  id: string
  business_id: string
  customer_name: string
  customer_contact: string
  customer_telegram_id?: string
  total_price: number
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  notes: string | null
  delivery_address: string | null
  channel: 'web' | 'telegram'
  receipt_url: string | null
  created_at: string
  order_items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  item_id: string
  quantity: number
  price: number
  item?: Item
}

export interface Message {
  id: string
  business_id: string
  sender: 'customer' | 'ai' | 'owner'
  message_text: string
  session_id: string | null
  channel: 'web' | 'telegram'
  created_at: string
}

export interface PaymentMethod {
  id: string
  business_id: string
  type: 'qr' | 'bank'
  qr_url: string | null
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
}

export interface BusinessSettings {
  id: string
  business_id: string
  telegram_bot_token: string | null
  telegram_username: string | null
  landing_enabled: boolean
  landing_description: string | null
  landing_image_url: string | null
  landing_contact: string | null
}

export interface AiInsight {
  id: string
  business_id: string
  type: string
  content: string
  created_at: string
}

export interface NavItem {
  label: string
  href: string
  icon: string
}
