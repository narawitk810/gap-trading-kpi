'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DEPARTMENTS } from '@/types/kpi'

const STORAGE_KEY = 'announcements_verified_at'
const DEPT_STORAGE_KEY = 'announcements_dept'
const DATA_CACHE_KEY = 'announcements_data_v2'
const VALID_DAYS = 10

type Announcement = {
  id: string
  title: string
  content: string
  has_image: number
  is_pinned: number
  is_active: number
  created_by: string
  created_at: string
}

type DeptAnn = {
  id: string
  department: string
  title: string
  content: string
  created_by: string
  created_at: string
}

type DeptRule = {
  id: string
  department: string
  title: string
  content: string
  sort_order: number
}

type StockItem = {
  id: string
  product_name: string
  quantity: string
  packs_per_box: string
  acknowledged_at: string | null
  pricing_data: string | null
  tiktok_listed_at: string | null
  sku_code_box?: string
  sku_code_pack?: string
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

  const [annTab, setAnnTab] = useState<'important' | 'dept' | 'rules'>('important')
  const [deptAnnouncements, setDeptAnnouncements] = useState<DeptAnn[]>([])
  const [deptRules, setDeptRules] = useState<DeptRule[]>([])
  const [loadingDeptAnn, setLoadingDeptAnn] = useState(false)
  const [loadingDeptRules, setLoadingDeptRules] = useState(false)
  const [deptAnnLoaded, setDeptAnnLoaded] = useState(false)
  const [deptRulesLoaded, setDeptRulesLoaded] = useState(false)

  useEffect(() => {
    const ts = localStorage.getItem(STORAGE_KEY)
    if (ts && Date.now() - Number(ts) < VALID_DAYS * 24 * 60 * 60 * 1000) {
      const savedDept = localStorage.getItem(DEPT_STORAGE_KEY)
      if (savedDept) setDepartment(savedDept)
      setVerified(true)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoadingData(true)
    Promise.all([
      fetch('/api/announcements').then((r) => r.json()).catch(() => []),
      fetch('/api/stock-prices?acknowledged_only=true').then((r) => r.json()).catch(() => []),
    ]).then(([ann, stock]) => {
      if (Array.isArray(ann)) setAnnouncements(ann)
      if (Array.isArray(stock)) setStockItems(stock)
      try {
        localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ ann, stock, ts: Date.now() }))
      } catch { /* ignore */ }
    }).finally(() => setLoadingData(false))
  }, [])

  useEffect(() => {
    if (!verified) return
    try {
      const raw = localStorage.getItem(DATA_CACHE_KEY)
      if (raw) {
        const { ann, stock } = JSON.parse(raw)
        if (Array.isArray(ann)) setAnnouncements(ann)
        if (Array.isArray(stock)) setStockItems(stock)
        setLoadingData(false)
        fetchData(true)
        return
      }
    } catch { /* ignore */ }
    fetchData()
  }, [verified, fetchData])

  const fetchDeptAnn = useCallback((dept: string) => {
    setLoadingDeptAnn(true)
    fetch(`/api/dept-announcements?dept=${encodeURIComponent(dept)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.announcements)) setDeptAnnouncements(data.announcements) })
      .catch(() => {})
      .finally(() => { setLoadingDeptAnn(false); setDeptAnnLoaded(true) })
  }, [])

  const fetchDeptRules = useCallback((dept: string) => {
    setLoadingDeptRules(true)
    fetch(`/api/dept-rules?dept=${encodeURIComponent(dept)}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.rules)) setDeptRules(data.rules) })
      .catch(() => {})
      .finally(() => { setLoadingDeptRules(false); setDeptRulesLoaded(true) })
  }, [])

  function handleTabChange(tab: 'important' | 'dept' | 'rules') {
    setAnnTab(tab)
    if (tab === 'dept' && !deptAnnLoaded) fetchDeptAnn(department)
    if (tab === 'rules' && !deptRulesLoaded) fetchDeptRules(department)
  }

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
        localStorage.setItem(DEPT_STORAGE_KEY, department)
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
            <p className="text-sm mt-0.5 opacity-75">📢 เว็บไซต์ประกาศ · {department}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                fetchData()
                if (annTab === 'dept') { setDeptAnnLoaded(false); fetchDeptAnn(department) }
                if (annTab === 'rules') { setDeptRulesLoaded(false); fetchDeptRules(department) }
              }}
              disabled={loadingData || loadingDeptAnn || loadingDeptRules}
              className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${(loadingData || loadingDeptAnn || loadingDeptRules) ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M4.582 9A8 8 0 0 1 19.419 9M19.419 15A8 8 0 0 1 4.581 15" />
              </svg>
              {(loadingData || loadingDeptAnn || loadingDeptRules) ? 'กำลังโหลด...' : 'รีเฟรช'}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY)
                localStorage.removeItem(DEPT_STORAGE_KEY)
                setVerified(false)
                setCode('')
              }}
              className="text-xs text-white/60 hover:text-white"
            >
              ออก
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-[#E2E8F0] sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex">
          {([
            { key: 'important', label: '📌 ประกาศสำคัญ' },
            { key: 'dept', label: '📣 ประกาศแผนก' },
            { key: 'rules', label: '📋 กฎแผนก' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors relative ${
                annTab === tab.key
                  ? 'text-[#1E3A5F]'
                  : 'text-gray-400 hover:text-[#374151]'
              }`}
            >
              {tab.label}
              {annTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A5F] rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Tab: ประกาศสำคัญ */}
        {annTab === 'important' && (
          <div>
            {loadingData ? (
              <div className="py-12 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : announcements.length === 0 ? (
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
                    {ann.has_image ? (
                      <img
                        src={`/api/announcements?image_id=${ann.id}`}
                        alt="ประกาศ"
                        loading="lazy"
                        onClick={() => setImageModal(`/api/announcements?image_id=${ann.id}`)}
                        className="w-full max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    ) : null}
                    <div className="p-4">
                      <div className="flex items-start gap-2 mb-1.5">
                        {ann.is_pinned ? <span className="text-xs font-bold text-[#1E3A5F] bg-[#1E3A5F]/10 px-2 py-0.5 rounded-full shrink-0">📌 ปักหมุด</span> : null}
                        <p className="text-sm font-bold text-[#1E3A5F] leading-snug">{ann.title}</p>
                      </div>
                      <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                      <p className="text-[11px] text-gray-400 mt-2.5 flex items-center gap-1">
                        <span>📅 {formatDate(ann.created_at)}</span>
                        <span className="text-gray-300">·</span>
                        <span>โดย {ann.created_by}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: ประกาศแผนก */}
        {annTab === 'dept' && (
          <div>
            {loadingDeptAnn ? (
              <div className="py-12 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : deptAnnouncements.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-1">
                <p className="text-2xl">📭</p>
                <p className="text-sm text-gray-400">ยังไม่มีประกาศสำหรับแผนก{department}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deptAnnouncements.map((ann) => (
                  <div key={ann.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4">
                      <p className="text-sm font-bold text-[#1E3A5F] leading-snug mb-1.5">{ann.title}</p>
                      <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                      <p className="text-[11px] text-gray-400 mt-2.5 flex items-center gap-1">
                        <span>📅 {formatDate(ann.created_at)}</span>
                        <span className="text-gray-300">·</span>
                        <span>โดย {ann.created_by}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: กฎแผนก */}
        {annTab === 'rules' && (
          <div>
            {loadingDeptRules ? (
              <div className="py-12 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : deptRules.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm text-center space-y-1">
                <p className="text-2xl">📋</p>
                <p className="text-sm text-gray-400">ยังไม่มีกฎสำหรับแผนก{department}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[#E2E8F0] bg-[#F5F6F8]">
                  <p className="text-xs font-bold text-[#1E3A5F]">กฎระเบียบแผนก{department}</p>
                </div>
                <div className="divide-y divide-[#E2E8F0]">
                  {deptRules.map((rule, idx) => (
                    <div key={rule.id} className="p-4 flex gap-3">
                      <div className="shrink-0 w-6 h-6 rounded-full bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1E3A5F] leading-snug mb-1">{rule.title}</p>
                        <p className="text-sm text-[#374151] leading-relaxed whitespace-pre-wrap">{rule.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* สินค้าเข้า — แสดงอยู่เสมอใต้ tabs */}
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
                      <th className="text-center px-2 py-3">SKU</th>
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
                          <td className="px-2 py-3 text-right text-xs text-[#374151]">
                            {!pricing || pricing.no_pack_sale ? <span className="text-gray-300">-</span> : (
                              <>
                                <span className="whitespace-nowrap">{fmt(pricing.pack_price_external)}</span>
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
                            <img
                              src={`/api/stock-prices?image_id=${item.id}`}
                              alt="สินค้า"
                              loading="lazy"
                              onClick={() => setImageModal(`/api/stock-prices?image_id=${item.id}`)}
                              className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 mx-auto"
                            />
                          </td>
                          <td className="px-2 py-3 text-center text-xs">
                            <div className="space-y-0.5">
                              <div className="text-gray-500"><span className="text-gray-400">กล่อง </span>{item.sku_code_box || '—'}</div>
                              <div className="text-gray-500"><span className="text-gray-400">ซอง </span>{item.sku_code_pack || '—'}</div>
                            </div>
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
                        <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-400">
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
      </div>

      {imageModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
          <img src={imageModal} alt="สินค้า" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  )
}
