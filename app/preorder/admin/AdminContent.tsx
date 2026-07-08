'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'

const ADMIN_KEY = 'GAPtrading2024admin'
const PAGE_PASSWORD = 'admin12345'

interface Product {
  id: string
  name: string
  description: string
  price: number
  close_date: string
  release_date: string
  max_qty: number
  image_data: string
  is_active: number
}

interface Order {
  id: string
  product_id: string
  nickname: string
  quantity: number
  phone: string
  note: string
  status: string
  created_at: string
}

interface ProductForm {
  name: string
  description: string
  price: string
  close_date: string
  release_date: string
  max_qty: string
}

const emptyForm: ProductForm = { name: '', description: '', price: '', close_date: '', release_date: '', max_qty: '0' }

function parseImages(raw: string): string[] {
  if (!raw) return []
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw] }
  catch { return raw ? [raw] : [] }
}

function AdminContent() {
  const [authed, setAuthed] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [tab, setTab] = useState<'products' | 'orders'>('products')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProductId, setFilterProductId] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [formErrors, setFormErrors] = useState<Partial<ProductForm>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [fileKey, setFileKey] = useState(0)
  const [compressing, setCompressing] = useState(false)

  function handleLogin() {
    if (passwordInput === PAGE_PASSWORD) {
      setAuthed(true)
    } else {
      setPasswordError('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่')
    }
  }

  const loadProducts = useCallback(async () => {
    const res = await fetch(`/api/preorder-products?key=${ADMIN_KEY}`)
    if (res.ok) setProducts(await res.json())
  }, [])

  const loadOrders = useCallback(async () => {
    const url = filterProductId
      ? `/api/preorder-orders?key=${ADMIN_KEY}&product_id=${filterProductId}`
      : `/api/preorder-orders?key=${ADMIN_KEY}`
    const res = await fetch(url)
    if (res.ok) setOrders(await res.json())
  }, [filterProductId])

  useEffect(() => {
    if (!authed) return
    Promise.all([loadProducts(), loadOrders()]).finally(() => setLoading(false))
  }, [authed, loadProducts, loadOrders])

  useEffect(() => {
    if (!authed) return
    loadOrders()
  }, [filterProductId, authed, loadOrders])

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new Image()
        img.onload = () => {
          const MAX = 1200
          let { width, height } = img
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
            else { width = Math.round((width * MAX) / height); height = MAX }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.78))
        }
        img.src = ev.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  async function handleAddImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCompressing(true)
    try {
      const src = await compressImage(file)
      setImages((prev) => [...prev, src].slice(0, 10))
    } finally {
      setCompressing(false)
      setFileKey((k) => k + 1)
    }
  }

  function openAdd() {
    setForm(emptyForm)
    setImages([])
    setFileKey(0)
    setEditingId(null)
    setFormErrors({})
    setSaveError('')
    setShowForm(true)
  }

  function openEdit(p: Product) {
    setForm({
      name: p.name,
      description: p.description,
      price: String(p.price),
      close_date: p.close_date,
      release_date: p.release_date || '',
      max_qty: String(p.max_qty),
    })
    setImages(parseImages(p.image_data))
    setFileKey(0)
    setEditingId(p.id)
    setFormErrors({})
    setSaveError('')
    setShowForm(true)
    fetch(`/api/preorder-products/${p.id}`)
      .then((r) => r.json())
      .then((full: Product) => setImages(parseImages(full.image_data)))
      .catch(() => {})
  }

  function validateForm(): boolean {
    const e: Partial<ProductForm> = {}
    if (!form.name.trim()) e.name = 'กรุณากรอกชื่อสินค้า'
    if (!form.close_date.trim()) e.close_date = 'กรุณาระบุวันปิดรับ'
    if (!form.price.trim() || isNaN(Number(form.price))) e.price = 'กรุณากรอกราคา'
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validateForm()) return
    setSaving(true)
    setSaveError('')
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        close_date: form.close_date,
        release_date: form.release_date.trim(),
        max_qty: Number(form.max_qty) || 0,
        image_data: images.length > 0 ? JSON.stringify(images) : '',
      }
      const url = editingId
        ? `/api/preorder-products/${editingId}?key=${ADMIN_KEY}`
        : `/api/preorder-products?key=${ADMIN_KEY}`
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error || 'เกิดข้อผิดพลาด'); return }
      setShowForm(false)
      await loadProducts()
    } catch {
      setSaveError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/preorder-products/${p.id}?key=${ADMIN_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: p.is_active ? 0 : 1 }),
    })
    await loadProducts()
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`ลบ "${p.name}" และออเดอร์ทั้งหมดของสินค้านี้?`)) return
    await fetch(`/api/preorder-products/${p.id}?key=${ADMIN_KEY}`, { method: 'DELETE' })
    await loadProducts()
    await loadOrders()
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatDateTime(d: string) {
    return new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function getProductName(id: string) {
    return products.find((p) => p.id === id)?.name || id
  }

  function orderSummary() {
    const filtered = filterProductId ? orders.filter((o) => o.product_id === filterProductId) : orders
    const byProduct: Record<string, number> = {}
    filtered.forEach((o) => {
      if (o.status !== 'cancelled') byProduct[o.product_id] = (byProduct[o.product_id] || 0) + o.quantity
    })
    return byProduct
  }

  // หน้าใส่รหัสผ่าน
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full space-y-4">
          <p className="text-4xl text-center">🔒</p>
          <p className="font-bold text-[#1E3A5F] text-lg text-center">Pre-Order Admin</p>
          <p className="text-sm text-gray-400 text-center">กรุณาใส่รหัสผ่านเพื่อเข้าใช้งาน</p>
          <div>
            <input
              type="password"
              placeholder="ใส่รหัสผ่าน"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className={`w-full border rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1E3A5F] transition-colors ${passwordError ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`}
            />
            {passwordError && <p className="text-xs text-[#DC2626] mt-1.5">{passwordError}</p>}
          </div>
          <button
            onClick={handleLogin}
            className="w-full bg-[#1E3A5F] text-white font-bold py-3 rounded-xl active:opacity-80 transition-opacity"
          >
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center text-gray-400">กำลังโหลด...</div>
  }

  const summary = orderSummary()

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 pt-10 pb-5">
        <p className="text-xs opacity-60 mb-1">GAP TRADING · Admin</p>
        <h1 className="text-xl font-bold">จัดการ Pre-Order</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#E2E8F0] px-4">
        <div className="flex gap-0 max-w-lg mx-auto">
          {(['products', 'orders'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${tab === t ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-gray-400'}`}
            >
              {t === 'products' ? `สินค้า (${products.length})` : `ออเดอร์ (${orders.filter((o) => o.status !== 'cancelled').length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* Products Tab */}
        {tab === 'products' && (
          <div className="space-y-3">
            <button
              onClick={openAdd}
              className="w-full bg-[#1E3A5F] text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:opacity-80"
            >
              <span className="text-lg">+</span> เพิ่มสินค้า Pre-Order
            </button>

            {products.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
                <p className="text-3xl mb-2">📦</p>
                <p>ยังไม่มีสินค้า</p>
              </div>
            )}

            {products.map((p) => (
              <div key={p.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${!p.is_active ? 'opacity-60' : ''}`}>
                <div className="flex gap-3 p-3">
                  {parseImages(p.image_data)[0] && (
                    <div className="relative shrink-0">
                      <img src={parseImages(p.image_data)[0]} alt={p.name} className="w-16 h-16 object-cover rounded-xl" />
                      {parseImages(p.image_data).length > 1 && (
                        <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[9px] font-bold px-1 rounded">
                          {parseImages(p.image_data).length}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-bold text-[#1E3A5F] text-sm leading-tight">{p.name}</p>
                      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.is_active ? 'เปิด' : 'ปิด'}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[#374151] mt-0.5">
                      ฿{p.price.toLocaleString('th-TH')}
                      {p.max_qty > 0 && <span className="font-normal text-xs text-gray-400 ml-1">· จำกัด {p.max_qty} ชิ้น</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">ปิดรับ {formatDate(p.close_date)}</p>
                    {summary[p.id] && (
                      <p className="text-xs text-amber-600 font-semibold mt-0.5">สั่งแล้ว {summary[p.id]} ชิ้น</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-[#E2E8F0] px-3 py-2 flex gap-2">
                  <button onClick={() => openEdit(p)} className="flex-1 text-xs font-semibold text-[#1E3A5F] py-1.5 rounded-lg hover:bg-[#1E3A5F]/5 transition-colors">
                    แก้ไข
                  </button>
                  <button onClick={() => toggleActive(p)} className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${p.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-[#16A34A] hover:bg-green-50'}`}>
                    {p.is_active ? 'ปิดรับ' : 'เปิดรับ'}
                  </button>
                  <button onClick={() => deleteProduct(p)} className="flex-1 text-xs font-semibold text-[#DC2626] py-1.5 rounded-lg hover:bg-[#DC2626]/5 transition-colors">
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Orders Tab */}
        {tab === 'orders' && (
          <div className="space-y-3">
            {/* Summary */}
            {Object.keys(summary).length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-[#374151] mb-2">สรุปออเดอร์</p>
                <div className="space-y-1">
                  {Object.entries(summary).map(([pid, qty]) => (
                    <div key={pid} className="flex justify-between text-sm">
                      <span className="text-gray-600">{getProductName(pid)}</span>
                      <span className="font-bold text-[#1E3A5F]">{qty} ชิ้น</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter */}
            <div>
              <select
                value={filterProductId}
                onChange={(e) => setFilterProductId(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-[#1E3A5F]"
              >
                <option value="">ทุกสินค้า</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
                <p className="text-3xl mb-2">📋</p>
                <p>ยังไม่มีออเดอร์</p>
              </div>
            ) : (
              orders.map((o) => (
                <div key={o.id} className={`bg-white rounded-2xl p-4 shadow-sm ${o.status === 'cancelled' ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#1E3A5F] text-sm">{o.nickname}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{getProductName(o.product_id)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-[#1E3A5F] text-sm">{o.quantity} ชิ้น</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${o.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : o.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {o.status === 'cancelled' ? 'ยกเลิก' : o.status === 'confirmed' ? 'ยืนยัน' : 'รอดำเนินการ'}
                      </span>
                    </div>
                  </div>
                  {(o.phone || o.note) && (
                    <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-xs text-gray-500 space-y-0.5">
                      {o.phone && <p>📞 {o.phone}</p>}
                      {o.note && <p>📝 {o.note}</p>}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{formatDateTime(o.created_at)}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Product Form — full screen */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-[#F5F6F8] overflow-y-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="bg-[#1E3A5F] text-white px-4 pt-10 pb-4 flex items-center justify-between">
            <p className="font-bold text-lg">{editingId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</p>
            <button onClick={() => setShowForm(false)} className="text-white/70 hover:text-white p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="max-w-md mx-auto">

            <div className="p-4 space-y-3">
              {saveError && (
                <div className="bg-[#DC2626]/10 text-[#DC2626] text-sm px-3 py-2 rounded-xl">{saveError}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">ชื่อสินค้า <span className="text-[#DC2626]">*</span></label>
                <input type="text" value={form.name} onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setFormErrors((p) => ({ ...p, name: '' })) }}
                  className={`w-full border rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] ${formErrors.name ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`} placeholder="ชื่อสินค้า" />
                {formErrors.name && <p className="text-xs text-[#DC2626] mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">ราคา (บาท) <span className="text-[#DC2626]">*</span></label>
                <input type="number" min="0" value={form.price} onChange={(e) => { setForm((p) => ({ ...p, price: e.target.value })); setFormErrors((p) => ({ ...p, price: '' })) }}
                  className={`w-full border rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] ${formErrors.price ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`} placeholder="0" />
                {formErrors.price && <p className="text-xs text-[#DC2626] mt-1">{formErrors.price}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">วันปิดรับออเดอร์ <span className="text-[#DC2626]">*</span></label>
                <input type="date" value={form.close_date} onChange={(e) => { setForm((p) => ({ ...p, close_date: e.target.value })); setFormErrors((p) => ({ ...p, close_date: '' })) }}
                  className={`w-full border rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] ${formErrors.close_date ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`} />
                {formErrors.close_date && <p className="text-xs text-[#DC2626] mt-1">{formErrors.close_date}</p>}
              </div>

              <div className="bg-[#1E3A5F]/8 border border-[#1E3A5F]/20 rounded-2xl p-3">
                <label className="block text-sm font-bold text-[#1E3A5F] mb-2">📅 วันวางจำหน่าย</label>
                <input type="date" value={form.release_date} onChange={(e) => setForm((p) => ({ ...p, release_date: e.target.value }))}
                  className="w-full border border-[#1E3A5F]/30 bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F]" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">จำกัดจำนวน (0=ไม่จำกัด)</label>
                <input type="number" min="0" value={form.max_qty} onChange={(e) => setForm((p) => ({ ...p, max_qty: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]" placeholder="0" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">รายละเอียด</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] resize-none" placeholder="รายละเอียดเพิ่มเติม" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#374151]">รูปสินค้า</label>
                  <span className="text-[10px] text-gray-400">{images.length}/10 รูป</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative aspect-square">
                      <img src={src} alt={`รูป ${i + 1}`} className="w-full h-full object-cover rounded-xl" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-white/90 text-[#DC2626] text-xs font-bold rounded-full shadow flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {images.length < 10 && (
                    <label className={`aspect-square border-2 border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${compressing ? 'opacity-50' : 'text-gray-400 hover:border-[#1E3A5F]/30'}`}>
                      <input key={fileKey} type="file" accept="image/*" onChange={handleAddImage} className="hidden" disabled={compressing} />
                      <span className="text-xl leading-none">{compressing ? '⏳' : '+'}</span>
                      <span className="text-[10px]">{compressing ? 'กำลังบีบ...' : 'เพิ่มรูป'}</span>
                    </label>
                  )}
                </div>
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full bg-[#1E3A5F] text-white font-bold py-3 rounded-xl disabled:opacity-60 active:opacity-80">
                {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
              </button>
              <div className="pb-8" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PreorderAdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center text-gray-400">กำลังโหลด...</div>}>
      <AdminContent />
    </Suspense>
  )
}
