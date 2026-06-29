'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type PricingData = {
  multiplier: string
  msrp_price: string | null
  risk_amount: number
  commission_tier: string
  box_price_system: number
  box_price_external: number
  pack_price_system: number
  pack_price_external: number
}

type StockPrice = {
  id: string
  product_name: string
  quantity: string
  packs_per_box: string
  note: string | null
  image_data: string
  created_at: string
  acknowledged_at: string
  pricing_data: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function StockPricesPage() {
  const router = useRouter()
  const [items, setItems] = useState<StockPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [imageModal, setImageModal] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/stock-prices')
      .then((r) => r.json())
      .then((data) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = items.filter((r) => {
    const d = (r.acknowledged_at || r.created_at).slice(0, 10)
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  })

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#16A34A] text-white px-4 py-5 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/70 hover:text-white text-lg w-8">←</button>
          <div>
            <h1 className="text-base font-bold">ราคาขายสินค้า</h1>
            <p className="text-xs opacity-70 mt-0.5">รายการสินค้าที่กำหนดราคาแล้ว</p>
          </div>
          <button
            onClick={() => { setLoading(true); fetch('/api/stock-prices').then((r) => r.json()).then(setItems).finally(() => setLoading(false)) }}
            className="ml-auto text-white/70 hover:text-white text-sm px-3 py-1.5 border border-white/30 rounded-lg"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* Filter */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-500">วันที่</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          />
          <span className="text-xs text-gray-400">ถึง</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-xs text-gray-400 hover:text-gray-600 underline">
              ล้าง
            </button>
          )}
          <span className="ml-auto text-sm text-gray-500 font-semibold">{filtered.length} รายการ</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีรายการที่กำหนดราคา</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                    <th className="text-left px-4 py-3">วันที่</th>
                    <th className="text-left px-4 py-3">ชื่อสินค้า / LOT</th>
                    <th className="text-center px-4 py-3">จำนวน</th>
                    <th className="text-center px-4 py-3">ซอง/กล่อง</th>
                    <th className="text-right px-3 py-3 text-[#1E3A5F]">ยกกล่อง<br/>(ในระบบ)</th>
                    <th className="text-right px-3 py-3">ยกกล่อง<br/>(โยนนอก)</th>
                    <th className="text-right px-3 py-3 text-[#16A34A]">แยกซอง<br/>(ในระบบ)</th>
                    <th className="text-right px-3 py-3">แยกซอง<br/>(โยนนอก)</th>
                    <th className="text-center px-3 py-3">Comm.</th>
                    <th className="text-center px-3 py-3">รูป</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => {
                    const p: PricingData = JSON.parse(r.pricing_data)
                    const multiplierLabel = p.multiplier === 'msrp' ? 'MSRP' : `×${p.multiplier}`
                    return (
                      <tr key={r.id} className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                          {formatDate(r.acknowledged_at || r.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[180px]">
                          <p className="font-semibold text-[#1E3A5F] truncate">{r.product_name}</p>
                          {r.note && <p className="text-gray-400 truncate">{r.note}</p>}
                          <p className="text-gray-400 mt-0.5">{multiplierLabel}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-[#374151]">{r.quantity}</td>
                        <td className="px-4 py-3 text-center text-xs text-[#374151]">{r.packs_per_box}</td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-[#1E3A5F] whitespace-nowrap">{fmt(p.box_price_system)}</td>
                        <td className="px-3 py-3 text-right text-xs text-[#374151] whitespace-nowrap">{fmt(p.box_price_external)}</td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-[#16A34A] whitespace-nowrap">{fmt(p.pack_price_system)}</td>
                        <td className="px-3 py-3 text-right text-xs text-[#374151] whitespace-nowrap">{fmt(p.pack_price_external)}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-bold bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded-full">
                            {p.commission_tier}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r.image_data && (
                            <img
                              src={r.image_data}
                              alt="สินค้า"
                              onClick={() => setImageModal(r.image_data)}
                              className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 mx-auto"
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {imageModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
          <img src={imageModal} alt="สินค้า" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  )
}
