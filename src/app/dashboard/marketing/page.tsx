'use client'
import { useState, useEffect } from 'react'
import { TrendingUp, Lightbulb, Megaphone, Share2, RefreshCw, Copy, CheckCheck, Trash2, X } from 'lucide-react'
import { AiInsight } from '@/lib/types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const AGENT_CONFIG: Record<string, { label: string; subtitle: string; bg: string; border: string; text: string; accent: string }> = {
  CEO: { label: 'CEO', subtitle: 'Growth & Bold Strategy', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', accent: 'bg-blue-600' },
  CFO: { label: 'CFO', subtitle: 'Finance & Risk Control', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', accent: 'bg-emerald-600' },
  CMO: { label: 'CMO', subtitle: 'Marketing & Conversions', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900', accent: 'bg-pink-600' },
  FINAL: { label: 'Action Plan', subtitle: 'Combined Strategy', bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-900', accent: 'bg-violet-600' },
}

const AGENT_ORDER = ['CEO', 'CFO', 'CMO', 'FINAL']

interface AgentResult {
  status: 'idle' | 'thinking' | 'done'
  content?: string
}

const TYPES = [
  { key: 'insight', label: 'Business Ideas', icon: Lightbulb, color: 'bg-amber-50 text-amber-700 border-amber-200', desc: 'CEO, CFO & CMO agents debate your goal and build a custom action plan', badge: 'AI Board' },
  { key: 'post', label: 'Social Media Post', icon: Share2, color: 'bg-blue-50 text-blue-700 border-blue-200', desc: 'Generate a ready-to-post social media caption', badge: null },
  { key: 'promo', label: 'Promotion Idea', icon: Megaphone, color: 'bg-green-50 text-green-700 border-green-200', desc: 'Get a promotional campaign idea to boost sales', badge: null },
]

function ThinkingDots() {
  return (
    <div className="flex gap-1 items-center mt-1">
      {[0, 150, 300].map(delay => (
        <div key={delay} className="w-1.5 h-1.5 rounded-full bg-current opacity-50 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </div>
  )
}

function AgentCard({ agentKey, result }: { agentKey: string; result: AgentResult }) {
  const cfg = AGENT_CONFIG[agentKey]
  if (result.status === 'idle') return null
  const isFinal = agentKey === 'FINAL'
  return (
    <div className={`rounded-xl border ${isFinal ? 'border-2' : ''} ${cfg.bg} ${cfg.border} p-4 transition-all`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-1 self-stretch rounded-full ${cfg.accent}`} />
          <div>
            <p className={`font-bold text-sm ${cfg.text}`}>{cfg.label}</p>
            <p className="text-xs opacity-60">{cfg.subtitle}</p>
          </div>
        </div>
        {result.status === 'thinking' && <div className={cfg.text}><ThinkingDots /></div>}
      </div>
      {result.status === 'thinking'
        ? <p className="text-xs italic opacity-50 mt-1">Analyzing your business data...</p>
        : <p className={`text-sm leading-relaxed whitespace-pre-wrap ${cfg.text}`}>{result.content}</p>
      }
    </div>
  )
}

export default function MarketingPage() {
  const [insights, setInsights] = useState<AiInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState('')
  const [copied, setCopied] = useState('')
  const [deleting, setDeleting] = useState('')

  const [showInsightForm, setShowInsightForm] = useState(false)
  const [insightForm, setInsightForm] = useState({ goal: '', budget: '', extraContext: '' })
  const [showDebate, setShowDebate] = useState(false)
  const [debateRunning, setDebateRunning] = useState(false)
  const [agentResults, setAgentResults] = useState<Record<string, AgentResult>>({
    CEO: { status: 'idle' }, CFO: { status: 'idle' }, CMO: { status: 'idle' }, FINAL: { status: 'idle' },
  })

  useEffect(() => { loadInsights() }, [])

  async function loadInsights() {
    setLoading(true)
    const res = await fetch('/api/marketing')
    const data = await res.json()
    setInsights(data.insights || [])
    setLoading(false)
  }

  function handleClick(type: string) {
    if (type === 'insight') { setShowInsightForm(true); return }
    generate(type)
  }

  async function runAgents() {
    if (!insightForm.goal.trim() || !insightForm.budget.trim()) { toast.error('Please fill in your goal and budget'); return }
    setShowInsightForm(false)
    setShowDebate(true)
    setDebateRunning(true)
    setAgentResults({ CEO: { status: 'idle' }, CFO: { status: 'idle' }, CMO: { status: 'idle' }, FINAL: { status: 'idle' } })
    try {
      const response = await fetch('/api/marketing/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insightForm),
      })
      if (!response.ok) throw new Error('Failed')
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.agent === 'DONE') { setDebateRunning(false); loadInsights(); return }
            if (data.agent === 'ERROR') { toast.error(data.content || 'Failed'); setDebateRunning(false); return }
            setAgentResults(prev => ({ ...prev, [data.agent]: { status: data.status, content: data.content } }))
          } catch { /* skip */ }
        }
      }
    } catch {
      toast.error('Connection error. Please try again.')
      setDebateRunning(false)
    }
  }

  async function generate(type: string) {
    setGenerating(type)
    try {
      const res = await fetch('/api/marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) })
      const data = await res.json()
      if (data.content) { toast.success('Generated!'); loadInsights() }
      else toast.error(data.error || 'Failed to generate')
    } catch { toast.error('Network error, please try again') }
    setGenerating('')
  }

  async function deleteInsight(id: string) {
    setDeleting(id)
    await fetch('/api/marketing', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    toast.success('Deleted')
    setInsights(prev => prev.filter(i => i.id !== id))
    setDeleting('')
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    toast.success('Copied!')
    setTimeout(() => setCopied(''), 2000)
  }

  const typeColors: Record<string, string> = { insight: 'bg-amber-50 border-amber-200', post: 'bg-blue-50 border-blue-200', promo: 'bg-green-50 border-green-200' }
  const typeLabels: Record<string, string> = { insight: 'Business Ideas', post: 'Social Media Post', promo: 'Promotion Idea' }

  const ceoVisible = agentResults.CEO.status !== 'idle'
  const boardVisible = agentResults.CEO.status === 'done'
  const finalVisible = agentResults.CFO.status === 'done' && agentResults.CMO.status === 'done'
  const allDone = !debateRunning && agentResults.FINAL.status === 'done'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">AI Marketing</h1>
          <p className="text-gray-500 text-sm mt-1">AI-generated insights, posts & promotions based on your business data</p>
        </div>
        <button onClick={loadInsights} disabled={loading} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {TYPES.map(({ key, label, icon: Icon, color, desc, badge }) => (
          <button key={key} onClick={() => handleClick(key)} disabled={generating === key}
            className={`card border flex flex-col items-start gap-3 p-5 hover:shadow-md transition-all text-left disabled:opacity-60 ${color}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-bold text-sm">{label}</span>
              {badge && <span className="text-xs bg-amber-200/70 text-amber-800 font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
            </div>
            <p className="text-xs opacity-70">{desc}</p>
            <span className="text-xs font-semibold">{generating === key ? 'Generating...' : 'Generate'}</span>
          </button>
        ))}
      </div>

      <div>
        <h2 className="font-bold text-gray-900 mb-4">Generated Content</h2>
        {loading ? (
          <div className="card text-center py-10 text-gray-400 text-sm">Loading…</div>
        ) : insights.length === 0 ? (
          <div className="card text-center py-16">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-200" />
            <p className="text-gray-500 font-medium">No content yet</p>
            <p className="text-sm text-gray-400">Click any button above to generate your first AI marketing content</p>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.map(insight => (
              <div key={insight.id} className={`card border ${typeColors[insight.type] || 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wide opacity-60">{typeLabels[insight.type] || insight.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{format(new Date(insight.created_at), 'MMM d, h:mm a')}</span>
                    <button onClick={() => copyText(insight.content, insight.id)} className="p-1.5 hover:bg-white/50 rounded-lg transition-colors">
                      {copied === insight.id ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 opacity-50" />}
                    </button>
                    <button onClick={() => deleteInsight(insight.id)} disabled={deleting === insight.id}
                      className="p-1.5 hover:bg-red-100 rounded-lg transition-colors text-red-400 hover:text-red-600 disabled:opacity-40">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{insight.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showInsightForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">AI Board Meeting</h2>
                  <p className="text-xs text-gray-400 mt-0.5">CEO · CFO · CMO will each analyse your goal and produce a combined action plan</p>
                </div>
                <button onClick={() => setShowInsightForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex gap-2 my-5">
                {[{ key: 'CEO', color: 'bg-blue-50 text-blue-700 border border-blue-200' }, { key: 'CFO', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' }, { key: 'CMO', color: 'bg-pink-50 text-pink-700 border border-pink-200' }].map(a => (
                  <div key={a.key} className={`flex-1 text-center rounded-lg py-2 text-xs font-bold ${a.color}`}>{a.key}</div>
                ))}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">What do you want to achieve? *</label>
                  <textarea className="input resize-none h-24" value={insightForm.goal}
                    onChange={e => setInsightForm({ ...insightForm, goal: e.target.value })}
                    placeholder="e.g. I want to grow my food delivery sales by 30% in 3 months. Currently getting 5-10 orders/day mostly from Instagram…" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">Budget available (RM) *</label>
                  <input className="input" type="number" min="0" value={insightForm.budget}
                    onChange={e => setInsightForm({ ...insightForm, budget: e.target.value })}
                    placeholder="e.g. 500, 2000, 10000" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">Anything else? (optional)</label>
                  <input className="input" value={insightForm.extraContext}
                    onChange={e => setInsightForm({ ...insightForm, extraContext: e.target.value })}
                    placeholder="e.g. target audience, location, specific problem…" />
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-amber-700">This takes approximately 60 seconds. Each agent&apos;s response will appear as it completes.</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowInsightForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={runAgents} disabled={!insightForm.goal.trim() || !insightForm.budget.trim()} className="btn-primary flex-1 disabled:opacity-50">
                  Start Board Meeting
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDebate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-gray-900">AI Board Meeting</h2>
                    {debateRunning && <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
                    {allDone && <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">COMPLETE</span>}
                  </div>
                  <p className="text-xs text-gray-400 ml-7">Goal: {insightForm.goal.slice(0, 70)}{insightForm.goal.length > 70 ? '…' : ''} · Budget: RM{insightForm.budget}</p>
                </div>
                {!debateRunning && <button onClick={() => setShowDebate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>}
              </div>

              {debateRunning && (
                <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
                  {AGENT_ORDER.map((key, i) => {
                    const r = agentResults[key]
                    const cfg = AGENT_CONFIG[key]
                    return (
                      <div key={key} className="flex items-center gap-1 flex-shrink-0">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          r.status === 'done' ? `${cfg.bg} ${cfg.text} border ${cfg.border}` :
                          r.status === 'thinking' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          <span>{cfg.label}</span>
                          {r.status === 'thinking' && <ThinkingDots />}
                          {r.status === 'done' && <span className="text-[10px]">done</span>}
                        </div>
                        {i < AGENT_ORDER.length - 1 && <span className="text-gray-300 text-xs">→</span>}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="space-y-3">
                {ceoVisible && <AgentCard agentKey="CEO" result={agentResults.CEO} />}
                {boardVisible && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AgentCard agentKey="CFO" result={agentResults.CFO} />
                    <AgentCard agentKey="CMO" result={agentResults.CMO} />
                  </div>
                )}
                {finalVisible && <AgentCard agentKey="FINAL" result={agentResults.FINAL} />}
              </div>

              {allDone && (
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowDebate(false)} className="btn-secondary flex-1">Close</button>
                  <button onClick={() => {
                    const text = [`AI Board Meeting Strategy`, `Goal: ${insightForm.goal}`, `Budget: RM${insightForm.budget}`, '',
                      `CEO — Growth Strategy:\n${agentResults.CEO.content}`, '', `CFO — Financial Analysis:\n${agentResults.CFO.content}`, '',
                      `CMO — Marketing Plan:\n${agentResults.CMO.content}`, '', `Action Plan:\n${agentResults.FINAL.content}`].join('\n')
                    navigator.clipboard.writeText(text)
                    toast.success('Full plan copied!')
                  }} className="btn-primary flex-1 flex items-center justify-center gap-2">
                    <Copy className="w-4 h-4" /> Copy Full Plan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}