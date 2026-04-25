'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Package, ToggleLeft, ToggleRight, Upload, ImageIcon, X, Copy, Share2, Tag } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Item } from '@/lib/types'

interface PostModal {
  content: string
  itemName: string
  imageUrl: string | null
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [business, setBusiness] = useState<{ id: string; category: string; name: string } | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [postModal, setPostModal] = useState<PostModal | null>(null)
  const [generatingPost, setGeneratingPost] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '', type: 'product', image_url: '', available: true,
    discount_type: '', discount_value: '', promo_label: '', serviceArea: '',
    serviceHoursFrom: '09:00', serviceHoursTo: '17:00',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: biz } = await supabase.from('businesses').select('*').eq('user_id', user.id).single()
    if (!biz) return
    setBusiness(biz)
    const { data: itemsData } = await supabase.from('items').select('*').eq('business_id', biz.id).order('created_at', { ascending: false })
    setItems(itemsData || [])
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm({ name: '', description: '', price: '', stock: '', type: 'product', image_url: '', available: true, discount_type: '', discount_value: '', promo_label: '', serviceArea: '', serviceHoursFrom: '09:00', serviceHoursTo: '17:00' })
    setImagePreview(null)
    setShowModal(true)
  }

  function openEdit(item: Item) {
    setEditing(item)
    const i = item as Item & { discount_type?: string; discount_value?: number; promo_label?: string }
    const isServiceBiz = business?.category === 'service'
    const isDigitalBiz = business?.category === 'digital'
    const rawType = i.type || ''
    const serviceArea = isServiceBiz && rawType !== 'product' && rawType !== 'service' ? rawType : ''
    const savedHours = isServiceBiz && i.promo_label && i.promo_label.includes('-') ? i.promo_label.split('-') : null
    setForm({
      name: i.name,
      description: i.description || '',
      price: String(i.price),
      stock: i.stock !== null ? String(i.stock) : '',
      type: isServiceBiz ? 'service' : isDigitalBiz ? (i.type || 'downloadable') : (i.type || 'product'),
      image_url: i.image_url || '',
      available: i.available,
      discount_type: i.discount_type || '',
      discount_value: i.discount_value ? String(i.discount_value) : '',
      promo_label: isServiceBiz ? '' : (i.promo_label || ''),
      serviceArea,
      serviceHoursFrom: savedHours ? savedHours[0] : '09:00',
      serviceHoursTo: savedHours ? savedHours[1] : '17:00',
    })
    setImagePreview(i.image_url || null)
    setShowModal(true)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !business) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }
    setUploadingImage(true)
    const ext = file.name.split('.').pop()
    const path = `${business.id}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('item-images').upload(path, file, { upsert: false })
    if (error) {
      toast.error('Upload failed: ' + error.message)
      setUploadingImage(false)
      return
    }
    const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(data.path)
    setForm(f => ({ ...f, image_url: urlData.publicUrl }))
    setImagePreview(urlData.publicUrl)
    toast.success('Image uploaded!')
    setUploadingImage(false)
  }

  async function handleSave() {
    if (!business || !form.name || !form.price) {
      toast.error('Name and price are required')
      return
    }
    setSaving(true)
    const isServiceBiz = business.category === 'service'
    const isDigitalBiz = business.category === 'digital'
    const payload = {
      business_id: business.id,
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      stock: isServiceBiz || isDigitalBiz ? null : (form.stock ? parseInt(form.stock) : null),
      type: isServiceBiz ? (form.serviceArea.trim() || 'service') : isDigitalBiz ? (form.type || 'downloadable') : form.type,
      image_url: form.image_url || null,
      available: form.available,
      discount_type: form.discount_type || null,
      discount_value: form.discount_value ? parseFloat(form.discount_value) : null,
      promo_label: isServiceBiz
        ? `${form.serviceHoursFrom}-${form.serviceHoursTo}`
        : (form.promo_label || null),
    }
    if (editing) {
      const { error } = await supabase.from('items').update(payload).eq('id', editing.id)
      if (error) { toast.error('Failed to update'); setSaving(false); return }
      toast.success('Item updated')
      setSaving(false)
      setShowModal(false)
      loadData()
    } else {
      const { error } = await supabase.from('items').insert(payload)
      if (error) { toast.error('Failed to add'); setSaving(false); return }
      toast.success('Item added!')
      setSaving(false)
      setShowModal(false)
      loadData()
      // Auto-generate Instagram post
      generateItemPost(form.name, form.description, parseFloat(form.price), form.image_url || null)
    }
  }

  async function generateItemPost(name: string, description: string, price: number, imageUrl: string | null) {
    setGeneratingPost(true)
    setPostModal({ content: '', itemName: name, imageUrl })
    const loadingToast = toast.loading('Creating social post... (this takes ~20 sec)')
    try {
      const res = await fetch('/api/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'item-post', itemName: name, itemDescription: description, itemPrice: price }),
      })
      const data = await res.json()
      toast.dismiss(loadingToast)
      if (data.content) {
        setPostModal({ content: data.content, itemName: name, imageUrl })
        toast.success('Social post ready!')
      } else {
        toast.error(data.error || 'Could not generate post')
        setPostModal(null)
      }
    } catch {
      toast.dismiss(loadingToast)
      toast.error('Post generation failed — please try again')
      setPostModal(null)
    }
    setGeneratingPost(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) { toast.error('Failed to delete item'); return }
    toast.success('Item deleted')
    loadData()
  }

  async function toggleAvailable(item: Item) {
    const { error } = await supabase.from('items').update({ available: !item.available }).eq('id', item.id)
    if (error) { toast.error('Failed to update item'); return }
    loadData()
  }

  function copyPost(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Caption copied!')
  }

  function shareToFacebook(text: string) {
    const encoded = encodeURIComponent(text)
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encoded}&u=${encodeURIComponent(window.location.origin)}`, '_blank')
  }

  function shareToInstagram(text: string) {
    navigator.clipboard.writeText(text)
    toast.success('Caption copied! Opening Instagram...')
    setTimeout(() => window.open('https://www.instagram.com/', '_blank'), 800)
  }

  const labelMap: Record<string, string> = {
    food: 'Menu Items', physical: 'Inventory', digital: 'Products', service: 'Services'
  }
  const isService = business?.category === 'service'
  const isDigital = business?.category === 'digital'
  const isPhysical = business?.category === 'physical'

  if (loading) return <div className="p-8 text-gray-400 text-sm">Loading...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            {labelMap[business?.category || 'physical'] || 'Items'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} item{items.length !== 1 ? 's' : ''} listed</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> {isService ? 'Add Service' : 'Add Item'}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-500 font-medium">{isService ? 'No services yet' : 'No items yet'}</p>
          <p className="text-sm text-gray-400 mb-6">{isService ? 'Add your first service so customers can browse and book' : 'Add your first item so customers can see and order it'}</p>
          <button onClick={openAdd} className="btn-primary">{isService ? 'Add First Service' : 'Add First Item'}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map(item => (
            <div key={item.id} className={`card group relative flex flex-col ${!item.available ? 'opacity-60' : ''}`}>
              {item.image_url ? (
                <div className="h-40 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-2xl">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-32 -mx-6 -mt-6 mb-4 overflow-hidden rounded-t-2xl bg-gray-100 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-gray-900 text-sm leading-snug">{item.name}</h3>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {(item as Item & { discount_type?: string; discount_value?: number }).discount_type && (item as Item & { discount_type?: string; discount_value?: number }).discount_value ? (
                      <>
                        <span className="badge bg-red-50 text-red-600 line-through text-xs">RM {item.price?.toFixed(2)}</span>
                        <span className="badge bg-violet-50 text-violet-700">
                          RM {((item as Item & { discount_type?: string; discount_value?: number }).discount_type === 'percentage'
                            ? item.price * (1 - (item as Item & { discount_value?: number }).discount_value! / 100)
                            : item.price - (item as Item & { discount_value?: number }).discount_value!
                          ).toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="badge bg-violet-50 text-violet-700">RM {item.price?.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                {!isService && (item as Item & { promo_label?: string }).promo_label && (
                  <span className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 font-semibold px-2 py-0.5 rounded-full mt-1">
                    <Tag className="w-3 h-3" />{(item as Item & { promo_label?: string }).promo_label}
                  </span>
                )}
                {item.description && (
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{item.description}</p>
                )}
                {business?.category === 'digital' && (
                  <p className="text-xs mt-2">
                    {item.type === 'downloadable' || item.type === '' || item.type === 'product'
                      ? <span className="text-violet-600 font-medium">📥 Downloadable</span>
                      : <span className="text-blue-600 font-medium">🔐 Access-Based</span>}
                  </p>
                )}
                {isService ? (
                  <>
                    {item.type && item.type !== 'product' && item.type !== 'service' && (
                      <p className="text-xs text-gray-400 mt-2">📍 {item.type}</p>
                    )}
                    {(item as Item & { promo_label?: string }).promo_label && (item as Item & { promo_label?: string }).promo_label!.includes('-') && (
                      <p className="text-xs text-violet-600 font-medium mt-1">
                        ⏰ {(() => {
                          const [from, to] = (item as Item & { promo_label?: string }).promo_label!.split('-')
                          const fmt = (t: string) => { const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}` }
                          return `${fmt(from)} – ${fmt(to)}`
                        })()}
                      </p>
                    )}
                  </>
                ) : (
                  item.stock !== null && (
                    <p className="text-xs text-gray-400 mt-2">Stock: {item.stock}</p>
                  )
                )}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <button onClick={() => toggleAvailable(item)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                  {item.available
                    ? <ToggleRight className="w-4 h-4 text-green-500" />
                    : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                  {item.available ? 'Available' : 'Hidden'}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => generateItemPost(item.name, item.description || '', item.price, item.image_url)}
                    className="p-1.5 hover:bg-purple-50 rounded-lg text-gray-400 hover:text-purple-500 transition-colors"
                    title="Generate ad post"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEdit(item)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  {editing
                    ? isService ? 'Edit Service' : isDigital ? 'Edit Product' : isPhysical ? 'Edit Product' : 'Edit Item'
                    : isService ? 'Add New Service' : isDigital ? 'Add New Product' : isPhysical ? 'Add New Product' : 'Add New Item'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                {/* Image upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{isService ? 'Service Photo' : 'Item Photo'}</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="relative h-40 rounded-xl border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer hover:border-violet-400 transition-colors group"
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <p className="text-white text-xs font-medium">Click to change</p>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                        {uploadingImage ? (
                          <div className="text-sm">Uploading...</div>
                        ) : (
                          <>
                            <Upload className="w-7 h-7" />
                            <p className="text-sm font-medium">Click to upload photo</p>
                            <p className="text-xs">JPG, PNG, WEBP — max 5MB</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={() => { setImagePreview(null); setForm(f => ({ ...f, image_url: '' })) }}
                      className="text-xs text-red-400 hover:text-red-600 mt-1"
                    >
                      Remove photo
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {isService ? 'Service Title *' : isDigital ? 'Product Title *' : isPhysical ? 'Product Name *' : 'Name *'}
                  </label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder={isService ? 'e.g. Air-Cond Servicing' : isDigital ? 'e.g. Python Masterclass, Logo Design Pack' : isPhysical ? 'e.g. Blue Denim Jacket, Wireless Earbuds' : 'e.g. Nasi Lemak'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {isService ? "What's Included / Details" : isDigital ? 'Description / What Customers Get' : isPhysical ? 'Product Details' : 'Description'}
                  </label>
                  <textarea
                    className="input resize-none h-20"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder={isService ? 'Describe what the service includes...' : isDigital ? 'Describe what is included, course modules, file formats, access details...' : isPhysical ? 'Material, size options, colour, what\'s included...' : 'Brief description...'}
                  />
                </div>

                {/* Digital-specific fields */}
                {isDigital && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Product Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, type: 'downloadable' })}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                          form.type === 'downloadable' || form.type === '' || form.type === 'product'
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl">📥</span>
                        Downloadable
                        <span className="text-xs font-normal opacity-70">File, PDF, ZIP, etc.</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, type: 'non-downloadable' })}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                          form.type === 'non-downloadable'
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl">🔐</span>
                        Access-Based
                        <span className="text-xs font-normal opacity-70">Course, membership, etc.</span>
                      </button>
                    </div>
                  </div>
                )}

                {isService && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Coverage Area</label>
                      <input className="input" value={form.serviceArea} onChange={e => setForm({ ...form, serviceArea: e.target.value })} placeholder="e.g. Shah Alam, Klang Valley, Petaling Jaya" />
                      <p className="text-xs text-gray-400 mt-1">Where do you provide this service?</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">⏰ Available Hours</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">From</label>
                          <input type="time" className="input text-sm" value={form.serviceHoursFrom} onChange={e => setForm({ ...form, serviceHoursFrom: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">To</label>
                          <input type="time" className="input text-sm" value={form.serviceHoursTo} onChange={e => setForm({ ...form, serviceHoursTo: e.target.value })} />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">Customers can select a 1-hour time slot within this window</p>
                    </div>
                  </>
                )}
                <div className={`grid gap-3 ${isDigital ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{isService ? 'Charges (RM) *' : 'Price (RM) *'}</label>
                    <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
                  </div>
                  {!isDigital && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{isService ? 'Duration (hrs, optional)' : isPhysical ? 'Quantity Available *' : 'Stock (optional)'}</label>
                      <input className="input" type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder={isService ? 'e.g. 2' : isPhysical ? 'e.g. 50' : 'Unlimited'} />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="available" checked={form.available} onChange={e => setForm({ ...form, available: e.target.checked })} className="w-4 h-4 accent-violet-600" />
                  <label htmlFor="available" className="text-sm font-medium text-gray-700">
                    {isService ? 'Available for booking' : isDigital ? 'Listed & available for purchase' : isPhysical ? 'Listed & in stock' : 'Available for purchase'}
                  </label>
                </div>

                {/* Promo / Discount */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-orange-500" />
                    <p className="text-sm font-semibold text-gray-800">Promo / Discount (optional)</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Discount Type</label>
                      <select className="input text-sm" value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })}>
                        <option value="">No discount</option>
                        <option value="percentage">Percentage (e.g. 20%)</option>
                        <option value="fixed">Fixed amount (e.g. RM5 off)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {form.discount_type === 'percentage' ? 'Discount %' : 'Amount Off (RM)'}
                      </label>
                      <input
                        className="input text-sm"
                        type="number"
                        min="0"
                        step={form.discount_type === 'percentage' ? '1' : '0.01'}
                        value={form.discount_value}
                        onChange={e => setForm({ ...form, discount_value: e.target.value })}
                        placeholder={form.discount_type === 'percentage' ? 'e.g. 20' : 'e.g. 5.00'}
                        disabled={!form.discount_type}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Promo Badge Label (shown to customers)</label>
                    <input
                      className="input text-sm"
                      value={form.promo_label}
                      onChange={e => setForm({ ...form, promo_label: e.target.value })}
                      placeholder={form.discount_type === 'percentage' ? `e.g. ${form.discount_value || '20'}% OFF!` : `e.g. Save RM${form.discount_value || '5'}!`}
                      disabled={!form.discount_type || isService}
                    />
                    {isService && <p className="text-xs text-gray-400 mt-1">Discount will show as a price reduction on the service card</p>}
                  </div>
                  {form.discount_type && form.discount_value && form.price && (
                    <div className="mt-2 p-2 bg-orange-50 rounded-lg text-xs text-orange-700 font-medium">
                      Preview: RM{(form.discount_type === 'percentage'
                        ? parseFloat(form.price) * (1 - parseFloat(form.discount_value) / 100)
                        : parseFloat(form.price) - parseFloat(form.discount_value)
                      ).toFixed(2)} after discount
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleSave} disabled={saving || uploadingImage} className="btn-primary flex-1 disabled:opacity-60">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Post Modal */}
      {postModal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">AI-Generated Ad Post</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Ready to share for: {postModal.itemName}</p>
                </div>
                <button onClick={() => setPostModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {generatingPost ? (
                <div className="flex flex-col items-center py-12 gap-4">
                  <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                  <p className="text-sm text-gray-500">Generating your ad post...</p>
                </div>
              ) : (
                <>
                  {postModal.imageUrl && (
                    <div className="h-48 rounded-xl overflow-hidden mb-4">
                      <img src={postModal.imageUrl} alt={postModal.itemName} className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4 mb-5">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{postModal.content}</p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => copyPost(postModal.content)}
                      className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                    >
                      <Copy className="w-4 h-4" /> Copy Caption
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => shareToFacebook(postModal.content)}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1877F2] text-white text-sm font-medium hover:bg-[#166FE5] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        Share on Facebook
                      </button>
                      <button
                        onClick={() => shareToInstagram(postModal.content)}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                        Share on Instagram
                      </button>
                    </div>
                    <p className="text-xs text-center text-gray-400">Instagram: caption is copied to clipboard, then Instagram opens</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
