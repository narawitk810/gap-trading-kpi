'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DEPARTMENTS } from '@/types/kpi'

const STORAGE_KEY = 'announcements_verified_at'
const VALID_DAYS = 10

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
  no_pack_sale?: boolean
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
  const [imageModal, setImageModal] = useState<string | null>(null)
  const [stockSearch, setStockSearch] = useState('')

  useEffect(() => {
    const ts = localStorage.getItem(STORAGE_KEY)
    if (ts && Date.now() - Number(ts) < VALID_DAYS * 24 * 60 * 60 * 1000) {
      setVerified(true)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
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
        localStorage.setItem(STORAGE_KEY, String(Date.now()))
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
            onClick={() => { localStorage.removeItem(STORAGE_KEY); setVerified(false); setCode('') }}
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
              {stockItems.length > 0 && (
                <div className="relative mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="ค้นหาสินค้า..."
                    className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                  />
                  {stockSearch && (
                    <button onClick={() => setStockSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              {stockItems.length === 0 ? (
                <div className="bg-white rounded-2xl p-6 shadow-sm text-center text-gray-400 text-sm">
                  ยังไม่มีสินค้าเข้า
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold">
                          <th className="text-left px-3 py-3">ชื่อสินค้า</th>
                          <th className="text-center px-2 py-3">จำนวน</th>
                          <th className="text-center px-2 py-3">ซอง/<br/>กล่อง</th>
                          <th className="text-right px-2 py-3 text-[#1E3A5F]">ยกกล่อง<br/>(ในระบบ)</th>
                          <th className="text-right px-2 py-3">ยกกล่อง<br/>(โยนนอก)</th>
                          <th className="text-right px-2 py-3 text-[#16A34A]">แยกซอง<br/>(ในระบบ)</th>
                          <th className="text-right px-2 py-3">แยกซอง<br/>(โยนนอก)</th>
                          <th className="text-center px-2 py-3">Comm.</th>
                          <th className="text-center px-2 py-3">รูป</th>
                          <th className="text-center px-2 py-3">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockItems.filter((item) =>
                          item.product_name.toLowerCase().includes(stockSearch.toLowerCase())
                        ).map((item, idx) => {
                          let pricing: PricingData | null = null
                          try { pricing = item.pricing_data ? JSON.parse(item.pricing_data) : null } catch { pricing = null }
                          const commTier = pricing?.commission_tier ?? ''
                          return (
                            <tr key={item.id} className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                              <td className="px-3 py-3 text-xs max-w-[140px]">
                                <p className="font-semibold text-[#1E3A5F] leading-snug">{item.product_name}</p>
                                {item.acknowledged_at && (
                                  <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(item.acknowledged_at)}</p>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center text-xs text-[#374151]">{item.quantity}</td>
                              <td className="px-2 py-3 text-center text-xs text-[#374151]">{item.packs_per_box}</td>
                              <td className="px-2 py-3 text-right text-xs font-bold text-[#1E3A5F] whitespace-nowrap">
                                {!pricing ? <span className="text-gray-300 font-normal">-</span>
                                  : pricing.box_system_enabled === false ? <span className="text-gray-300 font-normal">-</span>
                                  : fmt(pricing.box_price_system)}
                              </td>
                              <td className="px-2 py-3 text-right text-xs text-[#374151] whitespace-nowrap">
                                {pricing ? fmt(pricing.box_price_external) : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="px-2 py-3 text-right text-xs font-bold text-[#16A34A] whitespace-nowrap">
                                {!pricing || pricing.no_pack_sale || pricing.break_enabled
                                  ? <span className="text-gray-300 font-normal">-</span>
                                  : fmt(pricing.pack_price_system)}
                              </td>
                              <td className="px-2 py-3 text-right text-xs text-[#374151] whitespace-nowrap">
                                {!pricing || pricing.no_pack_sale ? <span className="text-gray-300">-</span> : (
                                  <>
                                    {fmt(pricing.pack_price_external)}
                                    {pricing.break_enabled && (
                                      <span className="block text-[9px] text-[#D97706] bg-orange-50 rounded px-1 mt-0.5 leading-tight text-center">เปิด break<br/>เท่านั้น</span>
                                    )}
                                  </>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {commTier && (
                                  <span className="text-xs font-bold bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {commTier}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {item.image_data ? (
                                  <img
                                    src={item.image_data}
                                    alt="สินค้า"
                                    onClick={() => setImageModal(item.image_data)}
                                    className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 mx-auto"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="text-gray-300 text-xs">-</span>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center">
                                {item.tiktok_listed_at ? (
                                  <span className="text-xs font-bold bg-[#16A34A]/10 text-[#16A34A] px-2 py-0.5 rounded-full whitespace-nowrap">✅ TikTok</span>
                                ) : (
                                  <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full whitespace-nowrap">ตั้งราคาแล้ว</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {stockItems.filter((item) =>
                          item.product_name.toLowerCase().includes(stockSearch.toLowerCase())
                        ).length === 0 && stockSearch && (
                          <tr>
                            <td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">
                              ไม่พบสินค้า &quot;{stockSearch}&quot;
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
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
