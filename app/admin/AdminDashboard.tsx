'use client'

import { useSearchParams } from 'next/navigation'
import React, { useEffect, useState, useCallback } from 'react'
import { DEPARTMENTS } from '@/types/kpi'
import type { KPIEntry } from '@/types/kpi'
import * as XLSX from 'xlsx'

const ADMIN_KEY = 'GAPtrading2024admin'

const BASE_RATES: Record<string, number> = {
  'การตลาด': 500,
  'บัญชี': 600,
  'ธุรการ': 400,
  'บุคคล': 600,
  'สต๊อค&จัดซื้อ': 500,
  'แพค': 400,
  'ผู้จัดการ': 700,
  'Creative': 550,
}

function estimateWage(entry: KPIEntry): number {
  const base = BASE_RATES[entry.department]
  if (!base) return 0
  const tasks = entry.tasks.filter((t) => t.trim())
  const n = tasks.length
  const mult = n <= 3 ? 0.7 : n <= 5 ? 0.85 : n <= 7 ? 1.0 : n <= 9 ? 1.15 : 1.3
  let bonus = 0
  if (entry.obstacles?.trim()) bonus += base * 0.05
  const avgLen = tasks.reduce((s, t) => s + t.length, 0) / Math.max(n, 1)
  if (avgLen > 20) bonus += base * 0.05
  return Math.round(base * mult + bonus)
}

function wageColor(estimated: number, base: number): 'green' | 'yellow' | 'red' {
  if (estimated > base) return 'green'
  if (estimated >= base * 0.8) return 'yellow'
  return 'red'
}

type ProductRequest = {
  id: string
  nickname: string
  description: string
  image_data: string
  status: string
  created_at: string
  approved_at: string | null
}

type Complaint = {
  id: string
  nickname: string
  department: string
  description: string
  attachment_data: string
  attachment_type: string
  status: string
  created_at: string
  reviewed_at: string | null
}

type RestockRequest = {
  id: string
  nickname: string
  description: string
  image_data: string
  status: string
  created_at: string
  noted_at: string | null
}

type StockArrival = {
  id: string
  nickname: string
  product_name: string
  quantity: string
  packs_per_box: string
  cost: string
  note: string | null
  image_data: string
  status: string
  created_at: string
  acknowledged_at: string | null
}

