'use client'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  Megaphone, Zap, PenLine, MapPin, Users, Trash2,
  CheckCircle, ImageIcon, X, Loader2, Target, TrendingUp,
  MousePointerClick, ShoppingCart, ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Item } from '@/lib/types'
import Image from 'next/image'

const MapPicker = dynamic(() => import('./MapPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
      <div className="flex flex-col items-center gap-2 text-blue-400">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-sm">Loading map…</p>
      </div>
    </div>
  ),
})

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', bg: 'bg-gradient-to-r from-pink-500 to-purple-500', text: 'text-white' },
  { id: 'facebook', label: 'Facebook', bg: 'bg-blue-600', text: 'text-white' },
  { id: 'tiktok', label: 'TikTok', bg: 'bg-gray-900', text: 'text-white' },
  { id: 'twitter', label: 'X / Twitter', bg: 'bg-black', text: 'text-white' },
  { id: 'youtube', label: 'YouTube', bg: 'bg-red-600', text: 'text-white' },
  { id: 'snapchat', label: 'Snapchat', bg: 'bg-yellow-400', text: 'text-gray-900' },
  { id: 'telegram', label: 'Telegram', bg: 'bg-sky-500', text: 'text-white' },
]

interface AdCampaign {
  id: string
  title: string
  description: string
  imageUrl: string | null
  platforms: string[]
  ageMin: number
  ageMax: number
  lat: number
  lng: number
  radius: number
  type: 'autonomous' | 'custom'
  createdAt: string
  estimates: {
    reachMin: number; reachMax: number
    clicksMin: number; clicksMax: number
    conversionsMin: number; conversionsMax: number
  }
}

