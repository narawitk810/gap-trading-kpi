'use client'

import { useSearchParams } from 'next/navigation'
import React, { useEffect, useState, useCallback } from 'react'
import { DEPARTMENTS } from '@/types/kpi'
import type { KPIEntry } from '@/types/kpi'
import * as XLSX from 'xlsx'

const ADMIN_KEY = 'GAPtrading2024admin'
const REGEN_PIN = 'GAP0000'

const BASE_RATES: Record<string, number> = {
  'การตลาด': 500,
  'บัญชี': 600,
  'ธุรการ': 400,
  'บุคคล': 600,
  'สต๊อค&จัดซื้อ': 500,
  'แพค': 400,
  'ผู้จัดการไลฟ์สด': 700,
  'ผู้จัดการหน้าร้าน': 700,
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
  rejected_reason: string | null
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
  pricing_data: string | null
  old_pricing_data: string | null
}

type PromoThreshold = {
  id: string
  nickname: string
  product_name: string
  threshold_amount: string
  start_month: string
  end_month: string
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

type EquipmentRequest = {
  id: string
  nickname: string
  request_type: string
  action: string
  description: string
  image_data: string
  status: string
  created_at: string
  acknowledged_at: string | null
}

type MeetingReport = {
  id: string
  nickname: string
  meeting_date: string
  meeting_time: string
  participants: string
  summary: string
  decisions: string
  action_items: string
  pending_issues: string
  next_meeting: string
  created_at: string
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const roundUp10 = (n: number) => Math.ceil(n / 10) * 10

function parseExtraForExcel(entry: KPIEntry): Record<string, string | number> | Record<string, string | number>[] {
  if (!entry.extra_data) return {}
  let ex: Record<string, unknown> = {}
  try { ex = JSON.parse(entry.extra_data) } catch { return {} }

  if (entry.department === 'ไลฟ์สด') {
    return {
      'ชั่วโมงไลฟ์': ex.live_hours ? String(ex.live_hours) : '',
      'ยอดขาย (บาท)': ex.sales_amount ? Number(ex.sales_amount) : '',
    }
  }
  if (entry.department === 'sale admin') {
    return {
      'ยอดขาย (บาท)': ex.sales_amount ? Number(ex.sales_amount) : '',
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
    if (Array.isArray(ex.channels)) {
      return (ex.channels as Record<string, unknown>[]).map((c) => ({
        'ช่อง': String(c.channel || ''),
        'พนักงานไลฟ์': String(c.live_staff_name || ''),
        'ต้นทุน ads (บาท)': c.ads_cost ? Number(c.ads_cost) : '',
        'รายได้ขั้นต้น (บาท)': c.gross_revenue ? Number(c.gross_revenue) : '',
        'ROI (บาท)': c.roi ? Number(c.roi) : '',
        'ต้นทุนต่อคำสั่งซื้อ (บาท)': c.cost_per_order ? Number(c.cost_per_order) : '',
        'ค่าใช้จ่ายต่อการดูไลฟ์ 10 วิ (บาท)': c.cost_per_10sec_view ? Number(c.cost_per_10sec_view) : '',
        'ระยะการดู live โดยเฉลี่ย (วินาที)': c.avg_view_duration ? Number(c.avg_view_duration) : '',
        'ยอดติดตามจาก live (user)': c.new_followers ? Number(c.new_followers) : '',
      }))
    }
    return {
      'ช่วงเวลา': ex.time_from && ex.time_to ? `${ex.time_from} – ${ex.time_to} น.` : '',
      'ต้นทุน ads (บาท)': ex.ads_cost ? Number(ex.ads_cost) : '',
      'รายได้ขั้นต้น (บาท)': ex.gross_revenue ? Number(ex.gross_revenue) : '',
      'ROI (บาท)': ex.roi ? Number(ex.roi) : '',
      'ต้นทุนต่อคำสั่งซื้อ (บาท)': ex.cost_per_order ? Number(ex.cost_per_order) : '',
      'ค่าใช้จ่ายต่อการดูไลฟ์ 10 วิ (บาท)': ex.cost_per_10sec_view ? Number(ex.cost_per_10sec_view) : '',
      'ระยะการดู live โดยเฉลี่ย (วินาที)': ex.avg_view_duration ? Number(ex.avg_view_duration) : '',
      'ยอดติดตามจาก live (user)': ex.new_followers ? Number(ex.new_followers) : '',
      ...(ex.ads_shopee ? { 'Ads Shopee (บาท)': Number(ex.ads_shopee) } : {}),
      ...(ex.ads_lazada ? { 'Ads Lazada (บาท)': Number(ex.ads_lazada) } : {}),
      ...(ex.ads_tiktok ? { 'Ads TikTok (บาท)': Number(ex.ads_tiktok) } : {}),
      ...(ex.ads_facebook ? { 'Ads Facebook (บาท)': Number(ex.ads_facebook) } : {}),
    }
  }
  return {}
}

function exportToExcel(entries: KPIEntry[], dateFrom: string, dateTo: string) {
  const rows = entries.flatMap((e) => {
    const base = {
      'รหัส': e.id,
      'วันที่': formatDate(e.date),
      'เวลา': e.time,
      'แผนก': e.department,
      'ชื่อเล่น': e.nickname,
      'ช่องที่ดูแล': e.channel_name,
      'งานที่ทำ': e.tasks.join('\n'),
      'อุปสรรค': e.obstacles || '',
    }
    const extra = parseExtraForExcel(e)
    if (Array.isArray(extra)) return extra.map((ex) => ({ ...base, ...ex }))
    return [{ ...base, ...extra }]
  })
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

  if ((dept === 'ไลฟ์สด' || dept === 'sale admin') && (ex.live_hours || ex.sales_amount)) {
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
    const metricDefs = [
      { k: 'ads_cost', l: 'ต้นทุน ads', u: 'บาท' },
      { k: 'gross_revenue', l: 'รายได้ขั้นต้น', u: 'บาท' },
      { k: 'roi', l: 'ROI', u: 'บาท' },
      { k: 'cost_per_order', l: 'ต้นทุนต่อคำสั่งซื้อ', u: 'บาท' },
      { k: 'cost_per_10sec_view', l: 'ค่าใช้จ่ายต่อการดูไลฟ์ 10 วิ', u: 'บาท' },
      { k: 'avg_view_duration', l: 'ระยะการดู live โดยเฉลี่ย', u: 'วินาที' },
      { k: 'new_followers', l: 'ยอดติดตามจาก live', u: 'user' },
    ]
    if (Array.isArray(ex.channels)) {
      const channelsData = ex.channels as Record<string, unknown>[]
      if (channelsData.length === 0) return null
      return (
        <div className="space-y-3">
          {channelsData.map((c, i) => {
            const metrics = metricDefs.filter(({ k }) => c[k])
            return (
              <div key={i} className="bg-blue-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-[#1E3A5F]">{String(c.channel || '')}</p>
                {!!c.live_staff_name && <DetailRow label="พนักงานไลฟ์" value={String(c.live_staff_name)} />}
                {metrics.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {metrics.map(({ k, l, u }) => (
                      <DetailRow key={k} label={l} value={`${Number(c[k]).toLocaleString()} ${u}`} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    const metrics = metricDefs.filter(({ k }) => ex[k])
    const oldAds = [
      { k: 'ads_shopee', l: 'Shopee' }, { k: 'ads_lazada', l: 'Lazada' },
      { k: 'ads_tiktok', l: 'TikTok' }, { k: 'ads_facebook', l: 'Facebook' },
    ].filter(({ k }) => ex[k])
    if (metrics.length === 0 && oldAds.length === 0) return null
    return (
      <div className="bg-blue-50 rounded-xl p-3 space-y-2">
        {!!(ex.time_from || ex.time_to) && (
          <DetailRow label="ช่วงเวลา" value={`${String(ex.time_from || '?')} – ${String(ex.time_to || '?')} น.`} />
        )}
        {metrics.length > 0 && (
          <>
            <p className="text-xs font-bold text-[#1E3A5F]">ข้อมูลโฆษณา</p>
            <div className="grid grid-cols-2 gap-2">
              {metrics.map(({ k, l, u }) => (
                <DetailRow key={k} label={l} value={`${Number(ex[k]).toLocaleString()} ${u}`} />
              ))}
            </div>
          </>
        )}
        {oldAds.length > 0 && (
          <>
            <p className="text-xs font-bold text-[#1E3A5F]">ค่า Ads (เดิม)</p>
            <div className="grid grid-cols-2 gap-2">
              {oldAds.map(({ k, l }) => (
                <DetailRow key={k} label={l} value={`${Number(ex[k]).toLocaleString()} บาท`} />
              ))}
            </div>
          </>
        )}
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

  const [activeTab, setActiveTab] = useState<'kpi' | 'requests' | 'complaints' | 'wage' | 'tax' | 'restock' | 'stock-arrival' | 'codes' | 'promo' | 'equipment' | 'meetings'>('kpi')
  const [deptCodes, setDeptCodes] = useState<{ department: string; code: string; quarter: string; created_at: string }[]>([])
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([])
  const [loadingRestock, setLoadingRestock] = useState(false)
  const [notingId, setNotingId] = useState<string | null>(null)
  const [promoThresholds, setPromoThresholds] = useState<PromoThreshold[]>([])
  const [loadingPromo, setLoadingPromo] = useState(false)
  const [ackingPromoId, setAckingPromoId] = useState<string | null>(null)
  const [deletingPromoId, setDeletingPromoId] = useState<string | null>(null)
  const [stockArrivals, setStockArrivals] = useState<StockArrival[]>([])
  const [loadingArrivals, setLoadingArrivals] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [deletingArrivalId, setDeletingArrivalId] = useState<string | null>(null)
  const [arrivalFilters, setArrivalFilters] = useState({ dateFrom: '', dateTo: '' })
  const [arrivalImageModal, setArrivalImageModal] = useState<string | null>(null)
  const [pricingModal, setPricingModal] = useState<StockArrival | null>(null)
  const [pmMultiplier, setPmMultiplier] = useState<string>('')
  const [pmMsrpPrice, setPmMsrpPrice] = useState('')
  const [pmRisk, setPmRisk] = useState(0)
  const [pmCommission, setPmCommission] = useState('')
  const [pmBoxSystemEnabled, setPmBoxSystemEnabled] = useState(true)
  const [pmBreakEnabled, setPmBreakEnabled] = useState(false)
  const [pmSubmitting, setPmSubmitting] = useState(false)
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([])
  const [loadingTax, setLoadingTax] = useState(false)
  const [taxMonth, setTaxMonth] = useState('')
  const [taxImageModal, setTaxImageModal] = useState<string | null>(null)
  const [wageFilters, setWageFilters] = useState({ department: '', dateFrom: '', dateTo: '', nickname: '' })
  const [wageAnalysis, setWageAnalysis] = useState<Record<string, { score: number; estimated_wage: number; verdict: string; reason: string }>>({})
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequest[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  const [acknowledgingEquipId, setAcknowledgingEquipId] = useState<string | null>(null)
  const [meetingReports, setMeetingReports] = useState<MeetingReport[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(false)

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
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [productImageModal, setProductImageModal] = useState<string | null>(null)
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

  async function handleDeleteRequest(id: string) {
    if (!confirm('ยืนยันลบคำขอนี้?')) return
    setDeletingRequestId(id)
    try {
      const res = await fetch(`/api/product-requests?key=${ADMIN_KEY}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setProductRequests((prev) => prev.filter((r) => r.id !== id))
      else alert('เกิดข้อผิดพลาด')
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setDeletingRequestId(null) }
  }

  async function handleRejectRequest(id: string, reason: string) {
    try {
      const res = await fetch(`/api/product-requests?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject', reason }),
      })
      if (res.ok) {
        setProductRequests((prev) =>
          prev.map((r) => r.id === id ? { ...r, status: 'rejected', rejected_reason: reason } : r)
        )
        setRejectModal(null)
        setRejectReason('')
      } else alert('เกิดข้อผิดพลาด')
    } catch { alert('เกิดข้อผิดพลาด') }
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

  const fetchPromoThresholds = useCallback(async () => {
    setLoadingPromo(true)
    try {
      const res = await fetch(`/api/promo-threshold?key=${ADMIN_KEY}`)
      if (res.ok) setPromoThresholds(await res.json())
    } catch { /* silent */ }
    finally { setLoadingPromo(false) }
  }, [])

  const fetchStockArrivals = useCallback(async () => {
    setLoadingArrivals(true)
    try {
      const res = await fetch(`/api/stock-arrival?key=${ADMIN_KEY}`)
      if (res.ok) setStockArrivals(await res.json())
    } catch { /* silent */ }
    finally { setLoadingArrivals(false) }
  }, [])

  function openPricingModal(r: StockArrival) {
    setPricingModal(r)
    if (r.pricing_data) {
      const p = JSON.parse(r.pricing_data)
      setPmMultiplier(p.multiplier)
      setPmMsrpPrice(p.msrp_price || '')
      setPmRisk(p.risk_amount)
      setPmCommission(p.commission_tier)
      setPmBoxSystemEnabled(p.box_system_enabled !== false)
      setPmBreakEnabled(p.break_enabled === true)
    } else {
      setPmMultiplier('')
      setPmMsrpPrice('')
      setPmRisk(0)
      setPmCommission('')
      setPmBoxSystemEnabled(true)
      setPmBreakEnabled(false)
    }
  }

  async function handlePricingSubmit() {
    if (!pricingModal) return
    if (!pmMultiplier) { alert('กรุณาเลือกประเภทสินค้า'); return }
    if (pmMultiplier === 'msrp' && !pmMsrpPrice.trim()) { alert('กรุณาระบุราคา MSRP'); return }
    if (!pmCommission) { alert('กรุณาเลือกค่าคอมมิชชั่น'); return }

    let oldPricing: Record<string, string> | null = null
    try {
      oldPricing = pricingModal.old_pricing_data ? JSON.parse(pricingModal.old_pricing_data) : null
    } catch { oldPricing = null }

    if (pmMultiplier === 'old' && !oldPricing?.box_price_system) {
      alert('ไม่มีราคาเดิม (ยกกล่อง) สำหรับสินค้านี้ กรุณาเลือกวิธีอื่น')
      return
    }

    const cost = Number(pricingModal.cost) || 0
    const packs = Number(pricingModal.packs_per_box) || 1

    let boxPriceSystem: number
    let boxPriceExternal: number
    let packPriceSystem: number
    let packPriceExternal: number

    if (pmMultiplier === 'old') {
      boxPriceSystem = Number(oldPricing!.box_price_system)
      boxPriceExternal = oldPricing!.box_price_external ? Number(oldPricing!.box_price_external) : roundUp10(boxPriceSystem * 0.90 * 0.84)
      packPriceSystem = oldPricing!.pack_price_system ? Number(oldPricing!.pack_price_system) : roundUp10((boxPriceSystem / packs) + pmRisk)
      packPriceExternal = pmBreakEnabled
        ? roundUp10(boxPriceExternal / packs)
        : (oldPricing!.pack_price_external ? Number(oldPricing!.pack_price_external) : roundUp10(packPriceSystem * 0.90))
    } else {
      const rawBoxSystem = pmMultiplier === 'msrp' ? Number(pmMsrpPrice) : cost * Number(pmMultiplier)
      boxPriceSystem = pmMultiplier === 'msrp' ? rawBoxSystem : roundUp10(rawBoxSystem)
      boxPriceExternal = roundUp10(boxPriceSystem * 0.90 * 0.84)
      packPriceSystem = roundUp10((boxPriceSystem / packs) + pmRisk)
      packPriceExternal = pmBreakEnabled
        ? roundUp10(boxPriceExternal / packs)
        : roundUp10(packPriceSystem * 0.90)
    }

    const pricing = {
      multiplier: pmMultiplier,
      msrp_price: pmMsrpPrice || null,
      risk_amount: pmRisk,
      commission_tier: pmCommission,
      box_system_enabled: pmBoxSystemEnabled,
      break_enabled: pmBreakEnabled,
      box_price_system: boxPriceSystem,
      box_price_external: boxPriceExternal,
      pack_price_system: packPriceSystem,
      pack_price_external: packPriceExternal,
    }

    setPmSubmitting(true)
    try {
      const res = await fetch(`/api/stock-arrival?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pricingModal.id, pricing }),
      })
      if (res.ok) {
        setStockArrivals((prev) => prev.map((r) => r.id === pricingModal!.id
          ? { ...r, status: 'acknowledged', acknowledged_at: new Date().toISOString(), pricing_data: JSON.stringify(pricing) }
          : r
        ))
        setPricingModal(null)
      } else { alert('เกิดข้อผิดพลาด') }
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setPmSubmitting(false) }
  }

  async function handleDeleteArrival(id: string) {
    if (!confirm('ยืนยันลบรายการสินค้าเข้านี้?')) return
    setDeletingArrivalId(id)
    try {
      const res = await fetch(`/api/stock-arrival?key=${ADMIN_KEY}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setStockArrivals((prev) => prev.filter((r) => r.id !== id))
      else alert('เกิดข้อผิดพลาด')
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setDeletingArrivalId(null) }
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

  async function handleAcknowledgePromo(id: string) {
    setAckingPromoId(id)
    try {
      const res = await fetch(`/api/promo-threshold?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setPromoThresholds((prev) => prev.map((r) => r.id === id ? { ...r, status: 'acknowledged', acknowledged_at: new Date().toISOString() } : r))
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setAckingPromoId(null) }
  }

  async function handleDeletePromo(id: string) {
    if (!confirm('ยืนยันลบโปรนี้? รายการจะหายไปจากทุกแผนก')) return
    setDeletingPromoId(id)
    try {
      const res = await fetch(`/api/promo-threshold?key=${ADMIN_KEY}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setPromoThresholds((prev) => prev.filter((r) => r.id !== id))
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setDeletingPromoId(null) }
  }

  const fetchMeetings = useCallback(async () => {
    setLoadingMeetings(true)
    try {
      const res = await fetch(`/api/meeting-report?key=${ADMIN_KEY}`)
      if (res.ok) setMeetingReports(await res.json())
    } catch { /* silent */ }
    finally { setLoadingMeetings(false) }
  }, [])

  const fetchEquipment = useCallback(async () => {
    setLoadingEquipment(true)
    try {
      const res = await fetch(`/api/equipment?key=${ADMIN_KEY}`)
      if (res.ok) setEquipmentRequests(await res.json())
    } catch { /* silent */ }
    finally { setLoadingEquipment(false) }
  }, [])

  async function handleAcknowledgeEquipment(id: string) {
    setAcknowledgingEquipId(id)
    try {
      const res = await fetch(`/api/equipment?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) setEquipmentRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: 'acknowledged', acknowledged_at: new Date().toISOString() } : r))
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setAcknowledgingEquipId(null) }
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
      fetchPromoThresholds()
      fetchEquipment()
      fetchMeetings()
    }
  }, [isAuthorized, fetchEntries, fetchProductRequests, fetchComplaints, fetchTaxInvoices, fetchRestock, fetchStockArrivals, fetchCodes, fetchPromoThresholds, fetchEquipment, fetchMeetings])

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
            onClick={() => { fetchEntries(); fetchProductRequests(); fetchComplaints(); fetchTaxInvoices(taxMonth || undefined); fetchRestock(); fetchStockArrivals(); fetchCodes(); fetchPromoThresholds(); fetchEquipment(); fetchMeetings() }}
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
            onClick={() => setActiveTab('promo')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'promo'
                ? 'bg-white text-[#16A34A]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            โปรซื้อครบ
            {promoThresholds.filter((r) => r.status === 'pending').length > 0 && (
              <span className="bg-[#16A34A] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {promoThresholds.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'equipment'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            อุปกรณ์
            {equipmentRequests.filter((r) => r.status === 'pending').length > 0 && (
              <span className="bg-[#DC2626] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {equipmentRequests.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'meetings'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            ประชุม
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
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
          {loadingRequests ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : productRequests.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">
              ยังไม่มีคำขอสินค้า
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                      <th className="text-left px-4 py-3">วันที่</th>
                      <th className="text-left px-4 py-3">ชื่อเล่น</th>
                      <th className="text-left px-4 py-3">รายละเอียดสินค้า</th>
                      <th className="text-center px-4 py-3">สถานะ</th>
                      <th className="text-center px-4 py-3">รูป</th>
                      <th className="text-center px-4 py-3">การดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRequests.map((req, idx) => (
                      <tr key={req.id} className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">
                          <div>{formatDateTime(req.created_at).split(' ')[0]}</div>
                          <div className="text-gray-400">{formatDateTime(req.created_at).split(' ').slice(1).join(' ')}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#374151] text-xs whitespace-nowrap">{req.nickname}</td>
                        <td className="px-4 py-3 text-[#374151] text-xs max-w-[220px]">
                          <span className="block">{req.description}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {req.status === 'approved' ? (
                              <span className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap bg-[#16A34A]/10 text-[#16A34A]">อนุมัติแล้ว</span>
                            ) : req.status === 'rejected' ? (
                              <span className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap bg-[#DC2626]/10 text-[#DC2626]">ไม่อนุมัติ</span>
                            ) : (
                              <span className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap bg-yellow-50 text-yellow-700">รอดำเนินการ</span>
                            )}
                            {req.status === 'rejected' && req.rejected_reason && (
                              <span className="text-[10px] text-gray-400 max-w-[120px] text-center leading-tight">{req.rejected_reason}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {req.image_data && (
                            <img
                              src={req.image_data}
                              alt="สินค้า"
                              onClick={() => setProductImageModal(req.image_data)}
                              className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 mx-auto"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {req.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(req.id)}
                                  disabled={approvingId === req.id}
                                  className="bg-[#16A34A] text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-[#15803d] disabled:opacity-60"
                                >
                                  {approvingId === req.id ? '...' : 'อนุมัติ'}
                                </button>
                                <button
                                  onClick={() => { setRejectModal(req.id); setRejectReason('') }}
                                  className="bg-red-50 text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-red-100"
                                >
                                  ไม่อนุมัติ
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteRequest(req.id)}
                              disabled={deletingRequestId === req.id}
                              className="border border-[#E2E8F0] text-gray-400 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200 disabled:opacity-60"
                            >
                              {deletingRequestId === req.id ? '...' : 'ลบ'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reject reason modal */}
          {rejectModal && (
            <div
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={(e) => { if (e.target === e.currentTarget) { setRejectModal(null); setRejectReason('') } }}
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h2 className="font-bold text-[#1E3A5F] text-base">ระบุเหตุผลที่ไม่อนุมัติ</h2>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                >
                  <option value="">— เลือกเหตุผล —</option>
                  <option value="ต้นทุนสูง">ต้นทุนสูง</option>
                  <option value="รุ่นใหม่กว่ากำลังออก">รุ่นใหม่กว่ากำลังออก</option>
                  <option value="รอราคาลงค่อยสั่ง">รอราคาลงค่อยสั่ง</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setRejectModal(null); setRejectReason('') }}
                    className="flex-1 border border-[#E2E8F0] text-gray-500 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F5F6F8]"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleRejectRequest(rejectModal, rejectReason)}
                    disabled={!rejectReason.trim()}
                    className="flex-1 bg-[#DC2626] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    ยืนยันไม่อนุมัติ
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Product image modal */}
          {productImageModal && (
            <div
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
              onClick={() => setProductImageModal(null)}
            >
              <img src={productImageModal} alt="สินค้า" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
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

      {/* Meetings Tab */}
      {activeTab === 'meetings' && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          {loadingMeetings ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : meetingReports.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีรายงานการประชุม</div>
          ) : (
            <div className="space-y-4">
              {meetingReports.map((r) => {
                const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
                const formatMeetDate = (d: string) => {
                  if (!d) return ''
                  const [y, m, day] = d.split('-')
                  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`
                }
                return (
                  <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-[#1E3A5F] px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-sm">{formatMeetDate(r.meeting_date)} เวลา {r.meeting_time} น.</p>
                        <p className="text-white/70 text-xs mt-0.5">บันทึกโดย {r.nickname} · {formatDateTime(r.created_at)}</p>
                      </div>
                    </div>
                    <div className="p-5 space-y-3">
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">ผู้เข้าร่วม</p>
                        <p className="text-sm text-[#374151] whitespace-pre-wrap">{r.participants}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">สรุปประเด็น</p>
                        <p className="text-sm text-[#374151] whitespace-pre-wrap">{r.summary}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">มติ/ข้อตัดสินใจ</p>
                        <p className="text-sm text-[#374151] whitespace-pre-wrap">{r.decisions}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Action Items</p>
                        <p className="text-sm text-[#374151] whitespace-pre-wrap">{r.action_items}</p>
                      </div>
                      {r.pending_issues && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">เรื่องค้าง</p>
                          <p className="text-sm text-[#374151] whitespace-pre-wrap">{r.pending_issues}</p>
                        </div>
                      )}
                      {r.next_meeting && (
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">นัดครั้งหน้า</p>
                          <p className="text-sm text-[#374151]">{r.next_meeting}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <div className="max-w-6xl mx-auto px-4 py-6">
          {loadingEquipment ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : equipmentRequests.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีการแจ้งเกี่ยวกับอุปกรณ์</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipmentRequests.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {r.image_data && (
                    <img src={r.image_data} alt="อุปกรณ์" className="w-full h-48 object-cover" />
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#374151] text-sm">{r.nickname}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(r.created_at)}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.request_type === 'damaged' ? 'bg-red-50 text-[#DC2626]' : 'bg-blue-50 text-[#1E3A5F]'
                          }`}>
                            {r.request_type === 'damaged' ? 'อุปกรณ์เสีย' : 'เบิกใหม่'}
                          </span>
                          {r.action && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                              {r.action}
                            </span>
                          )}
                        </div>
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
                        onClick={() => handleAcknowledgeEquipment(r.id)}
                        disabled={acknowledgingEquipId === r.id}
                        className="w-full mt-1 bg-[#1E3A5F] text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                      >
                        {acknowledgingEquipId === r.id ? 'กำลังบันทึก...' : 'รับทราบแล้ว'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {activeTab === 'promo' && (() => {
        const promoMonthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
        const formatPromoMonth = (m: string) => {
          if (!m) return ''
          const [y, mo] = m.split('-')
          return `${promoMonthNames[parseInt(mo) - 1]} ${parseInt(y) + 543}`
        }
        return (
          <div className="max-w-6xl mx-auto px-4 py-6">
            {loadingPromo ? (
              <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : promoThresholds.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีการแจ้งโปรซื้อครบ</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {promoThresholds.map((r) => (
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
                      <p className="text-sm font-semibold text-[#374151]">{r.product_name}</p>
                      <p className="text-sm text-[#374151]">ซื้อครบ <span className="font-bold">{r.threshold_amount}</span> บาท</p>
                      <p className="text-xs text-gray-400">{formatPromoMonth(r.start_month)} – {formatPromoMonth(r.end_month)}</p>
                      {r.note && <p className="text-xs text-gray-400">{r.note}</p>}
                      <div className="flex gap-2 mt-1">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => handleAcknowledgePromo(r.id)}
                            disabled={ackingPromoId === r.id}
                            className="flex-1 bg-[#1E3A5F] text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                          >
                            {ackingPromoId === r.id ? 'กำลังบันทึก...' : 'รับทราบแล้ว'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePromo(r.id)}
                          disabled={deletingPromoId === r.id}
                          className="px-3 py-2 bg-red-50 text-[#DC2626] rounded-xl text-sm font-semibold disabled:opacity-60 hover:bg-red-100"
                        >
                          {deletingPromoId === r.id ? '...' : 'ลบ'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

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
                        <th className="text-center px-4 py-3">การดำเนินการ</th>
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
                              r.status === 'pending'
                                ? 'bg-yellow-50 text-yellow-700'
                                : 'bg-[#16A34A]/10 text-[#16A34A]'
                            }`}>
                              {r.status === 'pending' ? 'รอดำเนินการ' : 'ดำเนินการแล้ว'}
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
                            <div className="flex items-center justify-center gap-1.5">
                              {r.status === 'pending' ? (
                                <button
                                  onClick={() => openPricingModal(r)}
                                  className="bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                                >
                                  กำหนดราคา
                                </button>
                              ) : r.pricing_data ? (
                                <button
                                  onClick={() => openPricingModal(r)}
                                  className="border border-[#1E3A5F] text-[#1E3A5F] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-[#F5F6F8]"
                                >
                                  แก้ไขราคา
                                </button>
                              ) : null}
                              <button
                                onClick={() => handleDeleteArrival(r.id)}
                                disabled={deletingArrivalId === r.id}
                                className="bg-red-50 text-[#DC2626] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-red-100 disabled:opacity-60"
                              >
                                {deletingArrivalId === r.id ? '...' : 'ลบ'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pricing Modal */}
            {pricingModal && (() => {
              const cost = Number(pricingModal.cost) || 0
              const packs = Number(pricingModal.packs_per_box) || 1

              let boxPriceSystem = 0
              let boxPriceExternal = 0
              let packPriceSystem = 0
              let packPriceExternal = 0
              let calcReady = false

              let oldPricing: Record<string, string> | null = null
              try {
                oldPricing = pricingModal.old_pricing_data ? JSON.parse(pricingModal.old_pricing_data) : null
              } catch { oldPricing = null }

              if (pmMultiplier) {
                if (pmMultiplier === 'msrp' && pmMsrpPrice) {
                  boxPriceSystem = Number(pmMsrpPrice)
                  calcReady = true
                } else if (pmMultiplier === 'old' && oldPricing?.box_price_system) {
                  boxPriceSystem = Number(oldPricing.box_price_system)
                  boxPriceExternal = oldPricing.box_price_external ? Number(oldPricing.box_price_external) : roundUp10(boxPriceSystem * 0.90 * 0.84)
                  packPriceSystem = oldPricing.pack_price_system ? Number(oldPricing.pack_price_system) : roundUp10((boxPriceSystem / packs) + pmRisk)
                  packPriceExternal = pmBreakEnabled
                    ? roundUp10(boxPriceExternal / packs)
                    : (oldPricing.pack_price_external ? Number(oldPricing.pack_price_external) : roundUp10(packPriceSystem * 0.90))
                  calcReady = true
                } else if (pmMultiplier !== 'msrp' && pmMultiplier !== 'old') {
                  boxPriceSystem = roundUp10(cost * Number(pmMultiplier))
                  calcReady = true
                }
                if (calcReady && pmMultiplier !== 'old') {
                  boxPriceExternal = roundUp10(boxPriceSystem * 0.90 * 0.84)
                  packPriceSystem = roundUp10((boxPriceSystem / packs) + pmRisk)
                  packPriceExternal = pmBreakEnabled
                    ? roundUp10(boxPriceExternal / packs)
                    : roundUp10(packPriceSystem * 0.90)
                }
              }

              const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              const MULTIPLIERS = [
                { key: '2.4', label: 'ทั่วไป', value: 2.4 },
                { key: '2.6', label: 'หายาก', value: 2.6 },
                { key: '2.8', label: 'หายากมาก', value: 2.8 },
                { key: '3', label: 'สั่งไม่ได้อีก', value: 3 },
              ]

              return (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setPricingModal(null) }}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
                    {/* Header */}
                    <div className="bg-[#1E3A5F] text-white px-5 py-4 rounded-t-2xl">
                      <p className="text-xs opacity-70 mb-0.5">{pricingModal.pricing_data ? 'แก้ไขราคา' : 'กำหนดราคา'}</p>
                      <h2 className="font-bold text-base leading-tight">{pricingModal.product_name}</h2>
                      <p className="text-xs opacity-60 mt-0.5">ต้นทุน {Number(pricingModal.cost).toLocaleString()} บาท · {pricingModal.packs_per_box} ซอง/กล่อง</p>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Multiplier selection */}
                      <>
                          <div>
                            <p className="text-xs font-semibold text-[#374151] mb-2">เลือกประเภทสินค้า <span className="text-[#DC2626]">*</span></p>
                            <div className="space-y-2">
                              {/* MSRP option */}
                              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${pmMultiplier === 'msrp' ? 'border-[#1E3A5F] bg-blue-50' : 'border-[#E2E8F0]'}`}>
                                <input type="radio" name="multiplier" value="msrp" checked={pmMultiplier === 'msrp'} onChange={() => setPmMultiplier('msrp')} className="accent-[#1E3A5F]" />
                                <span className="text-sm font-semibold text-[#374151]">MSRP</span>
                                <span className="text-xs text-gray-400">(sleeve / playmat)</span>
                                {pmMultiplier === 'msrp' && (
                                  <input
                                    type="number"
                                    value={pmMsrpPrice}
                                    onChange={(e) => setPmMsrpPrice(e.target.value)}
                                    placeholder="ราคา MSRP (บาท)"
                                    className="ml-auto border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}
                              </label>
                              {/* Old price option */}
                              <label className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${oldPricing?.box_price_system ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${pmMultiplier === 'old' ? 'border-[#1E3A5F] bg-blue-50' : 'border-[#E2E8F0]'}`}>
                                <input
                                  type="radio"
                                  name="multiplier"
                                  value="old"
                                  checked={pmMultiplier === 'old'}
                                  disabled={!oldPricing?.box_price_system}
                                  onChange={() => setPmMultiplier('old')}
                                  className="accent-[#1E3A5F]"
                                />
                                <span className="text-sm font-semibold text-[#374151]">ราคาเดิม</span>
                                <span className="text-xs text-gray-400">(ตามที่ Stock แจ้ง)</span>
                                {oldPricing?.box_price_system ? (
                                  <span className="ml-auto text-sm font-bold text-[#1E3A5F]">{oldPricing.box_price_system} ฿</span>
                                ) : (
                                  <span className="ml-auto text-xs text-gray-400">ไม่มีข้อมูล</span>
                                )}
                              </label>
                              {/* Multiplier options */}
                              {MULTIPLIERS.map((m) => (
                                <label key={m.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${pmMultiplier === m.key ? 'border-[#1E3A5F] bg-blue-50' : 'border-[#E2E8F0]'}`}>
                                  <input type="radio" name="multiplier" value={m.key} checked={pmMultiplier === m.key} onChange={() => setPmMultiplier(m.key)} className="accent-[#1E3A5F]" />
                                  <span className="text-sm font-semibold text-[#374151]">{m.label}</span>
                                  <span className="text-xs text-gray-400">× {m.value}</span>
                                  {cost > 0 && <span className="ml-auto text-sm font-bold text-[#1E3A5F]">{(cost * m.value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ฿</span>}
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Risk amount */}
                          <div>
                            <p className="text-xs font-semibold text-[#374151] mb-2">บวกความเสี่ยง (ราคาซอง)</p>
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min={0}
                                max={200}
                                value={pmRisk}
                                onChange={(e) => setPmRisk(Math.min(200, Math.max(0, Number(e.target.value) || 0)))}
                                className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                                placeholder="0"
                              />
                              <span className="text-xs text-gray-400">บาท (0–200)</span>
                            </div>
                          </div>
                        </>

                      {/* Result */}
                      {calcReady && (
                        <div className="bg-[#F5F6F8] rounded-xl p-4 space-y-2">
                          <p className="text-xs font-semibold text-gray-500 mb-3">ผลการคำนวณ</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <p className="text-xs text-gray-400 mb-1">ยกกล่อง (ในระบบ)</p>
                              <p className="text-base font-bold text-[#1E3A5F]">{fmt(boxPriceSystem)}</p>
                              <p className="text-xs text-gray-400">บาท</p>
                              {pmMultiplier !== 'old' && oldPricing?.box_price_system && (
                                <p className="text-xs text-gray-400 mt-1 pt-1 border-t border-[#E2E8F0]">เดิม: {oldPricing.box_price_system} บาท</p>
                              )}
                              <div className="flex gap-1 mt-2">
                                <button type="button" onClick={() => setPmBoxSystemEnabled(true)}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${pmBoxSystemEnabled ? 'bg-[#16A34A] text-white border-[#16A34A]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  ลงระบบ
                                </button>
                                <button type="button" onClick={() => setPmBoxSystemEnabled(false)}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${!pmBoxSystemEnabled ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  ไม่ลงระบบ
                                </button>
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <p className="text-xs text-gray-400 mb-1">ยกกล่อง (โยนนอก)</p>
                              <p className="text-base font-bold text-[#374151]">{fmt(boxPriceExternal)}</p>
                              <p className="text-xs text-gray-400">บาท</p>
                              {pmMultiplier !== 'old' && oldPricing?.box_price_external && (
                                <p className="text-xs text-gray-400 mt-1 pt-1 border-t border-[#E2E8F0]">เดิม: {oldPricing.box_price_external} บาท</p>
                              )}
                            </div>
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <p className="text-xs text-gray-400 mb-1">แยกซอง (ในระบบ){pmRisk > 0 ? ` +${pmRisk}฿` : ''}</p>
                              <p className="text-base font-bold text-[#16A34A]">{fmt(packPriceSystem)}</p>
                              <p className="text-xs text-gray-400">บาท/ซอง</p>
                              {pmMultiplier !== 'old' && oldPricing?.pack_price_system && (
                                <p className="text-xs text-gray-400 mt-1 pt-1 border-t border-[#E2E8F0]">เดิม: {oldPricing.pack_price_system} บาท</p>
                              )}
                              <div className="flex gap-1 mt-2">
                                <button type="button" onClick={() => setPmBreakEnabled(false)}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${!pmBreakEnabled ? 'bg-[#374151] text-white border-[#374151]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  break ได้ปกติ
                                </button>
                                <button type="button" onClick={() => setPmBreakEnabled(true)}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${pmBreakEnabled ? 'bg-[#D97706] text-white border-[#D97706]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  เปิด break เท่านั้น
                                </button>
                              </div>
                            </div>
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <p className="text-xs text-gray-400 mb-1">แยกซอง (โยนนอก)</p>
                              <p className="text-base font-bold text-[#374151]">{fmt(packPriceExternal)}</p>
                              <p className="text-xs text-gray-400">บาท/ซอง</p>
                              {pmMultiplier !== 'old' && oldPricing?.pack_price_external && (
                                <p className="text-xs text-gray-400 mt-1 pt-1 border-t border-[#E2E8F0]">เดิม: {oldPricing.pack_price_external} บาท</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Commission tier */}
                      <div>
                          <p className="text-xs font-semibold text-[#374151] mb-2">ค่าคอมมิชชั่น <span className="text-[#DC2626]">*</span></p>
                          <div className="flex gap-2">
                            {[{ key: 'P1', label: 'P(1)', pct: '1%' }, { key: 'P2', label: 'P(2)', pct: '2%' }, { key: 'P3', label: 'P(3)', pct: '3%' }].map((p) => (
                              <button
                                key={p.key}
                                type="button"
                                onClick={() => setPmCommission(p.key)}
                                className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-colors ${
                                  pmCommission === p.key ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'border-[#E2E8F0] text-[#374151]'
                                }`}
                              >
                                {p.label}<br/><span className="text-xs font-normal">{p.pct}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-5 pb-5 flex gap-3">
                      <button
                        onClick={() => setPricingModal(null)}
                        className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={handlePricingSubmit}
                        disabled={pmSubmitting}
                        className="flex-1 bg-[#16A34A] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
                      >
                        {pmSubmitting ? 'กำลังบันทึก...' : 'บันทึก ✓'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}

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
                onClick={() => {
                  const pin = window.prompt('กรุณากรอกรหัสส่วนตัวเพื่อออกรหัสใหม่')
                  if (pin !== REGEN_PIN) {
                    if (pin !== null) alert('รหัสไม่ถูกต้อง ไม่สามารถดำเนินการได้')
                    return
                  }
                  handleRegen()
                }}
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
                <DetailRow
                  label={selectedEntry.department === 'การตลาด' ? 'ช่องที่ ROI ต่ำกว่า 15' : 'ช่องที่ดูแล'}
                  value={selectedEntry.channel_name}
                />
              </div>

              {/* ช่องที่ ROI ต่ำกว่า 15 — แสดงเฉพาะแผนกการตลาด */}
              {selectedEntry.department === 'การตลาด' && selectedEntry.channel_name && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-[#DC2626] mb-2">ช่องที่ ROI ต่ำกว่า 15</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntry.channel_name.split(', ').map((ch, i) => (
                      <span key={i} className="bg-white border border-red-200 text-[#DC2626] text-xs font-semibold px-2.5 py-1 rounded-full">
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ช่องที่ ROI สูงสุด — แสดงเฉพาะแผนกการตลาด */}
              {selectedEntry.department === 'การตลาด' && (() => {
                try {
                  const ex = JSON.parse(selectedEntry.extra_data || '{}')
                  const best = ex.best_roi as Record<string, unknown> | undefined
                  if (!best?.channel) return null
                  const metricDefs = [
                    { k: 'ads_cost', l: 'ต้นทุน ads', u: 'บาท' },
                    { k: 'gross_revenue', l: 'รายได้ขั้นต้น', u: 'บาท' },
                    { k: 'roi', l: 'ROI', u: 'บาท' },
                    { k: 'cost_per_order', l: 'ต้นทุนต่อคำสั่งซื้อ', u: 'บาท' },
                    { k: 'cost_per_10sec_view', l: 'ค่าใช้จ่ายต่อการดูไลฟ์ 10 วิ', u: 'บาท' },
                    { k: 'avg_view_duration', l: 'ระยะการดู live โดยเฉลี่ย', u: 'วินาที' },
                    { k: 'new_followers', l: 'ยอดติดตามจาก live', u: 'user' },
                  ]
                  const metrics = metricDefs.filter(({ k }) => best[k])
                  return (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-bold text-[#16A34A]">ช่องที่ ROI สูงสุดวันนี้</p>
                      <span className="bg-white border border-green-200 text-[#16A34A] text-sm font-bold px-3 py-1 rounded-full inline-block">
                        {String(best.channel)}
                      </span>
                      {!!best.live_staff_name && (
                        <DetailRow label="พนักงานไลฟ์" value={String(best.live_staff_name)} />
                      )}
                      {metrics.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {metrics.map(({ k, l, u }) => (
                            <DetailRow key={k} label={l} value={`${Number(best[k]).toLocaleString()} ${u}`} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                } catch { return null }
              })()}

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