type TaxInvoice = {
  id: string
  nickname: string
  department: string
  amount: number
  invoice_date: string
  description: string
  image_data: string
  created_at: string
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function parseExtraForExcel(entry: KPIEntry): Record<string, string | number> {
  if (!entry.extra_data) return {}
  let ex: Record<string, unknown> = {}
  try { ex = JSON.parse(entry.extra_data) } catch { return {} }
  const upOrders = (ex.upselling_orders as { initial: string; freebie: string; final: string }[] | undefined) || []
  const upTotalDiff = upOrders.reduce((s, o) => s + (Number(o.final || 0) - Number(o.initial || 0)), 0)
  const upSummary = upOrders.map((o, i) => `#${i+1} ${o.initial||'?'}→${o.final||'?'} บาท${o.freebie ? ` (แถม:${o.freebie})` : ''}`).join(', ')

  if (entry.department === 'ไลฟ์สด') {
    return {
      'ชั่วโมงไลฟ์': ex.live_hours ? String(ex.live_hours) : '',
      'ยอดขาย (บาท)': ex.sales_amount ? Number(ex.sales_amount) : '',
      'จำนวน Upsell Order': upOrders.length || '',
      'ยอดเพิ่มรวม Upsell (บาท)': upTotalDiff > 0 ? upTotalDiff : '',
      'รายละเอียด Upsell': upSummary,
    }
  }
  if (entry.department === 'sale admin') {
    return {
      'ยอดขาย (บาท)': ex.sales_amount ? Number(ex.sales_amount) : '',
      'จำนวน Upsell Order': upOrders.length || '',
      'ยอดเพิ่มรวม Upsell (บาท)': upTotalDiff > 0 ? upTotalDiff : '',
      'รายละเอียด Upsell': upSummary,
    }
  }
  if (entry.department === 'แพค') {
    return { 'จำนวนชิ้น': ex.pack_count ? Number(ex.pack_count) : '' }
  }
  if (entry.department === 'Creative') {
    const links = (ex.clip_links as string[] | undefined) || []
    return { 'ลิ้งคลิป': links.join('\n') }
  }
  if (entry.department === 'การตลาด') {
    return {
      'Ads Shopee (บาท)': ex.ads_shopee ? Number(ex.ads_shopee) : '',
      'Ads Lazada (บาท)': ex.ads_lazada ? Number(ex.ads_lazada) : '',
      'Ads TikTok (บาท)': ex.ads_tiktok ? Number(ex.ads_tiktok) : '',
      'Ads Facebook (บาท)': ex.ads_facebook ? Number(ex.ads_facebook) : '',
    }
  }
  return {}
}

function exportToExcel(entries: KPIEntry[], dateFrom: string, dateTo: string) {
  const rows = entries.map((e) => ({
    'รหัส': e.id,
    'วันที่': formatDate(e.date),
    'เวลา': e.time,
    'แผนก': e.department,
    'ชื่อเล่น': e.nickname,
    'ช่องที่ดูแล': e.channel_name,
    'งานที่ทำ': e.tasks.join('\n'),
    'อุปสรรค': e.obstacles || '',
    ...parseExtraForExcel(e),
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'KPI')
  const label = dateFrom || dateTo ? `${dateFrom || 'all'}_ถึง_${dateTo || 'all'}` : 'ทั้งหมด'
  XLSX.writeFile(wb, `KPI_${label}.xlsx`)
}

function getTodayDate() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#374151]">{value || '—'}</p>
    </div>
  )
}

function ExtraDataSection({ entry }: { entry: KPIEntry }) {
  if (!entry.extra_data) return null
  let ex: Record<string, unknown> = {}
  try {
    ex = JSON.parse(entry.extra_data)
  } catch {
    return null
  }
  const dept = entry.department

  const upOrders = (ex.upselling_orders as { initial: string; freebie: string; final: string }[] | undefined) || []
  if ((dept === 'ไลฟ์สด' || dept === 'sale admin') && (ex.live_hours || ex.sales_amount || upOrders.length > 0)) {
    const totalDiff = upOrders.reduce((s, o) => s + (Number(o.final || 0) - Number(o.initial || 0)), 0)
    return (
      <div className="bg-blue-50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-bold text-[#1E3A5F]">ข้อมูลการขาย</p>
        <div className="grid grid-cols-2 gap-3">
          {!!ex.live_hours && dept === 'ไลฟ์สด' && (
            <DetailRow label="ชั่วโมงไลฟ์" value={`${ex.live_hours} ชั่วโมง`} />
          )}
          {!!ex.sales_amount && (
            <DetailRow label="ยอดขาย" value={`${Number(ex.sales_amount).toLocaleString()} บาท`} />
          )}
        </div>
        {upOrders.length > 0 && (
          <div className="pt-1 space-y-1.5">
            <p className="text-xs font-semibold text-[#1E3A5F]">อัพเซลล์ ({upOrders.length} order{totalDiff > 0 ? ` · +${totalDiff.toLocaleString()} บาทรวม` : ''})</p>
            {upOrders.map((o, i) => {
              const diff = Number(o.final || 0) - Number(o.initial || 0)
              return (
                <div key={i} className="text-xs text-[#374151] bg-white rounded-lg px-2.5 py-1.5 flex gap-2 flex-wrap">
                  <span className="text-gray-400">#{i+1}</span>
                  {o.initial && <span>{Number(o.initial).toLocaleString()} → {o.final ? Number(o.final).toLocaleString() : '?'} บาท</span>}
                  {o.freebie && <span className="text-[#1E3A5F]">· แถม: {o.freebie}</span>}
                  {diff > 0 && <span className="text-[#16A34A] font-semibold">+{diff.toLocaleString()}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }


  if (dept === 'Creative') {
    const links = (ex.clip_links as string[] | undefined) || []
    if (links.length === 0) return null
    return (
      <div className="bg-blue-50 rounded-xl p-3">
        <p className="text-xs font-bold text-[#1E3A5F] mb-2">
          ลิ้งคลิปที่ทำเสร็จ ({links.length} คลิป)
        </p>
        <ul className="space-y-1">
          {links.map((link, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="text-gray-400 shrink-0">{i + 1}.</span>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A5F] underline truncate"
              >
                {link}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (dept === 'การตลาด') {
    const platforms = [
      { k: 'ads_shopee', l: 'Shopee' },
      { k: 'ads_lazada', l: 'Lazada' },
      { k: 'ads_tiktok', l: 'TikTok' },
      { k: 'ads_facebook', l: 'Facebook' },
    ].filter(({ k }) => ex[k])
    if (platforms.length === 0) return null
    const total = platforms.reduce((s, { k }) => s + Number(ex[k] || 0), 0)
    return (
      <div className="bg-blue-50 rounded-xl p-3">
        <p className="text-xs font-bold text-[#1E3A5F] mb-2">
          ค่า Ads วันนี้ (รวม {total.toLocaleString()} บาท)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {platforms.map(({ k, l }) => (
            <DetailRow key={k} label={l} value={`${Number(ex[k]).toLocaleString()} บาท`} />
          ))}
        </div>
      </div>
    )
  }

  if (dept === 'แพค' && ex.pack_count) {
    return (
      <div className="bg-blue-50 rounded-xl p-3">
        <p className="text-xs font-bold text-[#1E3A5F] mb-2">ยอดการแพควันนี้</p>
        <DetailRow label="จำนวนชิ้นที่แพคได้" value={`${Number(ex.pack_count).toLocaleString()} ชิ้น`} />
      </div>
    )
  }

  return null
}

export default function AdminDashboard() {
  const searchParams = useSearchParams()
  const key = searchParams.get('key')
  const isAuthorized = key === ADMIN_KEY

  const [activeTab, setActiveTab] = useState<'kpi' | 'requests' | 'complaints' | 'wage' | 'tax' | 'restock' | 'stock-arrival' | 'codes' | 'upsell'>('kpi')
  const [deptCodes, setDeptCodes] = useState<{ department: string; code: string; quarter: string; created_at: string }[]>([])
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([])
  const [loadingRestock, setLoadingRestock] = useState(false)
  const [notingId, setNotingId] = useState<string | null>(null)
  const [stockArrivals, setStockArrivals] = useState<StockArrival[]>([])
  const [loadingArrivals, setLoadingArrivals] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [arrivalFilters, setArrivalFilters] = useState({ dateFrom: '', dateTo: '' })
  const [arrivalImageModal, setArrivalImageModal] = useState<string | null>(null)
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([])
  const [loadingTax, setLoadingTax] = useState(false)
  const [taxMonth, setTaxMonth] = useState('')
  const [taxImageModal, setTaxImageModal] = useState<string | null>(null)
  const [wageFilters, setWageFilters] = useState({ department: '', dateFrom: '', dateTo: '', nickname: '' })
  const [wageAnalysis, setWageAnalysis] = useState<Record<string, { score: number; estimated_wage: number; verdict: string; reason: string }>>({})
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  async function handleAnalyze(entry: KPIEntry) {
    const base = BASE_RATES[entry.department]
    if (!base) return
    setAnalyzingId(entry.id)
    try {
      const res = await fetch('/api/analyze-wage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entry.id,
          department: entry.department,
          tasks: entry.tasks,
          obstacles: entry.obstacles,
          base_rate: base,
        }),
      })
      const data = await res.json()
      if (res.ok) setWageAnalysis((prev) => ({ ...prev, [entry.id]: data }))
      else alert(data.error || 'วิเคราะห์ไม่สำเร็จ')
    } catch { alert('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setAnalyzingId(null) }
  }
  const [entries, setEntries] = useState<KPIEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<KPIEntry | null>(null)
  const [filters, setFilters] = useState({
    department: '',
    dateFrom: '',
    dateTo: '',
    nickname: '',
  })
  const [productRequests, setProductRequests] = useState<ProductRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loadingComplaints, setLoadingComplaints] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kpi?key=${ADMIN_KEY}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchProductRequests = useCallback(async () => {
    setLoadingRequests(true)
    try {
      const res = await fetch(`/api/product-requests?key=${ADMIN_KEY}`)
      if (res.ok) {
        const data = await res.json()
        setProductRequests(data)
      }
    } catch {
      // silent
    } finally {
      setLoadingRequests(false)
    }
  }, [])

  async function handleApprove(id: string) {
    setApprovingId(id)
    try {
      const res = await fetch(`/api/product-requests?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setProductRequests((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, status: 'approved', approved_at: new Date().toISOString() } : r
          )
        )
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setApprovingId(null)
    }
  }

  const fetchComplaints = useCallback(async () => {
    setLoadingComplaints(true)
    try {
      const res = await fetch(`/api/complaints?key=${ADMIN_KEY}`)
      if (res.ok) setComplaints(await res.json())
    } catch { /* silent */ }
    finally { setLoadingComplaints(false) }
  }, [])

  const fetchCodes = useCallback(async () => {
    setLoadingCodes(true)
    try {
      const res = await fetch(`/api/dept-codes?key=${ADMIN_KEY}`)
      if (res.ok) setDeptCodes(await res.json())
    } catch { /* silent */ }
    finally { setLoadingCodes(false) }
  }, [])

  async function handleRegen() {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/dept-codes?key=${ADMIN_KEY}`, { method: 'POST' })
      if (res.ok) setDeptCodes(await res.json())
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setRegenerating(false) }
  }

  const fetchRestock = useCallback(async () => {
    setLoadingRestock(true)
    try {
      const res = await fetch(`/api/restock?key=${ADMIN_KEY}`)
      if (res.ok) setRestockRequests(await res.json())
    } catch { /* silent */ }
    finally { setLoadingRestock(false) }
  }, [])

  const fetchStockArrivals = useCallback(async () => {
    setLoadingArrivals(true)
    try {
      const res = await fetch(`/api/stock-arrival?key=${ADMIN_KEY}`)
      if (res.ok) setStockArrivals(await res.json())
    } catch { /* silent */ }
    finally { setLoadingArrivals(false) }
  }, [])

  async function handleAcknowledge(id: string) {
    setAcknowledgingId(id)
    try {
      const res = await fetch(`/api/stock-arrival?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setStockArrivals((prev) => prev.map((r) => r.id === id ? { ...r, status: 'acknowledged', acknowledged_at: new Date().toISOString() } : r))
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setAcknowledgingId(null) }
  }

  async function handleNoted(id: string) {
    setNotingId(id)
    try {
      const res = await fetch(`/api/restock?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setRestockRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'noted', noted_at: new Date().toISOString() } : r))
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setNotingId(null) }
  }

  const fetchTaxInvoices = useCallback(async (month?: string) => {
    setLoadingTax(true)
    try {
      const url = `/api/tax-invoices?key=${ADMIN_KEY}${month ? `&month=${month}` : ''}`
      const res = await fetch(url)
      if (res.ok) setTaxInvoices(await res.json())
    } catch { /* silent */ }
    finally { setLoadingTax(false) }
  }, [])

  async function handleReview(id: string) {
    setReviewingId(id)
    try {
      const res = await fetch(`/api/complaints?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setComplaints((prev) =>
          prev.map((c) => c.id === id ? { ...c, status: 'reviewed', reviewed_at: new Date().toISOString() } : c)
        )
      }
    } catch { alert('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setReviewingId(null) }
  }

  useEffect(() => {
    if (isAuthorized) {
      fetchEntries()
      fetchProductRequests()
      fetchComplaints()
      fetchTaxInvoices()
      fetchRestock()
      fetchStockArrivals()
      fetchCodes()
    }
  }, [isAuthorized, fetchEntries, fetchProductRequests, fetchComplaints, fetchTaxInvoices, fetchRestock, fetchStockArrivals, fetchCodes])

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-[#1E3A5F] mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-gray-500 text-sm">กรุณาตรวจสอบ URL ที่ได้รับจาก HR หรือผู้ดูแลระบบ</p>
        </div>
      </div>
    )
  }

  const today = getTodayDate()
  const todayEntries = entries.filter((e) => e.date === today)
  const todayByDept = DEPARTMENTS.reduce<Record<string, number>>((acc, dept) => {
    acc[dept] = todayEntries.filter((e) => e.department === dept).length
    return acc
  }, {})

  const filteredEntries = entries.filter((entry) => {
    if (filters.department && entry.department !== filters.department) return false
    if (filters.dateFrom && entry.date < filters.dateFrom) return false
    if (filters.dateTo && entry.date > filters.dateTo) return false
    if (filters.nickname && !entry.nickname.toLowerCase().includes(filters.nickname.toLowerCase()))
      return false
    return true
  })

  const hasFilters = filters.department || filters.dateFrom || filters.dateTo || filters.nickname

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
            <p className="text-sm mt-0.5" style={{ opacity: 0.75 }}>
              แดชบอร์ด KPI รายวัน
            </p>
          </div>
          <button
            onClick={() => { fetchEntries(); fetchProductRequests(); fetchComplaints(); fetchTaxInvoices(taxMonth || undefined); fetchRestock(); fetchStockArrivals(); fetchCodes() }}
            className="text-xs text-white/70 border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/10"
          >
            รีเฟรช
          </button>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto mt-4 flex flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('kpi')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'kpi'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            รายการ KPI
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            คำขอสินค้า
            {productRequests.filter((r) => r.status === 'pending').length > 0 && (
              <span className="bg-[#DC2626] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {productRequests.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('complaints')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'complaints'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            ร้องเรียน
            {complaints.filter((c) => c.status === 'new').length > 0 && (
              <span className="bg-[#DC2626] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {complaints.filter((c) => c.status === 'new').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('wage')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'wage'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            ค่าแรง
          </button>
          <button
            onClick={() => setActiveTab('tax')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'tax'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            ใบกำกับภาษี
          </button>
          <button
            onClick={() => setActiveTab('restock')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'restock'
                ? 'bg-white text-[#DC2626]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            Restock
            {restockRequests.filter((r) => r.status === 'pending').length > 0 && (
              <span className="bg-[#DC2626] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {restockRequests.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('stock-arrival')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'stock-arrival'
                ? 'bg-white text-[#16A34A]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            สินค้าเข้า
            {stockArrivals.filter((r) => r.status === 'pending').length > 0 && (
              <span className="bg-[#16A34A] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {stockArrivals.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('codes')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'codes'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            รหัสแผนก
          </button>
          <button
            onClick={() => setActiveTab('upsell')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'upsell'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            อัพเซลล์
          </button>
        </div>
      </div>

      {/* Complaints Tab */}
      {activeTab === 'complaints' && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          {loadingComplaints ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : complaints.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีเรื่องร้องเรียน</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {complaints.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {c.attachment_data && c.attachment_type === 'image' && (
                    <img src={c.attachment_data} alt="หลักฐาน" className="w-full h-48 object-cover" />
                  )}
                  {c.attachment_data && c.attachment_type === 'video' && (
                    <video src={c.attachment_data} controls className="w-full max-h-48" />
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#1E3A5F] text-sm">{c.nickname}</p>
                        <p className="text-xs text-gray-400">{c.department} · {formatDateTime(c.created_at)}</p>
                      </div>
                      {c.status === 'reviewed' ? (
                        <span className="shrink-0 text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full font-semibold">✅ รับเรื่องแล้ว</span>
                      ) : (
                        <span className="shrink-0 text-xs bg-red-50 text-[#DC2626] px-2 py-1 rounded-full font-semibold">🔴 ใหม่</span>
                      )}
                    </div>
                    <p className="text-sm text-[#374151]">{c.description}</p>
                    {c.status === 'new' && (
                      <button
                        onClick={() => handleReview(c.id)}
                        disabled={reviewingId === c.id}
                        className="w-full mt-1 bg-[#374151] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#1f2937] disabled:opacity-60 transition-colors"
                      >
                        {reviewingId === c.id ? 'กำลังบันทึก...' : 'รับเรื่องแล้ว'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Wage Analysis Tab */}
      {activeTab === 'wage' && (() => {
        const wageDepts = Object.keys(BASE_RATES)
        const wageEntries = entries.filter((e) => {
          if (!wageDepts.includes(e.department)) return false
          if (wageFilters.department && e.department !== wageFilters.department) return false
          if (wageFilters.dateFrom && e.date < wageFilters.dateFrom) return false
          if (wageFilters.dateTo && e.date > wageFilters.dateTo) return false
          if (wageFilters.nickname && !e.nickname.toLowerCase().includes(wageFilters.nickname.toLowerCase())) return false
          return true
        })

        // Summary by nickname
        const summary: Record<string, { dept: string; days: number; totalEst: number; totalBase: number }> = {}
        wageEntries.forEach((e) => {
          const est = estimateWage(e)
          const base = BASE_RATES[e.department] ?? 0
          if (!summary[e.nickname]) summary[e.nickname] = { dept: e.department, days: 0, totalEst: 0, totalBase: 0 }
          summary[e.nickname].days += 1
          summary[e.nickname].totalEst += est
          summary[e.nickname].totalBase += base
        })

        const colorClass = { green: 'bg-[#16A34A]/10 text-[#16A34A]', yellow: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-[#DC2626]' }
        const colorLabel = { green: '▲ ดี', yellow: '~ ปกติ', red: '▼ ต่ำ' }

        return (
          <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">ตัวกรอง</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <select value={wageFilters.department}
                  onChange={(e) => setWageFilters((p) => ({ ...p, department: e.target.value }))}
                  className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">
                  <option value="">ทุกแผนก</option>
                  {wageDepts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <div className="relative">
                  <label className="absolute -top-2 left-3 text-[10px] text-gray-400 bg-white px-1">จากวันที่</label>
                  <input type="date" value={wageFilters.dateFrom}
                    onChange={(e) => setWageFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 text-[10px] text-gray-400 bg-white px-1">ถึงวันที่</label>
                  <input type="date" value={wageFilters.dateTo}
                    onChange={(e) => setWageFilters((p) => ({ ...p, dateTo: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                </div>
                <input type="text" value={wageFilters.nickname} placeholder="ค้นหาชื่อเล่น..."
                  onChange={(e) => setWageFilters((p) => ({ ...p, nickname: e.target.value }))}
                  className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
            </div>

            {/* Summary per person */}
            {Object.keys(summary).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="font-bold text-[#1E3A5F] mb-4">สรุปค่าแรงต่อคน</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                        <th className="text-left px-4 py-3">ชื่อเล่น</th>
                        <th className="text-left px-4 py-3">แผนก</th>
                        <th className="text-right px-4 py-3">วันที่ส่ง KPI</th>
                        <th className="text-right px-4 py-3">ค่าแรงฐาน (รวม)</th>
                        <th className="text-right px-4 py-3">ค่าแรงประเมิน (รวม)</th>
                        <th className="text-center px-4 py-3">ผล</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(summary).map(([name, s]) => {
                        const col = wageColor(s.totalEst, s.totalBase)
                        return (
                          <tr key={name} className="border-t border-[#E2E8F0]">
                            <td className="px-4 py-3 font-semibold text-[#374151]">{name}</td>
                            <td className="px-4 py-3 text-gray-500">{s.dept}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{s.days} วัน</td>
                            <td className="px-4 py-3 text-right text-gray-600">
                              <span className="blur-sm select-none">{s.totalBase.toLocaleString()} บ.</span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-[#1E3A5F]">{s.totalEst.toLocaleString()} บ.</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${colorClass[col]}`}>
                                {colorLabel[col]}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detail per entry */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h3 className="font-bold text-[#1E3A5F]">รายการ KPI พร้อมค่าแรงประเมิน
                  <span className="ml-2 text-sm font-normal text-gray-400">({wageEntries.length} รายการ)</span>
                </h3>
              </div>
              {wageEntries.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่พบข้อมูล</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                        <th className="text-left px-4 py-3">วันที่</th>
                        <th className="text-left px-4 py-3">ชื่อเล่น</th>
                        <th className="text-left px-4 py-3">แผนก</th>
                        <th className="text-right px-4 py-3">งาน</th>
                        <th className="text-right px-4 py-3">ฐาน</th>
                        <th className="text-right px-4 py-3">ประเมิน</th>
                        <th className="text-center px-4 py-3">ผล</th>
                        <th className="text-center px-4 py-3">AI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wageEntries.map((e, idx) => {
                        const est = estimateWage(e)
                        const base = BASE_RATES[e.department] ?? 0
                        const col = wageColor(est, base)
                        const ai = wageAnalysis[e.id]
                        const aiColor = ai ? (ai.verdict === 'ดีมาก' || ai.verdict === 'ดี' ? colorClass.green : ai.verdict === 'ไม่ตรงงาน' || ai.verdict === 'ต่ำ' ? colorClass.red : colorClass.yellow) : ''
                        return (
                          <React.Fragment key={e.id}>
                            <tr className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(e.date)}</td>
                              <td className="px-4 py-3 font-semibold text-[#374151]">{e.nickname}</td>
                              <td className="px-4 py-3 text-gray-500">{e.department}</td>
                              <td className="px-4 py-3 text-right text-gray-600">{e.tasks.filter(t => t.trim()).length} รายการ</td>
                              <td className="px-4 py-3 text-right text-gray-500">
                                <span className="blur-sm select-none">{base.toLocaleString()} บ.</span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-[#1E3A5F]">{est.toLocaleString()} บ.</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${colorClass[col]}`}>
                                  {col === 'green' ? '▲' : col === 'yellow' ? '~' : '▼'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => handleAnalyze(e)}
                                  disabled={analyzingId === e.id}
                                  className="text-xs text-[#1E3A5F] border border-[#E2E8F0] rounded-lg px-2.5 py-1 hover:bg-[#F5F6F8] disabled:opacity-50 whitespace-nowrap"
                                >
                                  {analyzingId === e.id ? '...' : '🤖 วิเคราะห์'}
                                </button>
                              </td>
                            </tr>
                            {ai && (
                              <tr className={`${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                                <td colSpan={8} className="px-4 pb-3 pt-0">
                                  <div className={`rounded-xl px-4 py-2.5 flex items-start gap-3 ${aiColor}`}>
                                    <span className="text-sm font-bold shrink-0">{ai.verdict}</span>
                                    <span className="text-xs">{ai.reason}</span>
                                    <span className="ml-auto text-sm font-bold shrink-0">{ai.estimated_wage.toLocaleString()} บ.</span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Product Requests Tab */}
      {activeTab === 'requests' && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          {loadingRequests ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : productRequests.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">
              ยังไม่มีคำขอสินค้า
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {productRequests.map((req) => (
                <div key={req.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {req.image_data && (
                    <img
                      src={req.image_data}
                      alt="สินค้า"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#1E3A5F] text-sm">{req.nickname}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(req.created_at)}</p>
                      </div>
                      {req.status === 'approved' ? (
                        <span className="shrink-0 inline-flex items-center gap-1 bg-[#16A34A]/10 text-[#16A34A] text-xs font-bold px-2.5 py-1 rounded-full">
                          ✅ อนุมัติแล้ว
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-xs font-bold px-2.5 py-1 rounded-full">
                          🟡 รอดำเนินการ
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#374151]">{req.description}</p>
                    {req.approved_at && (
                      <p className="text-xs text-[#16A34A]">อนุมัติเมื่อ {formatDateTime(req.approved_at)}</p>
                    )}
                    {req.status === 'pending' && (
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={approvingId === req.id}
                        className="w-full mt-1 bg-[#16A34A] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#15803d] disabled:opacity-60 transition-colors"
                      >
                        {approvingId === req.id ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'kpi' && (
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Today Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#1E3A5F] mb-4">
            สรุปวันนี้ — {formatDate(today)}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-center min-w-[60px]">
              <div className="text-3xl font-bold text-[#1E3A5F]">{todayEntries.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">รายการ</div>
            </div>
            <div className="w-px h-10 bg-[#E2E8F0] hidden sm:block" />
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.filter((d) => todayByDept[d] > 0).map((dept) => (
                <span
                  key={dept}
                  className="inline-flex items-center gap-1.5 bg-[#F5F6F8] border border-[#E2E8F0] rounded-full px-3 py-1 text-xs font-medium text-[#374151]"
                >
                  {dept}
                  <span className="font-bold text-[#1E3A5F]">{todayByDept[dept]}</span>
                </span>
              ))}
              {todayEntries.length === 0 && (
                <p className="text-gray-400 text-sm">ยังไม่มีข้อมูลสำหรับวันนี้</p>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">ตัวกรอง</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select
              value={filters.department}
              onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}
              className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            >
              <option value="">ทุกแผนก</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="relative">
              <label className="absolute -top-2 left-3 text-[10px] text-gray-400 bg-white px-1">
                จากวันที่
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <div className="relative">
              <label className="absolute -top-2 left-3 text-[10px] text-gray-400 bg-white px-1">
                ถึงวันที่
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <input
              type="text"
              value={filters.nickname}
              onChange={(e) => setFilters((prev) => ({ ...prev, nickname: e.target.value }))}
              placeholder="ค้นหาชื่อเล่น..."
              className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
          </div>
          <div className="mt-3 flex items-center gap-4">
            {hasFilters && (
              <button
                onClick={() =>
                  setFilters({ department: '', dateFrom: '', dateTo: '', nickname: '' })
                }
                className="text-xs text-[#DC2626] font-semibold hover:underline"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
            <button
              onClick={() => exportToExcel(filteredEntries, filters.dateFrom, filters.dateTo)}
              disabled={filteredEntries.length === 0}
              className="ml-auto flex items-center gap-2 bg-[#16A34A] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#15803d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Excel ({filteredEntries.length} รายการ)
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="font-bold text-[#1E3A5F]">
              รายการทั้งหมด
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({filteredEntries.length} รายการ)
              </span>
            </h3>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">ไม่พบข้อมูล</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                    <th className="text-left px-4 py-3">วันที่</th>
                    <th className="text-left px-4 py-3">เวลา</th>
                    <th className="text-left px-4 py-3">แผนก</th>
                    <th className="text-left px-4 py-3">ชื่อเล่น</th>
                    <th className="text-left px-4 py-3">ช่องที่ดูแล</th>
                    <th className="text-left px-4 py-3">สิ่งที่ทำ</th>
                    <th className="text-left px-4 py-3">อุปสรรค</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`cursor-pointer hover:bg-blue-50 transition-colors border-t border-[#E2E8F0] ${
                        idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">{entry.time}</td>
                      <td className="px-4 py-3">
                        <span className="bg-[#1E3A5F]/10 text-[#1E3A5F] text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">
                          {entry.department}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#374151] whitespace-nowrap">
                        {entry.nickname}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {entry.channel_name}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="block truncate text-[#374151]">
                          {entry.tasks[0]}
                          {entry.tasks.length > 1 && (
                            <span className="text-gray-400 ml-1.5 text-xs">
                              +{entry.tasks.length - 1}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <span className="block truncate text-gray-400 text-xs">
                          {entry.obstacles || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Detail Modal */}
      {/* Tax Invoices Tab */}
      {activeTab === 'tax' && (() => {
        const filtered = taxMonth
          ? taxInvoices.filter((t) => t.invoice_date.startsWith(taxMonth))
          : taxInvoices

        // Group by YYYY-MM for monthly summary
        const byMonth: Record<string, TaxInvoice[]> = {}
        filtered.forEach((t) => {
          const m = t.invoice_date.slice(0, 7)
          if (!byMonth[m]) byMonth[m] = []
          byMonth[m].push(t)
        })
        const months = Object.keys(byMonth).sort().reverse()

        function thMonth(ym: string) {
          const [y, m] = ym.split('-')
          const names = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
          return `${names[parseInt(m) - 1]} ${parseInt(y) + 543}`
        }

        return (
          <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
            {/* Filter */}
            <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-3 flex-wrap">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">กรองเดือน</p>
              <input
                type="month"
                value={taxMonth}
                onChange={(e) => { setTaxMonth(e.target.value); fetchTaxInvoices(e.target.value || undefined) }}
                className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
              {taxMonth && (
                <button onClick={() => { setTaxMonth(''); fetchTaxInvoices() }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">ล้างตัวกรอง</button>
              )}
              <span className="ml-auto text-xs text-gray-400">{filtered.length} รายการ</span>
            </div>

            {loadingTax ? (
              <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลใบกำกับภาษี</div>
            ) : (
              <>
                {/* Monthly summary table */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E2E8F0]">
                    <h3 className="font-bold text-[#1E3A5F]">สรุปรายเดือน</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                          <th className="text-left px-4 py-3">เดือน</th>
                          <th className="text-right px-4 py-3">จำนวนใบ</th>
                          <th className="text-right px-4 py-3">ยอดรวม (บาท)</th>
                          <th className="text-right px-4 py-3 text-[#16A34A]">VAT ซื้อ 7% (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {months.map((m, idx) => {
                          const items = byMonth[m]
                          const total = items.reduce((s, t) => s + t.amount, 0)
                          const vat = Math.round(total * 7 / 107 * 100) / 100
                          return (
                            <tr key={m} className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                              <td className="px-4 py-3 font-semibold text-[#374151]">{thMonth(m)}</td>
                              <td className="px-4 py-3 text-right text-gray-500">{items.length} ใบ</td>
                              <td className="px-4 py-3 text-right font-bold text-[#1E3A5F]">
                                {total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-[#16A34A]">
                                {vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detail table */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E2E8F0]">
                    <h3 className="font-bold text-[#1E3A5F]">รายการทั้งหมด</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[680px]">
                      <thead>
                        <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                          <th className="text-left px-4 py-3">วันที่ในใบ</th>
                          <th className="text-left px-4 py-3">ชื่อเล่น</th>
                          <th className="text-left px-4 py-3">แผนก</th>
                          <th className="text-left px-4 py-3">รายละเอียด</th>
                          <th className="text-right px-4 py-3">ยอดรวม</th>
                          <th className="text-right px-4 py-3 text-[#16A34A]">VAT 7%</th>
                          <th className="text-center px-4 py-3">รูป</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((t, idx) => {
                          const vat = Math.round(t.amount * 7 / 107 * 100) / 100
                          return (
                            <tr key={t.id} className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.invoice_date}</td>
                              <td className="px-4 py-3 font-semibold text-[#374151]">{t.nickname}</td>
                              <td className="px-4 py-3 text-gray-500">{t.department}</td>
                              <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{t.description || '—'}</td>
                              <td className="px-4 py-3 text-right font-bold text-[#1E3A5F]">
                                {t.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-[#16A34A]">
                                {vat.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button onClick={() => setTaxImageModal(t.image_data)}
                                  className="text-xs text-[#1E3A5F] border border-[#E2E8F0] rounded-lg px-2.5 py-1 hover:bg-[#F5F6F8]">
                                  ดูรูป
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Restock Tab */}
      {activeTab === 'restock' && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          {loadingRestock ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : restockRequests.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีการแจ้ง Restock</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {restockRequests.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {r.image_data && (
                    <img src={r.image_data} alt="สินค้า" className="w-full h-48 object-cover" />
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#374151] text-sm">{r.nickname}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(r.created_at)}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
                        r.status === 'pending'
                          ? 'bg-red-50 text-[#DC2626]'
                          : 'bg-[#16A34A]/10 text-[#16A34A]'
                      }`}>
                        {r.status === 'pending' ? 'รอดำเนินการ' : 'รับทราบแล้ว'}
                      </span>
                    </div>
                    <p className="text-sm text-[#374151]">{r.description}</p>
                    {r.status === 'pending' && (
                      <button
                        onClick={() => handleNoted(r.id)}
                        disabled={notingId === r.id}
                        className="w-full mt-1 bg-[#1E3A5F] text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                      >
                        {notingId === r.id ? 'กำลังบันทึก...' : 'รับทราบแล้ว'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stock Arrival Tab */}
      {activeTab === 'stock-arrival' && (() => {
        const filteredArrivals = stockArrivals.filter((r) => {
          const d = r.created_at.slice(0, 10)
          if (arrivalFilters.dateFrom && d < arrivalFilters.dateFrom) return false
          if (arrivalFilters.dateTo && d > arrivalFilters.dateTo) return false
          return true
        })
        const totalCost = filteredArrivals.reduce((sum, r) => sum + (Number(r.cost) || 0), 0)
        return (
          <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
            {/* Filters + Summary */}
            <div className="bg-white rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-[#374151]">
                <span className="font-semibold text-xs text-gray-500">วันที่</span>
                <input
                  type="date"
                  value={arrivalFilters.dateFrom}
                  onChange={(e) => setArrivalFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                  className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                />
                <span className="text-gray-400 text-xs">ถึง</span>
                <input
                  type="date"
                  value={arrivalFilters.dateTo}
                  onChange={(e) => setArrivalFilters((p) => ({ ...p, dateTo: e.target.value }))}
                  className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                />
                {(arrivalFilters.dateFrom || arrivalFilters.dateTo) && (
                  <button
                    onClick={() => setArrivalFilters({ dateFrom: '', dateTo: '' })}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    ล้าง
                  </button>
                )}
              </div>
              <div className="ml-auto flex items-center gap-4 text-sm">
                <span className="text-gray-500">{filteredArrivals.length} รายการ</span>
                <span className="font-bold text-[#16A34A]">ต้นทุนรวม {totalCost.toLocaleString()} บาท</span>
              </div>
            </div>

            {/* Table */}
            {loadingArrivals ? (
              <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : filteredArrivals.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีการแจ้งสินค้าเข้า</div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[860px]">
                    <thead>
                      <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                        <th className="text-left px-4 py-3">วันที่</th>
                        <th className="text-left px-4 py-3">เวลา</th>
                        <th className="text-left px-4 py-3">ชื่อเล่น</th>
                        <th className="text-left px-4 py-3">ชื่อสินค้า / LOT</th>
                        <th className="text-center px-4 py-3">จำนวน</th>
                        <th className="text-center px-4 py-3">ซอง/กล่อง</th>
                        <th className="text-right px-4 py-3">ต้นทุน (บาท)</th>
                        <th className="text-center px-4 py-3">สถานะ</th>
                        <th className="text-center px-4 py-3">รูป</th>
                        <th className="text-center px-4 py-3">รับทราบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArrivals.map((r, idx) => (
                        <tr key={r.id} className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">{formatDate(r.created_at.slice(0, 10))}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">{r.created_at.slice(11, 16)}</td>
                          <td className="px-4 py-3 font-semibold text-[#374151] whitespace-nowrap text-xs">{r.nickname}</td>
                          <td className="px-4 py-3 text-[#1E3A5F] font-semibold text-xs max-w-[180px]">
                            <span className="block truncate">{r.product_name}</span>
                            {r.note && <span className="block text-gray-400 font-normal truncate">{r.note}</span>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-[#374151]">{r.quantity}</td>
                          <td className="px-4 py-3 text-center text-xs text-[#374151]">{r.packs_per_box}</td>
                          <td className="px-4 py-3 text-right text-xs font-semibold text-[#374151]">{Number(r.cost).toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                              r.status === 'pending' ? 'bg-red-50 text-[#DC2626]' : 'bg-[#16A34A]/10 text-[#16A34A]'
                            }`}>
                              {r.status === 'pending' ? 'รอรับทราบ' : 'รับทราบแล้ว'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.image_data && (
                              <img
                                src={r.image_data}
                                alt="สินค้า"
                                onClick={() => setArrivalImageModal(r.image_data)}
                                className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 mx-auto"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {r.status === 'pending' && (
                              <button
                                onClick={() => handleAcknowledge(r.id)}
                                disabled={acknowledgingId === r.id}
                                className="bg-[#16A34A] text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 whitespace-nowrap"
                              >
                                {acknowledgingId === r.id ? '...' : 'รับทราบ'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Image Modal */}
            {arrivalImageModal && (
              <div
                className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                onClick={() => setArrivalImageModal(null)}
              >
                <img src={arrivalImageModal} alt="สินค้า" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
              </div>
            )}
          </div>
        )
      })()}

      {/* Codes Tab */}
      {activeTab === 'codes' && (
        <div className="max-w-6xl mx-auto px-4 pb-10">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[#1E3A5F] text-base">รหัสผ่านแผนก</h2>
                <p className="text-xs text-gray-400 mt-0.5">รหัสเปลี่ยนอัตโนมัติทุก 3 เดือน (รายไตรมาส)</p>
              </div>
              <button
                onClick={handleRegen}
                disabled={regenerating}
                className="bg-[#DC2626] text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {regenerating ? 'กำลังออกรหัส...' : 'ออกรหัสใหม่ทันที'}
              </button>
            </div>
            {loadingCodes ? (
              <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : deptCodes.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลรหัส</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                    <th className="text-left px-5 py-3 font-semibold">แผนก</th>
                    <th className="text-center px-5 py-3 font-semibold">รหัส 4 หลัก</th>
                    <th className="text-center px-5 py-3 font-semibold">ไตรมาส</th>
                    <th className="text-right px-5 py-3 font-semibold">วันที่ออกรหัส</th>
                  </tr>
                </thead>
                <tbody>
                  {deptCodes.map((row, i) => (
                    <tr key={row.department} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                      <td className="px-5 py-3 font-medium text-[#374151]">{row.department}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="font-mono text-2xl font-bold text-[#1E3A5F] tracking-[0.3em]">{row.code}</span>
                      </td>
                      <td className="px-5 py-3 text-center text-gray-500">{row.quarter}</td>
                      <td className="px-5 py-3 text-right text-gray-400 text-xs">
                        {new Date(row.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Upsell Tab */}
      {activeTab === 'upsell' && (() => {
        type UpsellOrder = { initial: string; freebie: string; final: string }
        const upsellEntries = entries.flatMap((e) => {
          if (!e.extra_data) return []
          try {
            const ex = JSON.parse(e.extra_data) as Record<string, unknown>
            const orders = (ex.upselling_orders as UpsellOrder[] | undefined) || []
            if (orders.length === 0) return []
            return [{ entry: e, orders }]
          } catch { return [] }
        })

        const totalOrders = upsellEntries.reduce((s, u) => s + u.orders.length, 0)
        const totalDiff = upsellEntries.reduce((s, u) =>
          s + u.orders.reduce((ss, o) => ss + (Number(o.final || 0) - Number(o.initial || 0)), 0), 0)

        const byDept: Record<string, { count: number; diff: number }> = {}
        for (const u of upsellEntries) {
          const dept = u.entry.department
          if (!byDept[dept]) byDept[dept] = { count: 0, diff: 0 }
          byDept[dept].count += u.orders.length
          byDept[dept].diff += u.orders.reduce((s, o) => s + (Number(o.final || 0) - Number(o.initial || 0)), 0)
        }

        return (
          <div className="max-w-6xl mx-auto px-4 pb-10 space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-[#1E3A5F]">{upsellEntries.length}</p>
                <p className="text-xs text-gray-400 mt-1">วันที่มีการอัพเซลล์</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-2xl font-bold text-[#1E3A5F]">{totalOrders}</p>
                <p className="text-xs text-gray-400 mt-1">จำนวน Order ทั้งหมด</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center col-span-2">
                <p className="text-2xl font-bold text-[#16A34A]">+{totalDiff.toLocaleString()} บาท</p>
                <p className="text-xs text-gray-400 mt-1">ยอดเพิ่มรวมทั้งหมด</p>
              </div>
            </div>

            {/* By dept */}
            {Object.keys(byDept).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E2E8F0]">
                  <h3 className="font-bold text-[#1E3A5F] text-sm">สรุปตามแผนก</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-2.5 font-semibold">แผนก</th>
                      <th className="text-center px-5 py-2.5 font-semibold">Order</th>
                      <th className="text-right px-5 py-2.5 font-semibold">ยอดเพิ่มรวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byDept).map(([dept, stat], i) => (
                      <tr key={dept} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-2.5 font-medium text-[#374151]">{dept}</td>
                        <td className="px-5 py-2.5 text-center text-[#1E3A5F]">{stat.count}</td>
                        <td className="px-5 py-2.5 text-right font-semibold text-[#16A34A]">+{stat.diff.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Detail table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E2E8F0]">
                <h3 className="font-bold text-[#1E3A5F] text-sm">รายการทั้งหมด</h3>
              </div>
              {upsellEntries.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลอัพเซลล์</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                        <th className="text-left px-4 py-2.5 font-semibold">วันที่</th>
                        <th className="text-left px-4 py-2.5 font-semibold">แผนก</th>
                        <th className="text-left px-4 py-2.5 font-semibold">ชื่อ</th>
                        <th className="text-center px-4 py-2.5 font-semibold">Order</th>
                        <th className="text-right px-4 py-2.5 font-semibold">ยอดเพิ่มรวม</th>
                        <th className="text-left px-4 py-2.5 font-semibold">รายละเอียด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upsellEntries.map(({ entry, orders }, i) => {
                        const diff = orders.reduce((s, o) => s + (Number(o.final || 0) - Number(o.initial || 0)), 0)
                        return (
                          <tr key={entry.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{entry.date}</td>
                            <td className="px-4 py-2.5 font-medium text-[#374151]">{entry.department}</td>
                            <td className="px-4 py-2.5 text-[#374151]">{entry.nickname}</td>
                            <td className="px-4 py-2.5 text-center text-[#1E3A5F] font-semibold">{orders.length}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-[#16A34A]">
                              {diff > 0 ? `+${diff.toLocaleString()}` : '-'}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[220px]">
                              {orders.map((o, j) => {
                                const d = Number(o.final || 0) - Number(o.initial || 0)
                                return (
                                  <div key={j} className="truncate">
                                    #{j+1} {o.initial ? `${Number(o.initial).toLocaleString()}→${o.final ? Number(o.final).toLocaleString() : '?'}` : ''}{o.freebie ? ` (${o.freebie})` : ''}{d > 0 ? ` +${d.toLocaleString()}` : ''}
                                  </div>
                                )
                              })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Tax image modal */}
      {taxImageModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setTaxImageModal(null)}>
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={taxImageModal} alt="ใบกำกับภาษี" className="w-full rounded-2xl shadow-2xl" />
            <button onClick={() => setTaxImageModal(null)}
              className="absolute top-3 right-3 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg hover:bg-black/70">
              ×
            </button>
          </div>
        </div>
      )}

      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setSelectedEntry(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-start justify-between">
              <div>
                <h3 className="font-bold text-[#1E3A5F] text-lg">{selectedEntry.nickname}</h3>
                <p className="text-xs text-gray-400 mt-0.5">#{selectedEntry.id}</p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-400 text-2xl w-8 h-8 flex items-center justify-center hover:text-gray-600 shrink-0"
                aria-label="ปิด"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="แผนก" value={selectedEntry.department} />
                <DetailRow
                  label="วันที่ / เวลา"
                  value={`${formatDate(selectedEntry.date)}  ${selectedEntry.time} น.`}
                />
                <DetailRow label="ชื่อเล่น" value={selectedEntry.nickname} />
                <DetailRow label="ช่องที่ดูแล" value={selectedEntry.channel_name} />
              </div>

              {/* Department-specific extra data */}
              <ExtraDataSection entry={selectedEntry} />

              <div>
                <p className="text-xs text-gray-500 mb-2">สิ่งที่ทำวันนี้</p>
                <ul className="space-y-2">
                  {selectedEntry.tasks.map((task, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm bg-[#F5F6F8] rounded-xl px-3 py-2"
                    >
                      <span className="text-gray-400 shrink-0">{i + 1}.</span>
                      <span className="text-[#374151]">{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {selectedEntry.obstacles ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">อุปสรรคที่เจอ</p>
                  <p className="text-sm text-[#374151] bg-[#FFF8F0] border border-orange-100 rounded-xl p-3">
                    {selectedEntry.obstacles}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-1">อุปสรรคที่เจอ</p>
                  <p className="text-sm text-gray-400">ไม่มี</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-full py-3 rounded-xl bg-[#1E3A5F] text-white font-semibold"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
