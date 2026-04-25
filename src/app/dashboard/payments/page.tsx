'use client'
import { useState, useEffect } from 'react'
import { CreditCard, QrCode, Building, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PaymentMethod } from '@/lib/types'
import toast from 'react-hot-toast'

export default function PaymentsPage() {
  const [payment, setPayment] = useState<PaymentMethod | null>(null)
  const [businessId, setBusinessId] = useState('')
  const [type, setType] = useState<'qr' | 'bank'>('qr')
  const [form, setForm] = useState({
    qr_url: '',
    bank_name: '',
    account_number: '',
    account_holder: '',
  })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: biz } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()
    if (!biz) return
    setBusinessId(biz.id)
    const { data: pm } = await supabase.from('payment_methods').select('*').eq('business_id', biz.id).single()
    if (pm) {
      setPayment(pm as PaymentMethod)
      setType((pm.type as 'qr' | 'bank') || 'qr')
      setForm({
        qr_url: pm.qr_url || '',
        bank_name: pm.bank_name || '',
        account_number: pm.account_number || '',
        account_holder: pm.account_holder || '',
      })
    }
  }

  async function handleSave() {
    if (!businessId) return
    setSaving(true)

    const payload = {
      business_id: businessId,
      type,
      qr_url: type === 'qr' ? form.qr_url : null,
      bank_name: type === 'bank' ? form.bank_name : null,
      account_number: type === 'bank' ? form.account_number : null,
      account_holder: type === 'bank' ? form.account_holder : null,
    }

    if (payment) {
      const { error } = await supabase.from('payment_methods').update(payload).eq('id', payment.id)
      if (error) { toast.error('Failed to save'); setSaving(false); return }
    } else {
      const { error } = await supabase.from('payment_methods').insert(payload)
      if (error) { toast.error('Failed to save'); setSaving(false); return }
    }

    toast.success('Payment details saved!')
    setSaving(false)
    loadData()
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Payment Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Set how customers pay for their orders</p>
      </div>

      <div className="card">
        {/* Type selector */}
        <div className="flex gap-3 mb-6">
          {[
            { key: 'qr', label: 'QR Code', icon: QrCode },
            { key: 'bank', label: 'Bank Transfer', icon: Building },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setType(key as 'qr' | 'bank')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm border-2 transition-all ${
                type === key
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {type === 'qr' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">QR Code Image URL</label>
              <input
                className="input"
                value={form.qr_url}
                onChange={e => setForm({ ...form, qr_url: e.target.value })}
                placeholder="https://... (link to your QR code image)"
              />
              <p className="text-xs text-gray-400 mt-1.5">Upload your QR code to any image host (e.g. Imgur) and paste the link here</p>
            </div>
            {form.qr_url && (
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-gray-600 mb-3">Preview</p>
                <img src={form.qr_url} alt="QR Code" className="w-40 h-40 object-contain mx-auto rounded-xl border border-gray-200" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name</label>
              <input className="input" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. Maybank, CIMB, RHB" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Number</label>
              <input className="input" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} placeholder="e.g. 1234567890" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Account Holder Name</label>
              <input className="input" value={form.account_holder} onChange={e => setForm({ ...form, account_holder: e.target.value })} placeholder="e.g. Ahmad Razif bin Abdullah" />
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Payment Details'}
        </button>
      </div>

      {/* Info */}
      <div className="card mt-4 bg-blue-50 border border-blue-100">
        <div className="flex gap-3">
          <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">How payments work</p>
            <p className="text-xs text-blue-600 mt-1">
              When a customer checks out, they see your QR code or bank details. After paying, they upload their receipt. 
              You can then confirm the order from the Orders page.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
