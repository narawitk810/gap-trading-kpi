'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

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

interface OrderForm {
  nickname: string
  quantity: string
  phone: string
  note: string
}

export default function PreorderPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [orderForm, setOrderForm] = useState<OrderForm>({ nickname: '', quantity: '1', phone: '', note: '' })
  const [orderErrors, setOrderErrors] = useState<Partial<OrderForm>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [orderedCounts, setOrderedCounts] = useState<Record<string, number>>({})
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/preorder-products?active=1')
      .then((r) => r.json())
      .then((data: Product[]) => {
        const today = new Date().toISOString().slice(0, 10)
        setProducts(data.filter((p) => p.close_date >= today))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function openModal(product: Product) {
    setSelectedProduct(product)
    setOrderForm({ nickname: '', quantity: '1', phone: '', note: '' })
    setOrderErrors({})
    setConfirmOpen(false)
    setErrorMsg('')
  }

  function closeModal() {
    setSelectedProduct(null)
    setConfirmOpen(false)
    setErrorMsg('')
  }

  function validateOrder(): boolean {
    const e: Partial<OrderForm> = {}
    if (!orderForm.nickname.trim()) e.nickname = 'กรุณากรอกชื่อ'
    const qty = Number(orderForm.quantity)
    if (!qty || qty < 1 || !Number.isInteger(qty)) e.quantity = 'กรุณาระบุจำนวนที่ถูกต้อง'
    setOrderErrors(e)
    return Object.keys(e).length === 0
  }

  function handleConfirm() {
    if (!validateOrder()) return
    setConfirmOpen(true)
  }

  async function handleSubmit() {
    if (!selectedProduct) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/preorder-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          nickname: orderForm.nickname.trim(),
          quantity: Number(orderForm.quantity),
          phone: orderForm.phone.trim(),
          note: orderForm.note.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        setConfirmOpen(false)
        setSubmitting(false)
        return
      }
      setOrderedCounts((prev) => ({ ...prev, [selectedProduct.id]: (prev[selectedProduct.id] || 0) + Number(orderForm.quantity) }))
      closeModal()
      setSuccessMsg(`จองสำเร็จแล้ว! ${selectedProduct.name} x${orderForm.quantity} ชิ้น`)
      if (toastRef.current) clearTimeout(toastRef.current)
      toastRef.current = setTimeout(() => setSuccessMsg(''), 4000)
    } catch {
      setErrorMsg('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  function formatPrice(price: number) {
    return price.toLocaleString('th-TH', { minimumFractionDigits: 0 })
  }

  function daysLeft(closeDate: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const close = new Date(closeDate)
    close.setHours(0, 0, 0, 0)
    const diff = Math.round((close.getTime() - today.getTime()) / 86400000)
    if (diff === 0) return 'ปิดรับวันนี้'
    if (diff === 1) return 'เหลือ 1 วัน'
    return `เหลือ ${diff} วัน`
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 pt-10 pb-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-3 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          กลับหน้าหลัก
        </Link>
        <p className="text-xs opacity-60 mb-1">GAP TRADING</p>
        <h1 className="text-2xl font-bold">Pre-Order (สำหรับดูเท่านั้น ตัดของใน Bigseller)</h1>
        <p className="text-sm opacity-70 mt-1">สั่งจองสินค้าล่วงหน้า · ก่อนปิดรับออเดอร์</p>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
        {loading ? (
          <div className="text-center py-16 text-gray-400">กำลังโหลด...</div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500 font-semibold">ยังไม่มีสินค้า Pre-Order ขณะนี้</p>
            <p className="text-xs text-gray-400 mt-1">ติดตามได้ทาง LINE ของทีมไลฟ์สด</p>
          </div>
        ) : (
          products.map((product) => {
            const days = daysLeft(product.close_date)
            const isUrgent = product.close_date === new Date().toISOString().slice(0, 10)
            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {product.image_data && (
                  <img
                    src={product.image_data}
                    alt={product.name}
                    className="w-full h-52 object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-bold text-[#1E3A5F] leading-tight">{product.name}</h2>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${isUrgent ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-amber-50 text-amber-700'}`}>
                      {days}
                    </span>
                  </div>
                  {product.description && (
                    <p className="text-sm text-gray-500 mt-1">{product.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="text-xl font-bold text-[#1E3A5F]">฿{formatPrice(product.price)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        ปิดรับ {formatDate(product.close_date)}
                        {product.max_qty > 0 && ` · จำกัด ${product.max_qty} ชิ้น`}
                      </p>
                    </div>
                    <button
                      onClick={() => openModal(product)}
                      className="bg-[#1E3A5F] text-white text-sm font-bold px-5 py-2.5 rounded-xl active:opacity-80 transition-opacity"
                    >
                      สั่งจอง
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Order Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0]">
              <div>
                <p className="text-xs text-gray-400">สั่งจอง</p>
                <p className="font-bold text-[#1E3A5F] text-base leading-tight">{selectedProduct.name}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!confirmOpen ? (
              <div className="p-4 space-y-4">
                {errorMsg && (
                  <div className="bg-[#DC2626]/10 text-[#DC2626] text-sm px-3 py-2 rounded-xl">{errorMsg}</div>
                )}

                {/* ชื่อ */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                    ชื่อ / ชื่อเล่น <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="text"
                    value={orderForm.nickname}
                    onChange={(e) => { setOrderForm((p) => ({ ...p, nickname: e.target.value })); setOrderErrors((p) => ({ ...p, nickname: '' })) }}
                    placeholder="กรอกชื่อหรือชื่อเล่น"
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] transition-colors ${orderErrors.nickname ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`}
                  />
                  {orderErrors.nickname && <p className="text-xs text-[#DC2626] mt-1">{orderErrors.nickname}</p>}
                </div>

                {/* จำนวน */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                    จำนวน <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOrderForm((p) => ({ ...p, quantity: String(Math.max(1, Number(p.quantity) - 1)) }))}
                      className="w-10 h-10 rounded-xl border border-[#E2E8F0] text-xl font-bold text-[#374151] flex items-center justify-center active:bg-gray-100"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={orderForm.quantity}
                      onChange={(e) => { setOrderForm((p) => ({ ...p, quantity: e.target.value })); setOrderErrors((p) => ({ ...p, quantity: '' })) }}
                      className={`flex-1 border rounded-xl px-3 py-2.5 text-sm text-center outline-none focus:border-[#1E3A5F] ${orderErrors.quantity ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setOrderForm((p) => ({ ...p, quantity: String(Number(p.quantity) + 1) }))}
                      className="w-10 h-10 rounded-xl border border-[#E2E8F0] text-xl font-bold text-[#374151] flex items-center justify-center active:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                  {orderErrors.quantity && <p className="text-xs text-[#DC2626] mt-1">{orderErrors.quantity}</p>}
                </div>

                {/* เบอร์โทร */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5">เบอร์โทร</label>
                  <input
                    type="tel"
                    value={orderForm.phone}
                    onChange={(e) => setOrderForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="เบอร์ติดต่อ (ไม่บังคับ)"
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] transition-colors"
                  />
                </div>

                {/* หมายเหตุ */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5">หมายเหตุ</label>
                  <textarea
                    value={orderForm.note}
                    onChange={(e) => setOrderForm((p) => ({ ...p, note: e.target.value }))}
                    placeholder="ระบุสี, ไซส์ หรือความต้องการพิเศษ (ไม่บังคับ)"
                    rows={2}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] transition-colors resize-none"
                  />
                </div>

                {/* ราคารวม */}
                <div className="bg-[#F5F6F8] rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm text-gray-500">ราคารวม</span>
                  <span className="font-bold text-[#1E3A5F] text-lg">
                    ฿{formatPrice(selectedProduct.price * (Number(orderForm.quantity) || 0))}
                  </span>
                </div>

                <button
                  onClick={handleConfirm}
                  className="w-full bg-[#1E3A5F] text-white font-bold py-3 rounded-xl active:opacity-80 transition-opacity"
                >
                  ยืนยันการสั่งจอง
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="bg-[#F5F6F8] rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">สินค้า</span>
                    <span className="font-semibold text-[#1E3A5F]">{selectedProduct.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">ชื่อ</span>
                    <span className="font-semibold">{orderForm.nickname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">จำนวน</span>
                    <span className="font-semibold">{orderForm.quantity} ชิ้น</span>
                  </div>
                  {orderForm.phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">เบอร์</span>
                      <span className="font-semibold">{orderForm.phone}</span>
                    </div>
                  )}
                  {orderForm.note && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">หมายเหตุ</span>
                      <span className="font-semibold">{orderForm.note}</span>
                    </div>
                  )}
                  <div className="border-t border-[#E2E8F0] pt-2 flex justify-between">
                    <span className="text-gray-500">ราคารวม</span>
                    <span className="font-bold text-[#1E3A5F] text-base">
                      ฿{formatPrice(selectedProduct.price * Number(orderForm.quantity))}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">กรุณาตรวจสอบข้อมูลก่อนส่ง</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setConfirmOpen(false)}
                    disabled={submitting}
                    className="py-3 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-gray-600 active:bg-gray-50"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="py-3 rounded-xl bg-[#16A34A] text-white text-sm font-bold active:opacity-80 disabled:opacity-60"
                  >
                    {submitting ? 'กำลังส่ง...' : 'ส่งออเดอร์'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast success */}
      {successMsg && (
        <div className="fixed bottom-6 left-4 right-4 z-50 max-w-md mx-auto">
          <div className="bg-[#16A34A] text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-3">
            <span className="text-lg">✅</span>
            <p className="text-sm font-semibold">{successMsg}</p>
          </div>
        </div>
      )}
    </div>
  )
}
