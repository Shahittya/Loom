'use client'
import { useState, useRef, useEffect } from 'react'
import { ShoppingCart, Plus, Minus, X, MessageSquare, Bot, Tag, Send, ChevronDown, Building2, Ticket, MapPin, Package, Store, Clock, Calendar, CheckCircle2, Phone } from 'lucide-react'
import { Item, Business, BusinessSettings, PaymentMethod } from '@/lib/types'
import toast from 'react-hot-toast'

interface CartItem extends Item {
  qty: number
  discountedPrice: number | null
}

interface Promo {
  id: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses: number | null
  current_uses: number
}

interface ItemWithPromo extends Item {
  discount_type?: string | null
  discount_value?: number | null
  promo_label?: string | null
}

interface Props {
  business: Business
  settings: BusinessSettings | null
  items: Item[]
  payment: PaymentMethod | null
  promos: Promo[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function StoreClient({ business, settings, items, payment }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({ name: '', contact: '', address: '', notes: '', email: '' })
  const [receiptUrl, setReceiptUrl] = useState('')
  const [placing, setPlacing] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [showFpx, setShowFpx] = useState(false)
  const [selectedBank, setSelectedBank] = useState('')
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery')

  // Service booking state
  const [bookingService, setBookingService] = useState<Item | null>(null)
  const [bookingForm, setBookingForm] = useState({ name: '', contact: '', address: '', notes: '', date: '', timeSlot: '' })
  const [bookingPlacing, setBookingPlacing] = useState(false)
  const [bookingPlaced, setBookingPlaced] = useState<string | null>(null) // service name on success

  const isServiceBusiness = business.category === 'service'
  const isDigitalBusiness = business.category === 'digital'

  const DELIVERY_FEE = 5
  // Promo code state
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<Promo | null>(null)

  // Chatbot state
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: `Hi! 👋 I'm the assistant for **${business.name}**. Ask me anything — menu, promos, prices, or how to order!` }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, showChat])

  const categoryEmoji: Record<string, string> = { food: '🍔', physical: '📦', digital: '💻', service: '🔧' }

  function getDiscountedPrice(item: ItemWithPromo): number | null {
    if (!item.discount_type || !item.discount_value) return null
    if (item.discount_type === 'percentage') return item.price * (1 - item.discount_value / 100)
    if (item.discount_type === 'fixed') return Math.max(0, item.price - item.discount_value)
    return null
  }

  function addToCart(item: Item) {
    const i = item as ItemWithPromo
    const discountedPrice = getDiscountedPrice(i)
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1, discountedPrice }]
    })
    toast.success(`${item.name} added!`)
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c))
  }

  const subtotal = cart.reduce((s, c) => s + (c.discountedPrice ?? c.price) * c.qty, 0)
  const promoDiscount = appliedPromo
    ? appliedPromo.discount_type === 'percentage'
      ? subtotal * (appliedPromo.discount_value / 100)
      : Math.min(appliedPromo.discount_value, subtotal)
    : 0
  const deliveryFee = isDigitalBusiness ? 0 : (deliveryType === 'delivery' ? DELIVERY_FEE : 0)
  const total = Math.max(0, subtotal - promoDiscount + deliveryFee)
  const itemCount = cart.reduce((s, c) => s + c.qty, 0)

  function getServiceSlots(item: Item): string[] {
    const raw = (item as Item & { promo_label?: string }).promo_label
    if (!raw || !raw.includes('-')) return []
    const [from, to] = raw.split('-')
    const slots: string[] = []
    const [fh, fm] = from.split(':').map(Number)
    const [th, tm] = to.split(':').map(Number)
    let cur = fh * 60 + (fm || 0)
    const end = th * 60 + (tm || 0)
    while (cur < end) {
      const h = Math.floor(cur / 60)
      const m = cur % 60
      const ampm = h >= 12 ? 'PM' : 'AM'
      const hr = h > 12 ? h - 12 : h === 0 ? 12 : h
      slots.push(`${hr}:${m.toString().padStart(2, '0')} ${ampm}`)
      cur += 60
    }
    return slots
  }

  function getServiceHoursLabel(item: Item): string {
    const raw = (item as Item & { promo_label?: string }).promo_label
    if (!raw || !raw.includes('-')) return ''
    const [from, to] = raw.split('-')
    const fmt = (t: string) => {
      const [h, m] = t.split(':')
      const hr = parseInt(h)
      return `${hr > 12 ? hr - 12 : hr === 0 ? 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
    }
    return `${fmt(from)} – ${fmt(to)}`
  }

  async function placeBooking() {
    if (!bookingService) return
    if (!bookingForm.name || !bookingForm.contact) { toast.error('Please fill in your name and phone number'); return }
    if (!bookingForm.date) { toast.error('Please select a preferred date'); return }
    if (!bookingForm.timeSlot) { toast.error('Please select a time slot'); return }
    setBookingPlacing(true)
    const notes = `📅 ${bookingForm.date} at ${bookingForm.timeSlot}${bookingForm.notes ? ` | Note: ${bookingForm.notes}` : ''}`
    const res = await fetch('/api/store/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        customerName: bookingForm.name,
        customerContact: bookingForm.contact,
        deliveryAddress: bookingForm.address || 'To be confirmed',
        notes,
        receiptUrl: null,
        cart: [{ item_id: bookingService.id, quantity: 1, price: bookingService.price }],
        total: bookingService.price,
        promoCode: null,
        discountAmount: 0,
      }),
    })
    const data = await res.json()
    if (data.success) {
      setBookingPlaced(bookingService.name)
      setBookingService(null)
      setBookingForm({ name: '', contact: '', address: '', notes: '', date: '', timeSlot: '' })
    } else {
      toast.error('Booking failed. Please try again.')
    }
    setBookingPlacing(false)
  }

  function openBooking(item: Item) {
    setBookingService(item)
    setBookingForm({ name: '', contact: '', address: '', notes: '', date: '', timeSlot: '' })
  }

  function todayString() {
    return new Date().toISOString().split('T')[0]
  }

  const [applyingPromo, setApplyingPromo] = useState(false)

  async function applyPromo() {
    const code = promoInput.trim()
    if (!code) { toast.error('Enter a promo code first'); return }
    setApplyingPromo(true)
    try {
      const res = await fetch(`/api/store/promo?code=${encodeURIComponent(code)}&businessId=${business.id}`)
      const data = await res.json()
      if (!data.valid) {
        toast.error(data.error || 'Invalid promo code')
        return
      }
      setAppliedPromo(data.promo)
      toast.success(`Promo applied! ${data.promo.discount_type === 'percentage' ? `${data.promo.discount_value}% off` : `RM${data.promo.discount_value} off`}`)
    } catch {
      toast.error('Could not validate promo code. Try again.')
    } finally {
      setApplyingPromo(false)
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    setChatInput('')
    const newHistory: ChatMessage[] = [...chatMessages, { role: 'user', content: userMsg }]
    setChatMessages(newHistory)
    setChatLoading(true)
    try {
      const res = await fetch('/api/store/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, message: userMsg, history: chatMessages.slice(-8) }),
      })
      const data = await res.json()
      setChatMessages([...newHistory, { role: 'assistant', content: data.reply || 'Sorry, I could not respond.' }])
    } catch {
      setChatMessages([...newHistory, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    }
    setChatLoading(false)
  }

  async function placeOrder() {
    if (!checkoutForm.name || !checkoutForm.contact) {
      toast.error('Please fill in your name and phone number')
      return
    }
    if (isDigitalBusiness && !checkoutForm.email.trim()) {
      toast.error('Please enter your email address')
      return
    }
    if (!isDigitalBusiness && deliveryType === 'delivery' && !checkoutForm.address.trim()) {
      toast.error('Please enter your delivery address')
      return
    }
    setPlacing(true)

    const res = await fetch('/api/store/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: business.id,
        customerName: checkoutForm.name,
        customerContact: checkoutForm.contact,
        deliveryAddress: isDigitalBusiness ? `Email: ${checkoutForm.email}` : (deliveryType === 'delivery' ? checkoutForm.address : 'Self Pickup'),
        notes: checkoutForm.notes,
        receiptUrl,
        cart: cart.map(c => ({ item_id: c.id, quantity: c.qty, price: c.discountedPrice ?? c.price })),
        total,
        promoCode: appliedPromo?.code || null,
        discountAmount: promoDiscount,
      }),
    })

    const data = await res.json()
    if (data.success) {
      setOrderPlaced(true)
      setCart([])
      setAppliedPromo(null)
      setShowCheckout(false)
    } else {
      console.error('Order error:', data.error)
      toast.error(data.error ? `Order failed: ${data.error}` : 'Failed to place order. Please try again.')
    }
    setPlacing(false)
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Package className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Order Placed! 🎉</h1>
          <p className="text-gray-500 mb-1">Thank you, your order has been received by</p>
          <p className="font-bold text-violet-600 mb-4">{business.name}</p>
          <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 space-y-2 text-sm">
            {isDigitalBusiness ? (
              <div className="flex justify-between">
                <span className="text-gray-500">Delivery</span>
                <span className="font-semibold">📧 Sent to your email</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-500">Fulfilment</span>
                <span className="font-semibold">{deliveryType === 'delivery' ? '🚴 Delivery' : '🏪 Self Pickup'}</span>
              </div>
            )}
            {settings?.landing_contact && (
              <div className="flex justify-between">
                <span className="text-gray-500">Contact seller</span>
                <span className="font-semibold">{settings.landing_contact}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-5">{isDigitalBusiness ? 'The seller will send your purchase details to your email.' : 'The seller will contact you on your phone number to confirm.'}</p>
          <button onClick={() => setOrderPlaced(false)} className="btn-primary w-full">Continue Shopping</button>
        </div>
      </div>
    )
  }

  if (bookingPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-violet-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Booking Confirmed! 🎉</h1>
          <p className="text-gray-500 mb-1">Your booking for</p>
          <p className="font-bold text-violet-600 mb-1">{bookingPlaced}</p>
          <p className="text-gray-500 mb-4">has been sent to <strong>{business.name}</strong></p>
          {settings?.landing_contact && (
            <div className="bg-violet-50 rounded-xl p-3 mb-5 text-sm text-violet-700">
              📞 The team will contact you at your number to confirm the appointment.
              <br />Contact: <strong>{settings.landing_contact}</strong>
            </div>
          )}
          <button onClick={() => setBookingPlaced(null)} className="btn-primary w-full">Browse More Services</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{categoryEmoji[business.category]}</span>
            <div>
              <h1 className="font-extrabold text-gray-900 text-lg">{business.name}</h1>
              <p className="text-xs text-gray-400 capitalize">{business.category} business</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {settings?.telegram_username && (
              <a
                href={`https://t.me/${settings.telegram_username.replace('@', '')}`}
                target="_blank"
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <MessageSquare className="w-4 h-4" />
                Chat with us
              </a>
            )}
            <button
              onClick={() => setShowCart(true)}
              className="relative btn-primary flex items-center gap-2 text-sm py-2"
            >
              <ShoppingCart className="w-4 h-4" />
              Cart
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Items */}
        <h2 className="font-extrabold text-gray-900 text-xl mb-5">
          {business.category === 'food' ? 'Our Menu' : business.category === 'service' ? 'Our Services' : 'Products'}
        </h2>

        {items.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-gray-400">No items available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map(item => {
              const inCart = cart.find(c => c.id === item.id)
              const slots = isServiceBusiness ? getServiceSlots(item) : []
              const hoursLabel = isServiceBusiness ? getServiceHoursLabel(item) : ''
              return (
                <div key={item.id} className="card group flex flex-col">
                  {item.image_url && (
                    <div className="h-44 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-2xl">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{item.name}</h3>
                    {(item as ItemWithPromo).promo_label && !(item as ItemWithPromo).promo_label!.includes('-') && (
                      <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 font-semibold px-2 py-0.5 rounded-full mt-1">
                        <Tag className="w-3 h-3" />{(item as ItemWithPromo).promo_label}
                      </span>
                    )}
                    {item.description && <p className="text-sm text-gray-500 mt-1">{item.description}</p>}
                    {isServiceBusiness ? (
                      <div className="mt-2 space-y-1">
                        {item.type && item.type !== 'product' && item.type !== 'service' && (
                          <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{item.type}</p>
                        )}
                        {hoursLabel && (
                          <p className="text-xs text-violet-600 font-medium flex items-center gap-1"><Clock className="w-3 h-3" />{hoursLabel}</p>
                        )}
                        {slots.length > 0 && (
                          <p className="text-xs text-gray-400">{slots.length} time slot{slots.length !== 1 ? 's' : ''} available</p>
                        )}
                      </div>
                    ) : (
                      item.stock !== null && <p className="text-xs text-gray-400 mt-1">Stock: {item.stock}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <div>
                      {!isServiceBusiness && getDiscountedPrice(item as ItemWithPromo) !== null ? (
                        <>
                          <p className="text-xs text-gray-400 line-through">RM {item.price.toFixed(2)}</p>
                          <p className="font-extrabold text-orange-500 text-lg">RM {getDiscountedPrice(item as ItemWithPromo)!.toFixed(2)}</p>
                        </>
                      ) : (
                        <p className="font-extrabold text-violet-600 text-lg">RM {item.price.toFixed(2)}</p>
                      )}
                    </div>
                    {isServiceBusiness ? (
                      <button
                        onClick={() => openBooking(item)}
                        className="btn-primary text-sm py-2 px-5 flex items-center gap-1.5"
                      >
                        <Calendar className="w-4 h-4" /> Book Now
                      </button>
                    ) : inCart ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold w-5 text-center">{inCart.qty}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 bg-violet-600 hover:bg-violet-700 text-white rounded-full flex items-center justify-center transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(item)} className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {(settings?.landing_description || settings?.landing_contact || settings?.telegram_username) && (
        <footer className="bg-gray-900 text-white mt-12">
          <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="flex flex-col sm:flex-row gap-10 sm:gap-16">
              {/* About — Left */}
              {settings?.landing_description && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{categoryEmoji[business.category]}</span>
                    <h3 className="font-extrabold text-white text-xl">{business.name}</h3>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed text-justify">{settings.landing_description}</p>
                </div>
              )}
              {/* Divider on desktop */}
              {settings?.landing_description && (settings?.landing_contact || settings?.telegram_username) && (
                <div className="hidden sm:block w-px bg-gray-800 self-stretch" />
              )}
              {/* Contact — Right */}
              {(settings?.landing_contact || settings?.telegram_username) && (
                <div className="sm:w-56 flex-shrink-0">
                  <h3 className="font-bold text-white text-base mb-5 uppercase tracking-widest text-xs text-gray-400">Contact Us</h3>
                  <div className="space-y-4">
                    {settings?.landing_contact && (
                      <a
                        href={`tel:${settings.landing_contact}`}
                        className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center group-hover:bg-violet-600 transition-colors flex-shrink-0">
                          <Phone className="w-4 h-4 text-violet-400 group-hover:text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Phone</p>
                          <p className="font-semibold text-sm text-white">{settings.landing_contact}</p>
                        </div>
                      </a>
                    )}
                    {settings?.telegram_username && (
                      <a
                        href={`https://t.me/${settings.telegram_username.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600 transition-colors flex-shrink-0">
                          <MessageSquare className="w-4 h-4 text-blue-400 group-hover:text-white" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Telegram</p>
                          <p className="font-semibold text-sm text-white">{settings.telegram_username}</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-gray-600">© {new Date().getFullYear()} {business.name}. All rights reserved.</p>
              <p className="text-xs text-gray-700">Powered by <span className="text-violet-400 font-semibold">LOOM</span></p>
            </div>
          </div>
        </footer>
      )}

      {/* Floating chatbot button */}
      <div className="fixed bottom-6 right-6 z-30">
        {!showChat && (
          <>
            <span className="absolute inset-0 rounded-full bg-violet-400 opacity-75 animate-ping" />
            <span className="absolute inset-0 rounded-full bg-violet-500 opacity-40 scale-110" />
          </>
        )}
        <button
          onClick={() => setShowChat(c => !c)}
          className="relative w-14 h-14 rounded-full flex items-center justify-center text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #7c3aed 100%)',
            boxShadow: showChat ? '0 4px 15px rgba(124,58,237,0.4)' : '0 0 0 4px rgba(167,139,250,0.3), 0 0 20px rgba(124,58,237,0.6), 0 4px 15px rgba(0,0,0,0.2)',
          }}
        >
          {showChat ? <ChevronDown className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
        </button>
      </div>

      {/* Chatbot Widget */}
      {showChat && (
        <div className="fixed bottom-24 right-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-40 flex flex-col overflow-hidden" style={{ maxHeight: '480px' }}>
          <div className="bg-violet-600 text-white p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sm">{business.name} AI</p>
              <p className="text-xs text-violet-200">Ask me anything!</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0, maxHeight: '300px' }}>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              className="input flex-1 text-sm py-2"
              placeholder="Ask about menu, promos..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
            />
            <button
              onClick={sendChatMessage}
              disabled={chatLoading || !chatInput.trim()}
              className="btn-primary p-2 aspect-square disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Service Booking Modal */}
      {bookingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Book Service</h2>
                  <p className="text-sm text-violet-600 font-medium">{bookingService.name}</p>
                </div>
                <button onClick={() => setBookingService(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Service summary */}
              <div className="bg-violet-50 rounded-xl p-4 mb-5 flex items-start gap-3">
                {bookingService.image_url && (
                  <img src={bookingService.image_url} alt={bookingService.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                )}
                <div>
                  <p className="font-bold text-gray-900 text-sm">{bookingService.name}</p>
                  {bookingService.description && <p className="text-xs text-gray-500 mt-0.5">{bookingService.description}</p>}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-xs font-bold text-violet-700">RM {bookingService.price.toFixed(2)}</span>
                    {bookingService.type && bookingService.type !== 'product' && bookingService.type !== 'service' && (
                      <span className="text-xs text-gray-400 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{bookingService.type}</span>
                    )}
                    {getServiceHoursLabel(bookingService) && (
                      <span className="text-xs text-violet-600 flex items-center gap-0.5"><Clock className="w-3 h-3" />{getServiceHoursLabel(bookingService)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name *</label>
                  <input className="input" value={bookingForm.name} onChange={e => setBookingForm({ ...bookingForm, name: e.target.value })} placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number *</label>
                  <input className="input" type="tel" value={bookingForm.contact} onChange={e => setBookingForm({ ...bookingForm, contact: e.target.value })} placeholder="e.g. 0123456789" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Location / Address</label>
                  <textarea className="input resize-none h-16" value={bookingForm.address} onChange={e => setBookingForm({ ...bookingForm, address: e.target.value })} placeholder="Where should the service be done? (optional)" />
                </div>

                {/* Date picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <Calendar className="w-4 h-4 inline mr-1 text-violet-500" />Preferred Date *
                  </label>
                  <input
                    type="date"
                    className="input"
                    min={todayString()}
                    value={bookingForm.date}
                    onChange={e => setBookingForm({ ...bookingForm, date: e.target.value, timeSlot: '' })}
                  />
                </div>

                {/* Time slot picker */}
                {bookingForm.date && (() => {
                  const slots = getServiceSlots(bookingService)
                  return slots.length > 0 ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Clock className="w-4 h-4 inline mr-1 text-violet-500" />Select Time Slot *
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map(slot => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setBookingForm({ ...bookingForm, timeSlot: slot })}
                            className={`py-2.5 px-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                              bookingForm.timeSlot === slot
                                ? 'border-violet-500 bg-violet-600 text-white shadow-md scale-105'
                                : 'border-gray-200 text-gray-700 hover:border-violet-300 hover:bg-violet-50'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                      No specific time slots set for this service. We will contact you to confirm a time.
                    </div>
                  )
                })()}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes</label>
                  <input className="input" value={bookingForm.notes} onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })} placeholder="Any special requests or details..." />
                </div>

                {/* Summary */}
                {bookingForm.date && bookingForm.timeSlot && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                    <p className="font-semibold text-green-800 mb-1">📋 Booking Summary</p>
                    <p className="text-green-700">📅 {bookingForm.date} at <strong>{bookingForm.timeSlot}</strong></p>
                    <p className="text-green-700 font-bold mt-0.5">Total: RM {bookingService.price.toFixed(2)}</p>
                  </div>
                )}

                <button
                  onClick={placeBooking}
                  disabled={bookingPlacing || !bookingForm.name || !bookingForm.contact || !bookingForm.date || !bookingForm.timeSlot}
                  className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Calendar className="w-5 h-5" />
                  {bookingPlacing ? 'Confirming Booking...' : 'Confirm Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowCart(false)} />
          <div className="w-full max-w-sm bg-white flex flex-col shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-lg">Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Your cart is empty</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                      {item.discountedPrice !== null ? (
                        <p className="text-xs"><span className="text-gray-400 line-through">RM {item.price.toFixed(2)}</span> <span className="text-orange-500 font-semibold">RM {item.discountedPrice.toFixed(2)}</span></p>
                      ) : (
                        <p className="text-xs text-gray-400">RM {item.price.toFixed(2)} each</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-bold text-sm w-4 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 bg-violet-600 text-white hover:bg-violet-700 rounded-full flex items-center justify-center">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">RM {((item.discountedPrice ?? item.price) * item.qty).toFixed(2)}</p>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-500 mt-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-5 border-t border-gray-100">
                {promoDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 mb-1">
                    <span>Promo ({appliedPromo?.code})</span>
                    <span>- RM {promoDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-gray-900 text-lg mb-1">
                  <span>Total</span>
                  <span className="text-violet-600">RM {(subtotal - promoDiscount).toFixed(2)}</span>
                </div>
                {!isDigitalBusiness && <p className="text-xs text-gray-400 mb-4">Delivery fee calculated at checkout</p>}
                <button onClick={() => { setShowCart(false); setShowCheckout(true) }} className="btn-primary w-full">
                  Proceed to Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Checkout</h2>
                <button onClick={() => setShowCheckout(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Fulfilment Method — hidden for digital */}
                {!isDigitalBusiness && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fulfilment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDeliveryType('delivery')}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          deliveryType === 'delivery'
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <MapPin className="w-5 h-5" />
                        <span className="text-sm font-semibold">Delivery</span>
                        <span className="text-xs">+RM 5.00</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryType('pickup')}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          deliveryType === 'pickup'
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <Store className="w-5 h-5" />
                        <span className="text-sm font-semibold">Self Pickup</span>
                        <span className="text-xs">Free</span>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name *</label>
                  <input className="input" value={checkoutForm.name} onChange={e => setCheckoutForm({ ...checkoutForm, name: e.target.value })} placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number *</label>
                  <input className="input" type="tel" value={checkoutForm.contact} onChange={e => setCheckoutForm({ ...checkoutForm, contact: e.target.value })} placeholder="e.g. 0123456789" />
                </div>

                {/* Email — only for digital */}
                {isDigitalBusiness && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">📧 Email Address *</label>
                    <input
                      className="input"
                      type="email"
                      value={checkoutForm.email}
                      onChange={e => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                      placeholder="your@email.com"
                    />
                    <p className="text-xs text-gray-400 mt-1">Your purchase details will be sent to this email.</p>
                  </div>
                )}

                {/* Address — only for non-digital delivery */}
                {!isDigitalBusiness && deliveryType === 'delivery' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Address *</label>
                    <textarea
                      className="input resize-none h-20"
                      value={checkoutForm.address}
                      onChange={e => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                      placeholder="Street, area, postcode, city..."
                    />
                    <a
                      href="https://maps.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-1.5"
                    >
                      <MapPin className="w-3 h-3" /> Find my address on Google Maps
                    </a>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes for Seller</label>
                  <input className="input" value={checkoutForm.notes} onChange={e => setCheckoutForm({ ...checkoutForm, notes: e.target.value })} placeholder="Any special requests..." />
                </div>

                {/* Promo code — always visible */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-violet-500" /> Promo Code
                  </label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-green-700">{appliedPromo.code} applied! 🎉</p>
                        <p className="text-xs text-green-600">{appliedPromo.discount_type === 'percentage' ? `${appliedPromo.discount_value}% off` : `RM${appliedPromo.discount_value} off`}</p>
                      </div>
                      <button onClick={() => { setAppliedPromo(null); setPromoInput('') }} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder="Enter promo code (optional)"
                        value={promoInput}
                        onChange={e => setPromoInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !applyingPromo && applyPromo()}
                      />
                      <button onClick={applyPromo} disabled={applyingPromo} className="btn-secondary text-sm px-4 disabled:opacity-60">{applyingPromo ? '...' : 'Apply'}</button>
                    </div>
                  )}
                </div>

                {/* Payment section */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">💳 Payment — <span className="text-violet-600">RM {total.toFixed(2)}</span></p>

                  {/* Owner's configured payment */}
                  {payment && (
                    <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
                      {payment.type === 'qr' && payment.qr_url ? (
                        <div className="text-center">
                          <p className="text-sm font-medium text-violet-700 mb-2">📷 Scan QR to pay</p>
                          <img src={payment.qr_url} alt="QR Code" className="w-36 h-36 object-contain mx-auto rounded-lg border border-violet-200" />
                        </div>
                      ) : payment.type === 'bank' ? (
                        <div className="text-sm text-violet-700 space-y-1">
                          <p className="font-medium mb-2">🏦 Bank Transfer</p>
                          <p>Bank: <strong>{payment.bank_name}</strong></p>
                          <p>Account: <strong>{payment.account_number}</strong></p>
                          <p>Name: <strong>{payment.account_holder}</strong></p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* FPX Online Banking mockup */}
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4">
                    <button
                      type="button"
                      onClick={() => setShowFpx(true)}
                      className="w-full flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800 text-sm">Pay with Online Banking</p>
                          <p className="text-xs text-gray-400">FPX · All major banks supported</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg group-hover:bg-blue-100">Select →</span>
                    </button>
                    {selectedBank && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-sm text-gray-600">Selected: <strong className="text-gray-900">{selectedBank}</strong></p>
                        <button onClick={() => setSelectedBank('')} className="text-xs text-red-400">Change</button>
                      </div>
                    )}
                  </div>

                  {/* Receipt upload */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Payment receipt / proof (optional)</label>
                    <input className="input text-xs" value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)} placeholder="Paste image URL of your receipt" />
                  </div>
                </div>

                {/* Order summary */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Order Summary</p>
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-sm py-1">
                      <span className="text-gray-600">{item.name} × {item.qty}</span>
                      <span className="font-medium">RM {((item.discountedPrice ?? item.price) * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 mt-2 pt-2 space-y-1">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span><span>RM {subtotal.toFixed(2)}</span>
                    </div>
                    {promoDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Promo ({appliedPromo?.code})</span>
                        <span>- RM {promoDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Delivery</span>
                      <span>{deliveryFee > 0 ? `RM ${deliveryFee.toFixed(2)}` : <span className="text-green-600 font-medium">Free</span>}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-gray-900 pt-1 border-t border-gray-200 mt-1">
                      <span>Total</span>
                      <span className="text-violet-600">RM {total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <button onClick={placeOrder} disabled={placing} className="btn-primary w-full mt-2 disabled:opacity-60 py-3 text-base">
                  {placing ? 'Placing Order...' : `Place Order — RM ${total.toFixed(2)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FPX Bank Selection Modal */}
      {showFpx && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-blue-600 p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Online Banking (FPX)</p>
                <p className="text-blue-200 text-xs">Select your bank to continue</p>
              </div>
              <button onClick={() => setShowFpx(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {[
                'Maybank2u', 'CIMB Clicks', 'RHB Now', 'Public Bank',
                'Hong Leong Bank', 'AmOnline', 'Bank Islam', 'Bank Rakyat',
                'Affin Bank', 'Alliance Bank', 'OCBC Bank', 'UOB Bank',
              ].map(bank => (
                <button
                  key={bank}
                  onClick={() => { setSelectedBank(bank); setShowFpx(false); toast.success(`${bank} selected`) }}
                  className={`p-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${
                    selectedBank === bank
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-100 hover:border-blue-200 hover:bg-blue-50 text-gray-700'
                  }`}
                >
                  {bank}
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 text-center">You will be redirected to your bank&apos;s secure payment page</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
