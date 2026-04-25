'use client'
import { useState, useEffect, useRef } from 'react'
import { Bot, Send, User, AlertTriangle, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Message } from '@/lib/types'
import { format } from 'date-fns'

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const [escalation, setEscalation] = useState<'low' | 'medium' | 'high' | null>(null)
  const [businessId, setBusinessId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadBusiness()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadBusiness() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: biz } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
    if (biz) setBusinessId(biz.id)
  }

  async function loadHistory() {
    if (!businessId) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50)
    setMessages((data || []).reverse() as Message[])
  }

  useEffect(() => {
    if (businessId) loadHistory()
  }, [businessId])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    setLoading(true)

    // Optimistic update
    const tempMsg: Message = {
      id: crypto.randomUUID(),
      business_id: businessId,
      sender: 'customer',
      message_text: userMsg,
      session_id: sessionId,
      channel: 'web',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg, sessionId }),
    })
    const data = await res.json()

    const aiMsg: Message = {
      id: crypto.randomUUID(),
      business_id: businessId,
      sender: 'ai',
      message_text: data.reply,
      session_id: sessionId,
      channel: 'web',
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, aiMsg])
    setEscalation(data.escalation)
    setLoading(false)
  }

  const escalationBanner = {
    medium: { text: 'Medium issue detected — AI providing partial solution', color: 'bg-amber-50 border-amber-200 text-amber-700' },
    high: { text: '⚠️ High severity detected — Escalated to you (owner)', color: 'bg-red-50 border-red-200 text-red-700' },
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">AI Customer Chat</h1>
            <p className="text-xs text-gray-400">Live conversations & AI responses</p>
          </div>
        </div>
        <button onClick={loadHistory} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Escalation banner */}
      {escalation && escalation !== 'low' && escalationBanner[escalation] && (
        <div className={`mx-4 mt-4 px-4 py-3 rounded-xl border flex items-center gap-2 text-sm ${escalationBanner[escalation].color}`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {escalationBanner[escalation].text}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="text-center py-16">
            <Bot className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-400 text-sm">No messages yet. This is where customer conversations appear.</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}>
            {(msg.sender === 'ai' || msg.sender === 'owner') && (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.sender === 'ai' ? 'bg-violet-100' : 'bg-gray-200'}`}>
                {msg.sender === 'ai' ? <Bot className="w-4 h-4 text-violet-600" /> : <User className="w-4 h-4 text-gray-600" />}
              </div>
            )}
            <div className="max-w-[70%]">
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.sender === 'customer'
                    ? 'bg-violet-600 text-white rounded-br-sm'
                    : msg.sender === 'ai'
                    ? 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                {msg.message_text}
              </div>
              <p className="text-xs text-gray-400 mt-1 px-1">
                {msg.sender === 'ai' ? 'LOOM AI' : msg.sender === 'customer' ? 'Customer' : 'Owner'} · {format(new Date(msg.created_at), 'h:mm a')}
              </p>
            </div>
            {msg.sender === 'customer' && (
              <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 text-violet-600" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-600" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — owner can test chat */}
      <div className="border-t border-gray-100 bg-white px-6 py-4">
        <p className="text-xs text-gray-400 mb-2">Test your AI agent (simulates a customer message)</p>
        <form onSubmit={sendMessage} className="flex gap-3">
          <input
            className="input flex-1"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a test customer message..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-4 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
