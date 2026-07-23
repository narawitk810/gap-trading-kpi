'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DEPARTMENTS } from '@/types/kpi'

const SESSION_KEY = 'announcements_verified'

type Announcement = {
  id: string
  title: string
  content: string
  image_data: string
  is_pinned: number
  is_active: number
  created_by: string
  created_at: string
}

type StockItem = {
  id: string
  product_name: string
  quantity: string
  packs_per_box: string
  image_data: string | null
  acknowledged_at: string | null
  pricing_data: string | null
  tiktok_listed_at: string | null
}

type PricingData = {
  pack_price_system: number
  pack_price_external: number
  box_price_system: number
  box_price_external: number
  box_system_enabled?: boolean
  break_enabled?: boolean
  commission_tier?: string
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
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) setVerified(true)
  }, [])

  useEffect(() => {
    if (!verified) return
    setLoadingData(true)
    Promise.all([
      fetch('/api/announcements').then((r) => r.json()).catch(() => []),
      fetch('/api/stock-prices?acknowledged_only=true').then((r) => r.json()).catch(() => []),
    ]).then(([ann, stock]) => {
      if (Array.isArray(ann)) setAnnouncements(ann)
      if (Array.isArray(stock)) setStockItems(stock)
    }).finally(() => setLoadingData(false))
  }, [verified])

  async function handleVerify() {
    if (!code.trim()) return
    setVerifying(true)
    setVerifyError('')
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department, code: code.trim() }),
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
          <div className="bg-[#1E3A5F] text-white px-5 py-5 text-center">
            <p className="text-3xl mb-1">📢</p>
            <h1 className="text-lg font-bold">เว็บไซต์ประกาศ</h1>
            <p className="text-sm opacity-75 mt-0.5">GAP TRADING</p>
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
            <Link href="/" className="block text-center text-xs text-gray-400 hover:text-[#1E3A5F]">
              ← กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link href="/" className="text-white/70 hover:text-white p-1 -ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
            <p className="text-sm mt-0.5 opacity-75">📢 เว็บไซต์ประกาศ</p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem(SESSION_KEY); setVerified(false); setCode('') }}
            className="ml-auto text-xs text-white/60 hover:text-white"
          >
            ออก
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {loadingData ? (
          <div className="py-12 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : (
          <>
            {/* ส่วนที่ 1: ประกาศสำคัญ */}
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
                        <img src={ann.image_data} alt="ประกาศ" className="w-full max-h-48 object-cover" />
                      )}
                      <div className="p-4">
                        <div className="flex items-start gap-2 mb-1.5">
                          {ann.is_pinned ? <span className="text-xs font-bold text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded-full shrink-0">📌 ปักหมุด</span> : null}
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

            {/* ส่วนที่ 2: สินค้าเข้า */}
            <div>
              <h2 className="text-sm font-bold text-[#1E3A5F] mb-3 px-1">📦 สินค้าเข้า</h2>
              {stockItems.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-400 text-sm">
                  ยังไม่มีสินค้าเข้า
                </div>
              ) : (
                <div className="space-y-3">
                  {stockItems.map((item) => {
                    let pricing: PricingData | null = null
                    try { pricing = item.pricing_data ? JSON.parse(item.pricing_data) : null } catch { pricing = null }
                    const packPrice = pricing?.pack_price_system ?? 0
                    const commTier = pricing?.commission_tier ?? ''
                    const commPct = commTier === 'P1' ? 0.01 : commTier === 'P2' ? 0.02 : commTier === 'P3' ? 0.03 : null
                    return (
                      <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                        {item.image_data ? (
                          <img
                            src={item.image_data}
                            alt={item.product_name}
                            className="w-full max-h-56 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-28 bg-[#F5F6F8] flex items-center justify-center text-3xl">📦</div>
                        )}
                        <div className="p-4">
                          {/* ชื่อสินค้า + สถานะ */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-base font-bold text-[#1E3A5F] leading-snug flex-1">{item.product_name}</p>
                            {item.tiktok_listed_at ? (
                              <span className="shrink-0 bg-[#16A34A]/10 text-[#16A34A] text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">✅ TikTok</span>
                            ) : (
                              <span className="shrink-0 bg-blue-50 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">🔵 ตั้งราคาแล้ว</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mb-3">{item.quantity} กล่อง · {item.packs_per_box} แพ็ค/กล่อง</p>

                          {pricing && (
                            <>
                              {/* ตารางราคา 4 ช่อง */}
                              <div className="grid grid-cols-2 gap-2 mb-3">
                                {pricing.box_system_enabled !== false && (
                                  <div className="bg-[#F5F6F8] rounded-xl p-2.5">
                                    <p className="text-[10px] text-gray-400 font-medium">ยกกล่อง (ในระบบ)</p>
                                    <p className="text-sm font-bold text-[#1E3A5F] mt-0.5">{fmt(pricing.box_price_system)} <span className="text-[10px] font-normal text-gray-400">บ.</span></p>
                                  </div>
                                )}
                                <div className="bg-[#F5F6F8] rounded-xl p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium">ยกกล่อง (โยนนอก)</p>
                                  <p className="text-sm font-bold text-[#374151] mt-0.5">{fmt(pricing.box_price_external)} <span className="text-[10px] font-normal text-gray-400">บ.</span></p>
                                </div>
                                {!pricing.break_enabled && (
                                  <div className="bg-[#F5F6F8] rounded-xl p-2.5">
                                    <p className="text-[10px] text-gray-400 font-medium">แยกซอง (ในระบบ)</p>
                                    <p className="text-sm font-bold text-[#16A34A] mt-0.5">{fmt(pricing.pack_price_system)} <span className="text-[10px] font-normal text-gray-400">บ.</span></p>
                                  </div>
                                )}
                                <div className="bg-[#F5F6F8] rounded-xl p-2.5">
                                  <p className="text-[10px] text-gray-400 font-medium">แยกซอง (โยนนอก)</p>
                                  <p className="text-sm font-bold text-[#374151] mt-0.5">{fmt(pricing.pack_price_external)} <span className="text-[10px] font-normal text-gray-400">บ.</span></p>
                                </div>
                              </div>

                              {/* COMM. */}
                              {commTier && commPct !== null && packPrice > 0 && (
                                <div className="border border-[#E2E8F0] rounded-xl p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-white bg-[#1E3A5F] px-2 py-0.5 rounded-full">COMM. {commTier}</span>
                                    <span className="text-[10px] text-gray-400">{commTier === 'P1' ? '1%' : commTier === 'P2' ? '2%' : '3%'} ต่อซอง</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {[{ label: 'P(1)', pct: 0.01 }, { label: 'P(2)', pct: 0.02 }, { label: 'P(3)', pct: 0.03 }].map(({ label, pct }) => (
                                      <div key={label} className={`rounded-lg p-2 text-center ${commTier === label.replace('(', '').replace(')', '') ? 'bg-[#1E3A5F] text-white' : 'bg-[#F5F6F8]'}`}>
                                        <p className={`text-[10px] font-semibold ${commTier === label.replace('(', '').replace(')', '') ? 'text-white/70' : 'text-gray-400'}`}>{label}</p>
                                        <p className={`text-sm font-bold mt-0.5 ${commTier === label.replace('(', '').replace(')', '') ? 'text-white' : 'text-[#374151]'}`}>{fmt(Math.round(packPrice * pct))}</p>
                                        <p className={`text-[10px] ${commTier === label.replace('(', '').replace(')', '') ? 'text-white/60' : 'text-gray-400'}`}>บาท</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {item.acknowledged_at && (
                            <p className="text-[10px] text-gray-300 mt-2">ตั้งราคา {formatDate(item.acknowledged_at)}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
