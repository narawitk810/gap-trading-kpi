'use client'

import { useState, useEffect } from 'react'

const DEPARTMENTS = [
  'ไลฟ์สด', 'Sales Admin', 'Store Retail', 'การตลาด', 'Creative',
  'สต๊อค&จัดซื้อ', 'ธุรการ', 'บัญชี&การเงิน', 'แพค', 'บุคคล',
  'ผู้จัดการไลฟ์สด', 'ผู้จัดการหน้าร้าน',
]

const SESSION_KEY = 'gap_ann_verified'

type Announcement = {
  id: string
  title: string
  content: string
  image_data: string
  is_pinned: number
  created_by: string
  created_at: string
}

type StockItem = {
  id: string
  product_name: string
  quantity: string
  packs_per_box: string
  acknowledged_at: string | null
  pricing_data: string | null
  tiktok_listed_at: string | null
  urgent_promo?: string
}

type PricingData = {
  pack_price_system: number
  box_price_system: number
  box_system_enabled?: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export default function AnnouncementsPage() {
  const [verified, setVerified] = useState(false)
  const [department, setDepartment] = useState('ไลฟ์สด')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) setVerified(true)
  }, [])

  useEffect(() => {
    if (!verified) return
    setLoadingData(true)
    Promise.all([
      fetch('/api/announcements').then((r) => r.json()).catch(() => []),
      fetch('/api/stock-prices').then((r) => r.json()).catch(() => []),
    ]).then(([ann, stock]) => {
      if (Array.isArray(ann)) setAnnouncements(ann)
      if (Array.isArray(stock)) setStockItems(stock)
    }).finally(() => setLoadingData(false))
  }, [verified])

  async function handleVerify() {
    if (code.length < 4) return
    setVerifying(true)
    setVerifyError('')
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department, code }),
      })
      const data = await res.json()
      if (data.valid) {
        sessionStorage.setItem(SESSION_KEY, '1')
        setVerified(true)
      } else {
        setVerifyError('รหัสไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
        setCode('')
      }
    } catch {
      setVerifyError('เกิดข้อผิดพลาด กรุณาลองอีกครั้ง')
    } finally {
      setVerifying(false)
    }
  }

  if (!verified) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
          <div className="bg-[#1E3A5F] text-white px-5 py-6 text-center">
            <p className="text-4xl mb-2">📢</p>
            <h1 className="text-xl font-bold">เว็บไซต์ประกาศ</h1>
            <p className="text-sm opacity-75 mt-1">GAP TRADING</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">เลือกแผนกของคุณ</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                รหัสแผนก <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="● ● ● ●"
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-center tracking-[0.4em] font-bold focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            {verifyError && (
              <p className="text-[#DC2626] text-xs text-center">{verifyError}</p>
            )}
            <button
              onClick={handleVerify}
              disabled={code.length < 4 || verifying}
              className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {verifying ? 'กำลังตรวจสอบ...' : 'เข้าสู่เว็บไซต์ประกาศ'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
            <p className="text-sm mt-0.5 opacity-75">📢 เว็บไซต์ประกาศ</p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem(SESSION_KEY); setVerified(false); setCode('') }}
            className="text-xs text-white/60 hover:text-white border border-white/30 px-3 py-1.5 rounded-lg"
          >
            ออก
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {loadingData ? (
          <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : (
          <>
            {/* Section 1: ประกาศสำคัญ */}
            <div>
              <h2 className="text-sm font-bold text-[#1E3A5F] mb-3 px-1">📌 ประกาศสำคัญ</h2>
              {announcements.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-400 text-sm">
                  ยังไม่มีประกาศ
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className={`bg-white rounded-2xl shadow-sm overflow-hidden ${ann.is_pinned ? 'border-l-4 border-[#1E3A5F]' : ''}`}
                    >
                      {ann.image_data && (
                        <img src={ann.image_data} alt="ประกาศ" className="w-full max-h-52 object-cover" />
                      )}
                      <div className="p-4">
                        <div className="flex items-start gap-2 mb-2">
                          {ann.is_pinned ? (
                            <span className="text-xs font-bold text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                              📌 ปักหมุด
                            </span>
                          ) : null}
                          <p className="text-sm font-bold text-[#1E3A5F] leading-snug">{ann.title}</p>
                        </div>
                        <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                        <p className="text-[10px] text-gray-400 mt-2">โดย {ann.created_by} · {formatDate(ann.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: สินค้าเข้า */}
            <div>
              <h2 className="text-sm font-bold text-[#1E3A5F] mb-3 px-1">📦 สินค้าเข้า</h2>
              {stockItems.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-400 text-sm">
                  ยังไม่มีสินค้าเข้า
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-[#F5F6F8] border-b border-[#E2E8F0]">
                          <th className="px-4 py-2 text-xs font-semibold text-[#374151]">ชื่อสินค้า</th>
                          <th className="px-3 py-2 text-xs font-semibold text-[#DC2626] whitespace-nowrap">🔥 โปรเร่งด่วน</th>
                          <th className="px-3 py-2 text-xs font-semibold text-[#1E3A5F] text-right whitespace-nowrap">ราคา</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockItems.map((item, idx) => {
                          let pricing: PricingData | null = null
                          try { pricing = item.pricing_data ? JSON.parse(item.pricing_data) : null } catch { pricing = null }
                          return (
                            <tr key={item.id} className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                              <td className="px-4 py-3">
                                <p className="text-sm font-semibold text-[#374151]">{item.product_name}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{item.quantity} กล่อง · {item.packs_per_box} แพ็ค/กล่อง</p>
                              </td>
                              <td className="px-3 py-3">
                                {item.urgent_promo ? (
                                  <span className="text-xs font-bold text-[#DC2626]">{item.urgent_promo}</span>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-right">
                                {pricing ? (
                                  <>
                                    <p className="text-xs font-bold text-[#16A34A] whitespace-nowrap">แพ็ค {fmt(pricing.pack_price_system)} บ.</p>
                                    {pricing.box_system_enabled !== false && (
                                      <p className="text-xs text-[#1E3A5F] whitespace-nowrap">กล่อง {fmt(pricing.box_price_system)} บ.</p>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-300">รอตั้งราคา</span>
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
          </>
        )}
      </div>
    </div>
  )
}
