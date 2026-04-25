'use client'
import { useState, useEffect } from 'react'
import { ShoppingBag, MapPin, MessageSquare, CheckCircle, XCircle, ChevronDown, CalendarDays, LayoutList, X, Clock, Phone, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Order } from '@/lib/types'
import toast from 'react-hot-toast'

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: { 'en-US': enUS },
})

const FILTER_TABS = ['pending', 'confirmed', 'preparing', 'ready', 'cancelled']
const ACTION_STATUSES = ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled']

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-orange-100 text-orange-700',
  ready: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const statusEventColors: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  preparing: '#f97316',
  ready: '#06b6d4',
  delivered: '#22c55e',
  cancelled: '#ef4444',
}

/** Parse booking date/time from notes like "📅 2026-04-25 at 10:00 AM | Note: ..." */
function parseBookingDate(notes: string): Date | null {
  if (!notes) return null
  const match = notes.match(/📅\s*(\d{4}-\d{2}-\d{2})\s+at\s+(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return null
  const [, dateStr, hourStr, minStr, ampm] = match
  let h = parseInt(hourStr, 10)
  const m = parseInt(minStr, 10)
  if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, h, m)
}

/** Strip the date/time prefix from notes to get clean customer notes */
function cleanNotes(notes: string): string {
  return notes.replace(/📅[^|]+\|\s*Note:\s*/i, '').replace(/📅[^|]+\|\s*/i, '').replace(/📅.+/i, '').trim()
}

interface CalendarEvent {
  title: string
  start: Date
  end: Date
  resource: Order
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isService, setIsService] = useState(false)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [selectedEvent, setSelectedEvent] = useState<Order | null>(null)
  const [calendarDate, setCalendarDate] = useState(new Date())

  const supabase = createClient()

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: biz } = await supabase.from('businesses').select('id, category').eq('user_id', user.id).single()
    if (!biz) return
    setIsService(biz.category === 'service')
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, item:items(name, price))')
      .eq('business_id', biz.id)
      .neq('status', 'delivered')
      .order('created_at', { ascending: false })
    setOrders((data as Order[]) || [])
    setLoading(false)
  }

  async function updateStatus(orderId: string, status: string) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
    if (error) { toast.error('Failed to update'); return }
    toast.success(`Order marked as ${status}`)
    if (selectedEvent?.id === orderId) setSelectedEvent(null)
    loadOrders()
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  // Build calendar events from orders that have a parseable booking date
  const calendarEvents: CalendarEvent[] = orders
    .map(order => {
      const start = parseBookingDate(order.notes || '')
      if (!start) return null
      const end = new Date(start.getTime() + 60 * 60 * 1000) // 1-hour block
      return { title: order.customer_name, start, end, resource: order } as CalendarEvent
    })
    .filter(Boolean) as CalendarEvent[]

  const eventStyleGetter = (event: CalendarEvent) => ({
    style: {
      backgroundColor: statusEventColors[event.resource.status] || '#7c3aed',
      borderRadius: '8px',
      border: 'none',
      color: 'white',
      fontSize: '0.75rem',
      fontWeight: '600',
      padding: '2px 6px',
    },
  })

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{isService ? 'Bookings' : 'Orders'}</h1>
          <p className="text-gray-500 text-sm mt-1">{filtered.length} {isService ? 'booking' : 'order'}{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {isService && (
          <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'list' ? 'bg-white shadow text-violet-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <LayoutList className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'calendar' ? 'bg-white shadow text-violet-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarDays className="w-4 h-4" /> Calendar
            </button>
          </div>
        )}
      </div>

      {/* ── CALENDAR VIEW ── */}
      {viewMode === 'calendar' && isService && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Legend */}
          <div className="mb-4 flex flex-wrap gap-3 items-center">
            {Object.entries(statusEventColors).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            ))}
          </div>
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            titleAccessor="title"
            style={{ height: 620 }}
            date={calendarDate}
            onNavigate={setCalendarDate}
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event: CalendarEvent) => setSelectedEvent(event.resource)}
            popup
            tooltipAccessor={(event: CalendarEvent) =>
              `${event.resource.customer_name} — ${format(event.start, 'h:mm a')}`
            }
          />
          {calendarEvents.length === 0 && (
            <p className="text-center text-gray-400 text-sm mt-4">
              No bookings with scheduled dates yet. Dates appear when customers pick a date &amp; time slot.
            </p>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {['all', ...FILTER_TABS].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  filter === s
                    ? 'bg-violet-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-violet-300'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <span className="ml-1.5 text-xs opacity-70">
                  {s === 'all' ? orders.length : orders.filter(o => o.status === s).length}
                </span>
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card text-center py-16">
              <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-gray-200" />
              <p className="text-gray-500 font-medium">No {isService ? 'bookings' : 'orders'} {filter !== 'all' ? `with status "${filter}"` : 'yet'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((order, idx) => (
                <div key={order.id} className="card">
                  {/* Booking number */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 text-sm font-extrabold flex items-center justify-center flex-shrink-0">
                        #{filtered.length - idx}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-gray-900">{order.customer_name}</h3>
                          <span className={`badge text-xs ${statusColors[order.status]}`}>{order.status}</span>
                          <span className="badge bg-gray-100 text-gray-500 text-xs">{order.channel}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                          <span>{order.customer_contact}</span>
                          {order.delivery_address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {order.delivery_address}
                            </span>
                          )}
                          {order.notes && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {order.notes}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-extrabold text-gray-900">RM {order.total_price?.toFixed(2)}</p>
                      {order.receipt_url && (
                        <a href={order.receipt_url} target="_blank" className="text-xs text-violet-600 hover:underline mt-1 block">
                          View Receipt
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Expand items */}
                  <button
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-3"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform ${expanded === order.id ? 'rotate-180' : ''}`} />
                    {order.order_items?.length || 0} item(s)
                  </button>

                  {expanded === order.id && order.order_items && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {order.order_items.map(oi => (
                        <div key={oi.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{oi.item?.name || 'Unknown item'} × {oi.quantity}</span>
                          <span className="text-gray-500 font-medium">RM {((oi.price || oi.item?.price || 0) * oi.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Status actions */}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                      {ACTION_STATUSES.filter(s => s !== order.status).map(s => (
                        <button
                          key={s}
                          onClick={() => updateStatus(order.id, s)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            s === 'delivered'
                              ? 'bg-green-50 hover:bg-green-100 text-green-700'
                              : s === 'cancelled'
                              ? 'bg-red-50 hover:bg-red-100 text-red-700'
                              : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          {s === 'delivered' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                          {s === 'cancelled' && <XCircle className="w-3 h-3 inline mr-1" />}
                          Mark as {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── BOOKING DETAIL MODAL (opened by clicking a calendar event) ── */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Status */}
            <div className="flex items-center gap-2 mb-4">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: statusEventColors[selectedEvent.status] }}
              />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {selectedEvent.status}
              </span>
            </div>

            {/* Service name */}
            {selectedEvent.order_items && selectedEvent.order_items.length > 0 && (
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">
                {selectedEvent.order_items[0].item?.name || 'Booking'}
              </h2>
            )}

            {/* Booked date & time */}
            {parseBookingDate(selectedEvent.notes || '') && (() => {
              const d = parseBookingDate(selectedEvent.notes!)!
              return (
                <div className="flex items-center gap-2 text-violet-600 font-semibold mb-5">
                  <Clock className="w-4 h-4" />
                  {format(d, 'EEEE, MMMM d yyyy')} at {format(d, 'h:mm a')}
                </div>
              )
            })()}

            {/* Customer details */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Customer</p>
                  <p className="font-semibold text-gray-900">{selectedEvent.customer_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Contact</p>
                  <p className="font-semibold text-gray-900">{selectedEvent.customer_contact}</p>
                </div>
              </div>
              {selectedEvent.delivery_address && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Address / Location</p>
                    <p className="font-semibold text-gray-900">{selectedEvent.delivery_address}</p>
                  </div>
                </div>
              )}
              {selectedEvent.notes && cleanNotes(selectedEvent.notes) && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">Notes</p>
                    <p className="font-semibold text-gray-900">{cleanNotes(selectedEvent.notes)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between py-3 border-t border-gray-100 mb-5">
              <span className="text-gray-500 text-sm font-medium">Total</span>
              <span className="text-xl font-extrabold text-gray-900">RM {selectedEvent.total_price?.toFixed(2)}</span>
            </div>

            {/* Status actions */}
            {selectedEvent.status !== 'delivered' && selectedEvent.status !== 'cancelled' && (
              <div className="flex flex-wrap gap-2">
                {ACTION_STATUSES.filter(s => s !== selectedEvent.status).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(selectedEvent.id, s)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      s === 'delivered'
                        ? 'bg-green-50 hover:bg-green-100 text-green-700'
                        : s === 'cancelled'
                        ? 'bg-red-50 hover:bg-red-100 text-red-700'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {s === 'delivered' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                    {s === 'cancelled' && <XCircle className="w-3 h-3 inline mr-1" />}
                    Mark as {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
