'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type PromoItem = {
  id: string
  product_name: string
  threshold_amount: string
  start_month: string
  end_month: string
  note: string | null
  image_data: string
  acknowledged_at: string
}

function formatMonthThai(m: string) {
  if (!m) return ''
  const names = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const [y, mo] = m.split('-')
  return `${names[parseInt(mo) - 1]} ${parseInt(y) + 543}`
}

function promoState(startMonth: string, endMonth: string) {
  const current = new Date().toISOString().slice(0, 7)
  if (current < startMonth) return { label: 'ยังไม่เริ่ม', className: 'bg-gray-100 text-gray-500' }
  if (current > endMonth) return { label: 'หมดโปรแล้ว', className: 'bg-gray-100 text-gray-400' }
  return { label: 'กำลังจัดโปร', className: 'bg-[#0369A1]/10 text-[#0369A1]' }
}

export default function PromoListPage() {
  const router = useRouter()
  const [items, setItems] = useState<PromoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [imageModal, setImageModal] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    fetch('/api/promo-list')
      .then((r) => r.json())
      .then((data) => { setItems(data); setLastUpdated(new Date()) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <div className="min-h-screen bg-[#F0F9FF]">
      <div className="bg-[#0369A1] text-white px-4 py-5 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/70 hover:text-white text-lg w-8">←</button>
          <div>
            <h1 className="text-base font-bold">รายการโปรซื้อครบ</h1>
            <p className="text-xs opacity-70 mt-0.5">โปรโมชั่นที่ Admin อนุมัติแล้ว</p>
            <p className="text-xs opacity-60 mt-0.5">🗓 อัพเดทราวๆ ทุก 1 เดือน</p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1">
            <button
              onClick={() => { setLoading(true); fetchData() }}
              className="text-white/70 hover:text-white text-sm px-3 py-1.5 border border-white/30 rounded-lg"
            >
              รีเฟรช
            </button>
            <span className="text-[10px] text-white/50">
              {lastUpdated ? `ล่าสุด ${lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'อัพเดททุก 30 วิ'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีโปรซื้อครบที่อนุมัติแล้ว</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const state = promoState(item.start_month, item.end_month)
              return (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {item.image_data && (
                    <img
                      src={item.image_data}
                      alt="สินค้า"
                      onClick={() => setImageModal(item.image_data)}
                      className="w-full h-48 object-cover cursor-pointer hover:opacity-90"
                    />
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-[#1E3A5F] text-sm">{item.product_name}</p>
                      <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${state.className}`}>
                        {state.label}
                      </span>
                    </div>
                    <p className="text-sm text-[#374151]">ซื้อครบ <span className="font-bold text-[#0369A1]">{item.threshold_amount}</span> บาท</p>
                    <p className="text-xs text-gray-400">{formatMonthThai(item.start_month)} – {formatMonthThai(item.end_month)}</p>
                    {item.note && <p className="text-xs text-gray-400 pt-1 border-t border-[#E2E8F0]">{item.note}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {imageModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
          <img src={imageModal} alt="สินค้า" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  )
}