function generateEstimates(radius: number, platforms: string[]) {
  const base = Math.max(1, radius) * Math.max(1, platforms.length)
  return {
    reachMin: Math.round(base * 180),
    reachMax: Math.round(base * 520),
    clicksMin: Math.round(base * 9),
    clicksMax: Math.round(base * 26),
    conversionsMin: Math.round(base * 0.7),
    conversionsMax: Math.round(base * 2.1),
  }
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

// ── Shared sub-components ────────────────────────────────────────────────────

function PlatformSelector({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (p: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(p => p !== id) : [...selected, id])
  }
  return (
    <div>
      <label className="label">Ad Platforms</label>
      <div className="flex flex-wrap gap-2 mt-2">
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border-2 ${
              selected.includes(p.id)
                ? `${p.bg} ${p.text} border-transparent scale-105 shadow`
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function AgeRange({
  ageMin, ageMax,
  setAgeMin, setAgeMax,
}: {
  ageMin: number; ageMax: number
  setAgeMin: (v: number) => void; setAgeMax: (v: number) => void
}) {
  return (
    <div>
      <label className="label flex items-center gap-2">
        <Users className="w-4 h-4 text-violet-500" />
        Age Preference: <span className="font-bold text-violet-700">{ageMin}–{ageMax}</span>
      </label>
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div>
          <p className="text-xs text-gray-400 mb-1">Min age</p>
          <input
            type="range" min={13} max={65} value={ageMin}
            onChange={e => setAgeMin(Math.min(Number(e.target.value), ageMax - 1))}
            className="w-full accent-violet-600"
          />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Max age</p>
          <input
            type="range" min={14} max={70} value={ageMax}
            onChange={e => setAgeMax(Math.max(Number(e.target.value), ageMin + 1))}
            className="w-full accent-violet-600"
          />
        </div>
      </div>
    </div>
  )
}

function MapSection({
  location, radius, onLocationChange, onRadiusChange,
}: {
  location: { lat: number; lng: number } | null
  radius: number
  onLocationChange: (l: { lat: number; lng: number }) => void
  onRadiusChange: (r: number) => void
}) {
  return (
    <div>
      <label className="label flex items-center gap-2">
        <MapPin className="w-4 h-4 text-violet-500" />
        Ad Zone — <span className="text-violet-700 font-bold">{radius} km radius</span>
        <span className="text-gray-400 text-xs ml-auto">Click map to move location</span>
      </label>
      <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        {location ? (
          <MapPicker location={location} radius={radius} onLocationChange={onLocationChange} />
        ) : (
          <div className="h-[300px] bg-blue-50 flex items-center justify-center rounded-xl">
            <div className="flex flex-col items-center gap-2 text-blue-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Fetching your location…</p>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>1 km</span><span>50 km</span>
        </div>
        <input
          type="range" min={1} max={50} value={radius}
          onChange={e => onRadiusChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>
    </div>
  )
}

function RunButton({
  onClick, running, success,
}: {
  onClick: () => void; running: boolean; success: boolean
}) {
  if (success) {
    return (
      <div className="flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3 rounded-xl animate-pulse">
        <CheckCircle className="w-5 h-5" />
        Campaign Running Successfully!
      </div>
    )
  }
  return (
    <button
      onClick={onClick}
      disabled={running}
      className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all shadow hover:shadow-lg"
    >
      {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Megaphone className="w-5 h-5" />}
      {running ? 'Launching Campaign…' : 'Run Ads'}
    </button>
  )
}

// ── Ad Card ──────────────────────────────────────────────────────────────────

function AdCard({ campaign, onDelete }: { campaign: AdCampaign; onDelete: () => void }) {
  const e = campaign.estimates
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {campaign.imageUrl && (
        <div className="relative h-24 w-full bg-gray-50">
          <Image src={campaign.imageUrl} alt={campaign.title} fill className="object-cover" />
        </div>
      )}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${campaign.type === 'autonomous' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
              {campaign.type === 'autonomous' ? '⚡ Auto' : '✍️ Custom'}
            </span>
            <h3 className="text-sm font-bold text-gray-900 mt-0.5 leading-tight truncate">{campaign.title}</h3>
          </div>
          <button
            onClick={onDelete}
            className="p-1 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {campaign.description && (
          <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-1">{campaign.description}</p>
        )}

        <div className="flex flex-wrap gap-1">
          {campaign.platforms.map(p => {
            const pl = PLATFORMS.find(x => x.id === p)
            return (
              <span key={p} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${pl?.bg ?? 'bg-gray-200'} ${pl?.text ?? 'text-gray-700'}`}>
                {pl?.label ?? p}
              </span>
            )
          })}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {campaign.ageMin}–{campaign.ageMax}y</span>
          <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {campaign.radius}km</span>
        </div>

        {/* Estimates */}
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-lg p-2 border border-violet-100">
          <p className="text-[9px] font-bold text-violet-600 uppercase mb-1.5">Est. Performance</p>
          <div className="grid grid-cols-3 gap-1">
            <div className="text-center">
              <div className="flex items-center justify-center text-blue-500 mb-0.5">
                <Target className="w-3 h-3" />
              </div>
              <p className="text-[10px] font-bold text-gray-800">{fmt(e.reachMin)}–{fmt(e.reachMax)}</p>
              <p className="text-[9px] text-gray-400">Reach</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-violet-500 mb-0.5">
                <MousePointerClick className="w-3 h-3" />
              </div>
              <p className="text-[10px] font-bold text-gray-800">{fmt(e.clicksMin)}–{fmt(e.clicksMax)}</p>
              <p className="text-[9px] text-gray-400">Clicks</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center text-green-500 mb-0.5">
                <ShoppingCart className="w-3 h-3" />
              </div>
              <p className="text-[10px] font-bold text-gray-800">{fmt(e.conversionsMin)}–{fmt(e.conversionsMax)}</p>
              <p className="text-[9px] text-gray-400">Conv.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignPage() {
  const supabase = createClient()

  const [mode, setMode] = useState<'autonomous' | 'custom'>('autonomous')

  // Shared state
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [radius, setRadius] = useState(10)
  const [platforms, setPlatforms] = useState<string[]>(['instagram', 'facebook'])
  const [ageMin, setAgeMin] = useState(18)
  const [ageMax, setAgeMax] = useState(45)
  const [running, setRunning] = useState(false)
  const [success, setSuccess] = useState(false)
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [businessId, setBusinessId] = useState('')
  const adsRef = useRef<HTMLDivElement>(null)

  // Autonomous mode
  const [items, setItems] = useState<Item[]>([])
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [generatedAd, setGeneratedAd] = useState<{ title: string; description: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [showItemDropdown, setShowItemDropdown] = useState(false)

  // Custom mode
  const [customTitle, setCustomTitle] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null)
  const [uploadingImg, setUploadingImg] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      try {
        await loadItems()
      } catch { /* ignore */ }
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setLocation({ lat: 3.139, lng: 101.6869 })
          )
        } else {
          setLocation({ lat: 3.139, lng: 101.6869 })
        }
      } catch {
        setLocation({ lat: 3.139, lng: 101.6869 })
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!businessId) return
    try {
      const saved = localStorage.getItem(`loom_campaigns_${businessId}`)
      setCampaigns(saved ? JSON.parse(saved) : [])
    } catch {
      setCampaigns([])
    }
  }, [businessId])

  async function loadItems() {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) return
      const { data: biz } = await supabase.from('businesses').select('*').eq('user_id', authData.user.id).single()
      if (!biz) return
      setBusinessId(biz.id)
      const { data } = await supabase.from('items').select('*').eq('business_id', biz.id).eq('available', true).order('created_at', { ascending: false })
      setItems(data || [])
      if (data && data.length > 0) setSelectedItem(data[0])
    } catch { /* silently ignore */ }
  }

  async function generateAd() {
    if (!selectedItem) { toast.error('Select an item first'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'item-post',
          itemName: selectedItem.name,
          itemDescription: selectedItem.description,
          itemPrice: selectedItem.price,
        }),
      })
      const data = await res.json()
      setGeneratedAd({
        title: selectedItem.name,
        description: data.content || `🚀 ${selectedItem.name} — ${selectedItem.description}. Get yours today for RM${selectedItem.price}!`,
      })
      toast.success('Ad generated!')
    } catch {
      setGeneratedAd({
        title: selectedItem.name,
        description: `🚀 Introducing ${selectedItem.name}! ${selectedItem.description}. Only RM${selectedItem.price} — grab yours today!`,
      })
    }
    setGenerating(false)
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    const reader = new FileReader()
    reader.onload = ev => {
      setCustomImageUrl(ev.target?.result as string)
      setUploadingImg(false)
    }
    reader.readAsDataURL(file)
  }

  function runAds() {
    if (!location) { toast.error('Location is required'); return }
    if (platforms.length === 0) { toast.error('Select at least one platform'); return }
    if (mode === 'autonomous' && !selectedItem) { toast.error('Select an item'); return }
    if (mode === 'custom' && !customTitle.trim()) { toast.error('Ad title is required'); return }

    setRunning(true)
    setTimeout(() => {
      const estimates = generateEstimates(radius, platforms)
      const newCampaign: AdCampaign = {
        id: Date.now().toString(),
        title: mode === 'autonomous' ? (generatedAd?.title ?? selectedItem?.name ?? 'Auto Campaign') : customTitle,
        description: mode === 'autonomous' ? (generatedAd?.description ?? '') : customDesc,
        imageUrl: mode === 'autonomous' ? (selectedItem?.image_url ?? null) : customImageUrl,
        platforms,
        ageMin,
        ageMax,
        lat: location.lat,
        lng: location.lng,
        radius,
        type: mode,
        createdAt: new Date().toISOString(),
        estimates,
      }
      const updated = [newCampaign, ...campaigns]
      setCampaigns(updated)
      if (businessId) {
        localStorage.setItem(`loom_campaigns_${businessId}`, JSON.stringify(updated))
      }
      setRunning(false)
      setSuccess(true)
      setTimeout(() => {
        adsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      setTimeout(() => setSuccess(false), 3500)
    }, 2200)
  }

  function deleteCampaign(id: string) {
    const updated = campaigns.filter(c => c.id !== id)
    setCampaigns(updated)
    if (businessId) {
      localStorage.setItem(`loom_campaigns_${businessId}`, JSON.stringify(updated))
    }
    toast.success('Campaign deleted')
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Your Strategic Ads ── */}
      {campaigns.length > 0 && (
        <div ref={adsRef}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-violet-600" />
            <h2 className="text-lg font-extrabold text-gray-900">Your Strategic Ads</h2>
            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">{campaigns.length} active</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {campaigns.map(c => (
              <AdCard key={c.id} campaign={c} onDelete={() => deleteCampaign(c.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Header + Toggle + Panel grouped tighter */}
      <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center shadow">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">AI Campaign Generator</h1>
          <p className="text-sm text-gray-400">Launch smart ads in seconds — powered by AI</p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode('autonomous')}
          className={`flex flex-col items-start gap-1 p-4 rounded-2xl border-2 transition-all ${
            mode === 'autonomous'
              ? 'border-violet-500 bg-violet-50'
              : 'border-gray-100 bg-white hover:border-violet-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className={`w-5 h-5 ${mode === 'autonomous' ? 'text-violet-600' : 'text-gray-400'}`} />
            <span className={`font-bold text-sm ${mode === 'autonomous' ? 'text-violet-700' : 'text-gray-600'}`}>Autonomous</span>
          </div>
          <p className="text-xs text-gray-400 text-left">AI generates your ad from your inventory automatically</p>
        </button>
        <button
          onClick={() => setMode('custom')}
          className={`flex flex-col items-start gap-1 p-4 rounded-2xl border-2 transition-all ${
            mode === 'custom'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-100 bg-white hover:border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <PenLine className={`w-5 h-5 ${mode === 'custom' ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className={`font-bold text-sm ${mode === 'custom' ? 'text-blue-700' : 'text-gray-600'}`}>Custom Creator</span>
          </div>
          <p className="text-xs text-gray-400 text-left">Design your own ad with full control</p>
        </button>
      </div>

      {/* ── Autonomous Mode ── */}
      {mode === 'autonomous' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-gray-50 pb-4">
            <Zap className="w-4 h-4 text-violet-600" />
            <h2 className="font-bold text-gray-800">Autonomous Ad Campaign</h2>
          </div>

          {/* Item selector */}
          <div>
            <label className="label">Select Item / Service</label>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 mt-1">No items found. Add items in your inventory first.</p>
            ) : (
              <div className="relative mt-2">
                <button
                  onClick={() => setShowItemDropdown(!showItemDropdown)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-violet-300 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {selectedItem?.image_url ? (
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                        <Image src={selectedItem.image_url} alt={selectedItem.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-5 h-5 text-violet-300" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm text-gray-900">{selectedItem?.name ?? 'Choose item…'}</p>
                      {selectedItem && <p className="text-xs text-gray-400">RM {selectedItem.price}</p>}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {showItemDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-lg z-10 max-h-48 overflow-y-auto">
                    {items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => { setSelectedItem(item); setShowItemDropdown(false); setGeneratedAd(null) }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-50 transition-colors text-left"
                      >
                        {item.image_url ? (
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                            <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-400">RM {item.price}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Generate Ad */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">AI-Generated Ad Copy</label>
              <button
                onClick={generateAd}
                disabled={!selectedItem || generating}
                className="flex items-center gap-1.5 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors font-medium"
              >
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {generating ? 'Generating…' : 'Generate Ad'}
              </button>
            </div>
            {generatedAd ? (
              <div className="bg-violet-50 rounded-xl p-4 border border-violet-100 space-y-1">
                <p className="font-bold text-sm text-violet-800">{generatedAd.title}</p>
                <p className="text-sm text-violet-700 leading-relaxed">{generatedAd.description}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 border border-dashed border-gray-200 text-center">
                <p className="text-xs text-gray-400">Click &quot;Generate Ad&quot; to create AI-powered copy from your selected item</p>
              </div>
            )}
          </div>

          <PlatformSelector selected={platforms} onChange={setPlatforms} />
          <AgeRange ageMin={ageMin} ageMax={ageMax} setAgeMin={setAgeMin} setAgeMax={setAgeMax} />
          <MapSection location={location} radius={radius} onLocationChange={setLocation} onRadiusChange={setRadius} />

          <RunButton onClick={runAds} running={running} success={success} />
        </div>
      )}

      {/* ── Custom Mode ── */}
      {mode === 'custom' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 space-y-6"> {/* inside grouped div */}
          <div className="flex items-center gap-2 border-b border-gray-50 pb-4">
            <PenLine className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-gray-800">Custom Ad Creator</h2>
          </div>

          {/* Title */}
          <div>
            <label className="label">Ad Title *</label>
            <input
              type="text"
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              placeholder="e.g. Summer Sale — 30% Off Everything!"
              className="input mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">Ad Description</label>
            <textarea
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              placeholder="Describe your offer, highlight benefits, add a call to action…"
              rows={4}
              className="input mt-1 resize-none"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="label flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-500" />
              Ad Image
            </label>
            <div className="mt-2">
              {customImageUrl ? (
                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-gray-200">
                  <Image src={customImageUrl} alt="Ad" fill className="object-cover" />
                  <button
                    onClick={() => setCustomImageUrl(null)}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingImg}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 bg-gray-50 hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-blue-500"
                >
                  {uploadingImg ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                  <span className="text-xs">{uploadingImg ? 'Processing…' : 'Click to upload image'}</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
          </div>

          <PlatformSelector selected={platforms} onChange={setPlatforms} />
          <AgeRange ageMin={ageMin} ageMax={ageMax} setAgeMin={setAgeMin} setAgeMax={setAgeMax} />
          <MapSection location={location} radius={radius} onLocationChange={setLocation} onRadiusChange={setRadius} />

          <RunButton onClick={runAds} running={running} success={success} />
        </div>
      )}

      </div> {/* end grouped header+toggle+panel */}
    </div>
  )
}
