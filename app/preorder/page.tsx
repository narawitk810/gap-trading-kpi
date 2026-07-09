'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  description: string
  price: number
  close_date: string
  release_date: string
  sku: string
  max_qty: number
  image_data: string
  is_active: number
}

export default function PreorderPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Product | null>(null)
  const [selectedFull, setSelectedFull] = useState<Product | null>(null)

  function openDetail(product: Product) {
    setSelected(product)
    setSelectedFull(null)
    fetch(`/api/preorder-products/${product.id}`)
      .then((r) => r.json())
      .then((full: Product) => setSelectedFull(full))
      .catch(() => setSelectedFull(product))
  }

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

  function parseImages(raw: string): string[] {
    if (!raw) return []
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw] }
    catch { return raw ? [raw] : [] }
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

  function isUrgentDate(closeDate: string) {
    return closeDate === new Date().toISOString().slice(0, 10)
  }

  const selectedImgs = selectedFull ? parseImages(selectedFull.image_data) : (selected ? parseImages(selected.image_data) : [])

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
        <h1 className="text-2xl font-bold">Pre-Order</h1>
        <p className="text-sm opacity-70 mt-1">แคตตาล็อกสินค้า · กดดูรายละเอียด</p>
      </div>

      <div className="max-w-lg mx-auto">
        {loading ? (
          <div className="text-center py-16 text-gray-400">กำลังโหลด...</div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-2xl mx-4 mt-5 p-8 text-center shadow-sm">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500 font-semibold">ยังไม่มีสินค้า Pre-Order ขณะนี้</p>
            <p className="text-xs text-gray-400 mt-1">ติดตามได้ทาง LINE ของทีมไลฟ์สด</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4">
            {products.map((product) => {
              const imgs = parseImages(product.image_data)
              const firstImg = imgs[0]
              const urgent = isUrgentDate(product.close_date)
              return (
                <button
                  key={product.id}
                  onClick={() => openDetail(product)}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden text-left active:scale-95 transition-transform"
                >
                  {firstImg ? (
                    <img
                      src={firstImg}
                      alt={product.name}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-[#F5F6F8] flex items-center justify-center text-4xl">
                      🛍️
                    </div>
                  )}
                  <div className="p-2.5 space-y-1">
                    <p className="text-xs font-bold text-[#1E3A5F] leading-tight line-clamp-2">{product.name}</p>
                    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${urgent ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-amber-50 text-amber-700'}`}>
                      {daysLeft(product.close_date)}
                    </span>
                    {product.release_date && (
                      <p className="text-[10px] text-[#1E3A5F]/60">วางจำหน่าย {formatDate(product.release_date)}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail Modal (bottom sheet) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-t-3xl max-h-[88vh] overflow-y-auto">
            {/* ปุ่มปิด */}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/10 text-[#374151] text-sm font-bold rounded-full flex items-center justify-center"
            >
              ✕
            </button>

            {/* รูป carousel */}
            {selectedImgs.length > 0 && (
              <div className="relative">
                <div
                  className="flex overflow-x-auto snap-x snap-mandatory"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {selectedImgs.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`${selected.name} ${i + 1}`}
                      className="w-full h-64 object-cover shrink-0 snap-start"
                    />
                  ))}
                </div>
                {selectedImgs.length > 1 && (
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {selectedImgs.length} รูป
                  </div>
                )}
              </div>
            )}

            <div className="p-4 space-y-3">
              {/* ชื่อ + badge */}
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-[#1E3A5F] leading-tight">{selected.name}</h2>
                <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${isUrgentDate(selected.close_date) ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-amber-50 text-amber-700'}`}>
                  {daysLeft(selected.close_date)}
                </span>
              </div>

              {/* ราคา + วันปิดรับ + วันวางจำหน่าย */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#F5F6F8] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">ราคา</p>
                  <p className="text-xl font-bold text-[#1E3A5F]">฿{formatPrice(selected.price)}</p>
                </div>
                <div className="bg-[#F5F6F8] rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">ปิดรับออเดอร์</p>
                  <p className="text-sm font-semibold text-[#374151]">{formatDate(selected.close_date)}</p>
                </div>
              </div>
              {selected.release_date && (
                <div className="bg-[#1E3A5F]/5 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-0.5">วันวางจำหน่าย</p>
                  <p className="text-sm font-semibold text-[#1E3A5F]">{formatDate(selected.release_date)}</p>
                </div>
              )}
              {selected.sku && (
                <div className="bg-[#F5F6F8] rounded-xl px-3 py-2">
                  <p className="text-xs text-gray-500 mb-0.5">รหัส SKU (ตัด stock)</p>
                  <p className="text-sm font-mono font-semibold text-[#374151]">{selected.sku}</p>
                </div>
              )}

              {/* รายละเอียด */}
              {selected.description && (
                <div className="bg-[#F5F6F8] rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">รายละเอียด</p>
                  <p className="text-sm text-[#374151] whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}

              {/* จำนวนจำกัด */}
              {selected.max_qty > 0 && (
                <div className="bg-amber-50 rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-amber-700">จำกัด {selected.max_qty} ชิ้น</p>
                </div>
              )}

              <div className="pb-2" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
