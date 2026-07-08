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
  max_qty: number
  image_data: string
  is_active: number
}

export default function PreorderPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

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
            const imgs = parseImages(product.image_data)
            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {imgs.length > 0 && (
                  <div className="relative">
                    <div className="flex overflow-x-auto snap-x snap-mandatory" style={{ scrollbarWidth: 'none' }}>
                      {imgs.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt={`${product.name} ${i + 1}`}
                          className="w-full h-56 object-cover shrink-0 snap-start"
                        />
                      ))}
                    </div>
                    {imgs.length > 1 && (
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        {imgs.length} รูป
                      </div>
                    )}
                  </div>
                )}
                <div className="p-4 space-y-3">
                  {/* ชื่อสินค้า + badge */}
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-[#1E3A5F] leading-tight">{product.name}</h2>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${isUrgent ? 'bg-[#DC2626]/10 text-[#DC2626]' : 'bg-amber-50 text-amber-700'}`}>
                      {days}
                    </span>
                  </div>

                  {/* รายละเอียด */}
                  {product.description && (
                    <div className="bg-[#F5F6F8] rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-500 mb-1">รายละเอียด</p>
                      <p className="text-sm text-[#374151] whitespace-pre-wrap">{product.description}</p>
                    </div>
                  )}

                  {/* ราคา + วันปิดรับ */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#F5F6F8] rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">ราคา</p>
                      <p className="text-xl font-bold text-[#1E3A5F]">฿{formatPrice(product.price)}</p>
                    </div>
                    <div className="bg-[#F5F6F8] rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">ปิดรับออเดอร์</p>
                      <p className="text-sm font-semibold text-[#374151]">{formatDate(product.close_date)}</p>
                    </div>
                  </div>
                  {product.release_date && (
                    <div className="bg-[#1E3A5F]/5 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-0.5">วันวางจำหน่าย</p>
                      <p className="text-sm font-semibold text-[#1E3A5F]">{formatDate(product.release_date)}</p>
                    </div>
                  )}

                  {/* จำกัดจำนวน */}
                  {product.max_qty > 0 && (
                    <div className="bg-amber-50 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-amber-700">จำกัด {product.max_qty} ชิ้น</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
