'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const ADMIN_KEY = 'GAPtrading2024admin'

interface Product {
  id: string
  name: string
  description: string
  price: number
  close_date: string
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
  max_qty: string
  image_data: string
}

const emptyForm: ProductForm = { name: '', description: '', price: '', close_date: '', max_qty: '0', image_data: '' }

function AdminContent() {
  const searchParams = useSearchParams()
  const key = searchParams.get('key') || ''

  const [authed, setAuthed] = useState(false)
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

  const imageRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (key === ADMIN_KEY) setAuthed(true)
  }, [key])

  const loadProducts = useCallback(async () => {
    const res = await fetch(`/api/preorder-products?key=${key}`)
    if (res.ok) setProducts(await res.json())
  }, [key])

  const loadOrders = useCallback(async () => {
    const url = filterProductId
      ? `/api/preorder-orders?key=${key}&product_id=${filterProductId}`
      : `/api/preorder-orders?key=${key}`
    const res = await fetch(url)
    if (res.ok) setOrders(await res.json())
  }, [key, filterProductId])

  useEffect(() => {
    if (!authed) return
    Promise.all([loadProducts(), loadOrders()]).finally(() => setLoading(false))
  }, [authed, loadProducts, loadOrders])

  useEffect(() => {
    if (!authed) return
    loadOrders()
  }, [filterProductId, authed, loadOrders])

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setForm((p) => ({ ...p, image_data: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  function openAdd() {
    setForm(emptyForm)
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
      max_qty: String(p.max_qty),
      image_data: p.image_data,
    })
    setEditingId(p.id)
    setFormErrors({})
    setSaveError('')
    setShowForm(true)
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
        max_qty: Number(form.max_qty) || 0,
        image_data: form.image_data,
      }
      const url = editingId
        ? `/api/preorder-products/${editingId}?key=${key}`
        : `/api/preorder-products?key=${key}`
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
    await fetch(`/api/preorder-products/${p.id}?key=${key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: p.is_active ? 0 : 1 }),
    })
    await loadProducts()
  }

  async function deleteProduct(p: Product) {
    if (!confirm(`ลบ "${p.name}" และออเดอร์ทั้งหมดของสินค้านี้?`)) return
    await fetch(`/api/preorder-products/${p.id}?key=${key}`, { method: 'DELETE' })
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

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
          <p className="text-4xl mb-3">🔒</p>
          <p className="font-bold text-[#1E3A5F] text-lg">ไม่มีสิทธิ์เข้าถึง</p>
          <p className="text-sm text-gray-400 mt-2">กรุณาใช้ลิงก์ที่ถูกต้องจาก Admin</p>
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
                  {p.image_data && (
                    <img src={p.image_data} alt={p.name} className="w-16 h-16 object-cover rounded-xl shrink-0" />
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

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
              <p className="font-bold text-[#1E3A5F]">{editingId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</p>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {saveError && (
                <div className="bg-[#DC2626]/10 text-[#DC2626] text-sm px-3 py-2 rounded-xl">{saveError}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">ชื่อสินค้า <span className="text-[#DC2626]">*</span></label>
                <input type="text" value={form.name} onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setFormErrors((p) => ({ ...p, name: '' })) }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] ${formErrors.name ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`} placeholder="ชื่อสินค้า" />
                {formErrors.name && <p className="text-xs text-[#DC2626] mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">รายละเอียด</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] resize-none" placeholder="รายละเอียดเพิ่มเติม" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5">ราคา (บาท) <span className="text-[#DC2626]">*</span></label>
                  <input type="number" min="0" value={form.price} onChange={(e) => { setForm((p) => ({ ...p, price: e.target.value })); setFormErrors((p) => ({ ...p, price: '' })) }}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] ${formErrors.price ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`} placeholder="0" />
                  {formErrors.price && <p className="text-xs text-[#DC2626] mt-1">{formErrors.price}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5">จำกัดจำนวน (0=ไม่จำกัด)</label>
                  <input type="number" min="0" value={form.max_qty} onChange={(e) => setForm((p) => ({ ...p, max_qty: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F]" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">วันปิดรับออเดอร์ <span className="text-[#DC2626]">*</span></label>
                <input type="date" value={form.close_date} onChange={(e) => { setForm((p) => ({ ...p, close_date: e.target.value })); setFormErrors((p) => ({ ...p, close_date: '' })) }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] ${formErrors.close_date ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`} />
                {formErrors.close_date && <p className="text-xs text-[#DC2626] mt-1">{formErrors.close_date}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">รูปสินค้า</label>
                <input ref={imageRef} type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                {form.image_data ? (
                  <div className="relative">
                    <img src={form.image_data} alt="preview" className="w-full h-40 object-cover rounded-xl" />
                    <button onClick={() => { setForm((p) => ({ ...p, image_data: '' })); if (imageRef.current) imageRef.current.value = '' }}
                      className="absolute top-2 right-2 bg-white/90 text-[#DC2626] text-xs font-bold px-2 py-1 rounded-lg shadow">
                      ลบรูป
                    </button>
                  </div>
                ) : (
                  <button onClick={() => imageRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-8 text-center text-gray-400 text-sm hover:border-[#1E3A5F]/30 transition-colors">
                    แตะเพื่อเลือกรูป
                  </button>
                )}
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full bg-[#1E3A5F] text-white font-bold py-3 rounded-xl disabled:opacity-60 active:opacity-80">
                {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
              </button>
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
