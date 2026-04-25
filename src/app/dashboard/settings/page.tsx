'use client'
import { useState, useEffect, useRef } from 'react'
import { Bot, Globe, Save, ExternalLink, CheckCircle, ArrowRight, Copy, Eye, EyeOff, Upload, X, QrCode, Building, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BusinessSettings, PaymentMethod } from '@/lib/types'
import toast from 'react-hot-toast'

type TelegramStep = 1 | 2 | 3

export default function SettingsPage() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [businessId, setBusinessId] = useState('')
  const [form, setForm] = useState({
    telegram_bot_token: '',
    telegram_username: '',
    landing_enabled: true,
    landing_description: '',
    landing_image_url: '',
    landing_contact: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  // Telegram wizard state
  const [tgStep, setTgStep] = useState<TelegramStep>(1)
  const [tokenInput, setTokenInput] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [botInfo, setBotInfo] = useState<{ username: string; name: string } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)

  // Payment state
  const [paymentType, setPaymentType] = useState<'qr' | 'bank'>('qr')
  const [paymentForm, setPaymentForm] = useState({ qr_url: '', bank_name: '', account_number: '', account_holder: '' })
  const [paymentData, setPaymentData] = useState<PaymentMethod | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadData()
    loadPayment()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: biz } = await supabase.from('businesses').select('*').eq('user_id', user.id).single()
    if (!biz) return
    setBusinessId(biz.id)
    const { data: s } = await supabase.from('business_settings').select('*').eq('business_id', biz.id).single()
    if (s) {
      setSettings(s as BusinessSettings)
      setForm({
        telegram_bot_token: s.telegram_bot_token || '',
        telegram_username: s.telegram_username || '',
        landing_enabled: s.landing_enabled ?? true,
        landing_description: s.landing_description || '',
        landing_image_url: s.landing_image_url || '',
        landing_contact: s.landing_contact || '',
      })
      if (s.telegram_bot_token) {
        setTokenInput(s.telegram_bot_token)
        setConnected(true)
        setTgStep(3)
        setBotInfo({ username: s.telegram_username || '', name: '' })
      }
    }
  }

  async function loadPayment() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: biz } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
    if (!biz) return
    const { data: pm } = await supabase.from('payment_methods').select('*').eq('business_id', biz.id).single()
    if (pm) {
      setPaymentData(pm as PaymentMethod)
      setPaymentType((pm.type as 'qr' | 'bank') || 'qr')
      setPaymentForm({ qr_url: pm.qr_url || '', bank_name: pm.bank_name || '', account_number: pm.account_number || '', account_holder: pm.account_holder || '' })
    }
  }

  async function handleSave() {
    if (!businessId) return
    setSaving(true)
    // Save business settings
    const payload = { business_id: businessId, ...form }
    if (settings) {
      await supabase.from('business_settings').update(payload).eq('business_id', businessId)
    } else {
      await supabase.from('business_settings').insert(payload)
    }
    // Save payment at the same time
    const pmPayload = {
      business_id: businessId,
      type: paymentType,
      qr_url: paymentType === 'qr' ? paymentForm.qr_url : null,
      bank_name: paymentType === 'bank' ? paymentForm.bank_name : null,
      account_number: paymentType === 'bank' ? paymentForm.account_number : null,
      account_holder: paymentType === 'bank' ? paymentForm.account_holder : null,
    }
    if (paymentData) {
      await supabase.from('payment_methods').update(pmPayload).eq('id', paymentData.id)
    } else {
      await supabase.from('payment_methods').insert(pmPayload)
    }
    toast.success('Settings saved!')
    setSaving(false)
    loadData()
    loadPayment()
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !businessId) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    setUploadingBanner(true)
    const ext = file.name.split('.').pop()
    const path = `${businessId}/banner-${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('landing-images').upload(path, file, { upsert: true })
    if (error) { toast.error('Upload failed: ' + error.message); setUploadingBanner(false); return }
    const { data: urlData } = supabase.storage.from('landing-images').getPublicUrl(data.path)
    const newUrl = urlData.publicUrl
    setForm(f => ({ ...f, landing_image_url: newUrl }))
    // Auto-save the URL immediately so the store page shows it right away
    const payload = { business_id: businessId, landing_image_url: newUrl }
    if (settings) {
      await supabase.from('business_settings').update(payload).eq('business_id', businessId)
    } else {
      await supabase.from('business_settings').insert({ ...form, ...payload })
    }
    toast.success('Banner uploaded & saved!')
    setUploadingBanner(false)
    loadData()
  }

  async function verifyToken() {
    if (!tokenInput.trim()) {
      toast.error('Paste your bot token first')
      return
    }
    setVerifying(true)
    try {
      const res = await fetch(`https://api.telegram.org/bot${tokenInput.trim()}/getMe`)
      const data = await res.json()
      if (data.ok) {
        setBotInfo({ username: '@' + data.result.username, name: data.result.first_name })
        setTgStep(3)
        toast.success('Token verified!')
      } else {
        toast.error('Invalid token. Please check and try again.')
      }
    } catch {
      toast.error('Could not reach Telegram. Check your internet.')
    }
    setVerifying(false)
  }

  async function connectBot() {
    setConnecting(true)
    const appUrl = window.location.origin
    // Save token to settings first
    const newForm = { ...form, telegram_bot_token: tokenInput.trim(), telegram_username: botInfo?.username || '' }
    setForm(newForm)
    const payload = { business_id: businessId, ...newForm }
    if (settings) {
      await supabase.from('business_settings').update(payload).eq('business_id', businessId)
    } else {
      await supabase.from('business_settings').insert(payload)
    }
    // Register webhook
    const res = await fetch('/api/telegram/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput.trim(), appUrl }),
    })
    const data = await res.json()
    if (data.ok) {
      setConnected(true)
      toast.success('Telegram bot connected! Customers can now message your bot.')
    } else {
      toast.error('Webhook failed: ' + (data.error || 'Unknown error'))
    }
    setConnecting(false)
    loadData()
  }

  function resetTelegram() {
    setTgStep(1)
    setTokenInput('')
    setBotInfo(null)
    setConnected(false)
    setShowToken(false)
  }

  const storeUrl = typeof window !== 'undefined' ? `${window.location.origin}/store/${businessId}` : ''

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Configure your business, channels & landing page</p>
      </div>

      {/* Landing page */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-5">
          <Globe className="w-5 h-5 text-violet-600" />
          <h2 className="font-bold text-gray-900">Public Store / Landing Page</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="landing_enabled" checked={form.landing_enabled} onChange={e => setForm({ ...form, landing_enabled: e.target.checked })} className="w-4 h-4 accent-violet-600" />
            <label htmlFor="landing_enabled" className="text-sm font-medium text-gray-700">Enable public store page</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Description</label>
            <textarea className="input resize-none h-24" value={form.landing_description} onChange={e => setForm({ ...form, landing_description: e.target.value })} placeholder="Tell customers about your business..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Store Banner Image</label>
            <div
              onClick={() => bannerInputRef.current?.click()}
              className="relative h-36 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer hover:border-violet-400 transition-colors group"
            >
              {form.landing_image_url ? (
                <>
                  <img src={form.landing_image_url} alt="Banner" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <p className="text-white text-xs font-medium">Click to change</p>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                  {uploadingBanner ? <p className="text-sm">Uploading...</p> : (
                    <>
                      <Upload className="w-6 h-6" />
                      <p className="text-sm font-medium">Upload store banner</p>
                      <p className="text-xs">JPG, PNG — max 5MB</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
            {form.landing_image_url && (
              <button type="button" onClick={() => setForm(f => ({ ...f, landing_image_url: '' }))} className="text-xs text-red-400 hover:text-red-600 mt-1 flex items-center gap-1">
                <X className="w-3 h-3" /> Remove banner
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Info (phone/email)</label>
            <input className="input" value={form.landing_contact} onChange={e => setForm({ ...form, landing_contact: e.target.value })} placeholder="e.g. +601X-XXXXXXX" />
          </div>
          {businessId && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 flex-1 truncate">Store URL: {storeUrl}</p>
              <button onClick={() => { navigator.clipboard.writeText(storeUrl); toast.success('Copied!') }} className="text-gray-400 hover:text-gray-600">
                <Copy className="w-3.5 h-3.5" />
              </button>
              <a href={storeUrl} target="_blank" className="text-violet-600 hover:text-violet-700">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Telegram Guided Setup */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-gray-900">Telegram Bot Setup</h2>
          </div>
          {connected && (
            <button onClick={resetTelegram} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Reset
            </button>
          )}
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {([1, 2, 3] as TelegramStep[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                tgStep > s || (s === 3 && connected)
                  ? 'bg-green-500 text-white'
                  : tgStep === s
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {tgStep > s || (s === 3 && connected) ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              {i < 2 && <div className={`h-px w-8 ${tgStep > s ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
          <span className="text-xs text-gray-400 ml-2">
            {tgStep === 1 ? 'Create bot' : tgStep === 2 ? 'Paste token' : connected ? 'Connected!' : 'Connect'}
          </span>
        </div>

        {/* Step 1: Open BotFather */}
        {tgStep === 1 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-900">Create your Telegram bot in 1 minute:</p>
              <ol className="space-y-2">
                {[
                  'Open Telegram and search for @BotFather',
                  'Send the message: /newbot',
                  'Enter a name for your bot (e.g. "My Shop")',
                  'Enter a username ending in "bot" (e.g. MyShopBot)',
                  'BotFather will give you a token — copy it',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
                    <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              Open @BotFather on Telegram <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => setTgStep(2)}
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
            >
              I already have a token <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Paste token */}
        {tgStep === 2 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs text-amber-800">Paste the token BotFather gave you. It looks like: <span className="font-mono">7891234567:AAHxyz...</span></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bot Token</label>
              <div className="relative">
                <input
                  className="input font-mono text-xs pr-10"
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setTgStep(1)} className="btn-secondary flex-1 text-sm">Back</button>
              <button
                onClick={verifyToken}
                disabled={verifying || !tokenInput.trim()}
                className="btn-primary flex-1 text-sm disabled:opacity-60"
              >
                {verifying ? 'Verifying...' : 'Verify Token'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm & Connect */}
        {tgStep === 3 && (
          <div className="space-y-4">
            {botInfo && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  {botInfo.name && <p className="font-semibold text-gray-900 text-sm">{botInfo.name}</p>}
                  <p className="text-sm text-gray-500">{botInfo.username}</p>
                </div>
                {connected && <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />}
              </div>
            )}

            {connected ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-800 font-medium text-center">
                  ✅ Bot is live! Customers can now message your bot.
                </div>
                {botInfo?.username && (
                  <a
                    href={`https://t.me/${botInfo.username.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                  >
                    Open your bot <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Token verified! Click connect to save and go live.</p>
                <div className="flex gap-2">
                  <button onClick={() => setTgStep(2)} className="btn-secondary flex-1 text-sm">Back</button>
                  <button
                    onClick={connectBot}
                    disabled={connecting}
                    className="btn-primary flex-1 text-sm disabled:opacity-60"
                  >
                    {connecting ? 'Connecting...' : 'Connect Bot'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Settings */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-5 h-5 text-violet-600" />
          <h2 className="font-bold text-gray-900">Payment Settings</h2>
        </div>
        <div className="flex gap-3 mb-5">
          {([{ key: 'qr', label: 'QR Code', Icon: QrCode }, { key: 'bank', label: 'Bank Transfer', Icon: Building }] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setPaymentType(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm border-2 transition-all ${
                paymentType === key ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
        {paymentType === 'qr' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">QR Code Image URL</label>
              <input className="input" value={paymentForm.qr_url} onChange={e => setPaymentForm(f => ({ ...f, qr_url: e.target.value }))} placeholder="https://... (link to your QR code image)" />
              <p className="text-xs text-gray-400 mt-1.5">Upload your QR to any image host (e.g. Imgur) and paste the link here</p>
            </div>
            {paymentForm.qr_url && (
              <div className="text-center">
                <img src={paymentForm.qr_url} alt="QR Code" className="w-36 h-36 object-contain mx-auto rounded-xl border border-gray-200" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name</label>
              <input className="input" value={paymentForm.bank_name} onChange={e => setPaymentForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="e.g. Maybank, CIMB, RHB" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number</label>
              <input className="input" value={paymentForm.account_number} onChange={e => setPaymentForm(f => ({ ...f, account_number: e.target.value }))} placeholder="e.g. 1234567890" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Holder Name</label>
              <input className="input" value={paymentForm.account_holder} onChange={e => setPaymentForm(f => ({ ...f, account_holder: e.target.value }))} placeholder="e.g. Ahmad Razif bin Abdullah" />
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 mt-4">Payment details are saved when you click <strong>Save Settings</strong> below.</p>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}
