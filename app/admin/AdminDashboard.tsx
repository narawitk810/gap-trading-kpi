'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { DEPARTMENTS } from '@/types/kpi'
import type { KPIEntry } from '@/types/kpi'
import * as XLSX from 'xlsx'

const ADMIN_KEY = 'GAPtrading2024admin'
const REGEN_PIN = 'GAP0000'

const BASE_RATES: Record<string, number> = {
  'การตลาด': 500,
  'บัญชี&การเงิน': 600,
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
  status: string
  created_at: string
  acknowledged_at: string | null
  pricing_data: string | null
  old_pricing_data: string | null
  tiktok_listed_at: string | null
  sku_code_box: string | null
  sku_code_pack: string | null
  allocation: string | null
}

type PromoThreshold = {
  id: string
  nickname: string
  product_name: string
  threshold_amount: string
  start_month: string
  end_month: string
  note: string | null
  has_image: number
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

type LiveStaffMember = {
  id: string
  name: string
  rank_name: string
  rank_emoji: string
  rank_order: number
  is_head?: number
  badge_emoji?: string
}

const BADGE_PRESETS = ['🚀', '🌟', '💪', '🏆', '⭐', '🔥', '👑', '🎯', '💯', '✨']

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
  if (entry.department === 'Sales Admin') {
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
        'ชั่วโมงไลฟ์ (ชม.)': c.live_hours ? Number(c.live_hours) : '',
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

  if ((dept === 'ไลฟ์สด' || dept === 'Sales Admin') && (ex.live_hours || ex.sales_amount)) {
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
      { k: 'live_hours', l: 'ชั่วโมงไลฟ์', u: 'ชม.' },
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

interface PreorderProduct { id: string; name: string; description: string; price: number; close_date: string; release_date: string; sku: string; max_qty: number; image_data: string; is_active: number }
interface PreorderOrder { id: string; product_id: string; nickname: string; quantity: number; phone: string; note: string; status: string; created_at: string }
interface PreorderFormData { id?: string; name: string; description: string; price: string; close_date: string; release_date: string; sku: string; max_qty: string; image_data: string }

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1200
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.src = url
  })
}

export default function AdminDashboard() {
  const searchParams = useSearchParams()
  const [authed, setAuthed] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (searchParams.get('key') === ADMIN_KEY) {
      localStorage.setItem('adminAuthedExpiry', String(Date.now() + 10 * 24 * 60 * 60 * 1000))
      setAuthed(true)
    } else {
      const expiry = localStorage.getItem('adminAuthedExpiry')
      if (expiry && Date.now() < Number(expiry)) {
        setAuthed(true)
      }
    }
    const todayDate = getTodayDate()
    setKpiAnalysisDate(todayDate)
    try {
      const cached = localStorage.getItem(`kpiAnalysis_${todayDate}`)
      if (cached) setKpiOverviewAnalysis(JSON.parse(cached))
    } catch { /* ignore */ }
  }, [searchParams])

  function handleLogin() {
    if (passwordInput === 'admin12345') {
      localStorage.setItem('adminAuthedExpiry', String(Date.now() + 10 * 24 * 60 * 60 * 1000))
      setAuthed(true)
    } else {
      setPasswordError('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่')
    }
  }

  const [activeTab, setActiveTab] = useState<'kpi' | 'requests' | 'complaints' | 'wage' | 'tax' | 'restock' | 'stock-arrival' | 'codes' | 'promo' | 'equipment' | 'meetings' | 'adjust-rank' | 'preorder' | 'tournament-creds' | 'tournament-schedule' | 'announcements' | 'tcg-rewards' | 'tcg-members' | 'tcg-bookings'>('kpi')
  const [announcements, setAnnouncements] = useState<{ id: string; title: string; content: string; image_data: string; file_name: string; is_pinned: number; is_active: number; created_by: string; created_at: string; has_image?: number; has_file?: number; attached_file_name?: string }[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [tcgGames, setTcgGames] = useState<{ id: string; name: string; short_name: string }[]>([])
  const [tcgRewardGame, setTcgRewardGame] = useState('')
  const [tcgRewardMonth, setTcgRewardMonth] = useState(new Date().toISOString().slice(0, 7))
  const [tcgRewardInputs, setTcgRewardInputs] = useState<Record<string, string>>({})
  const [tcgRewardSaving, setTcgRewardSaving] = useState(false)
  const [tcgRewardMsg, setTcgRewardMsg] = useState('')
  const [tcgRewardImages, setTcgRewardImages] = useState<Record<string, string>>({})
  const [tcgMembers, setTcgMembers] = useState<{id:string,full_name:string,nickname:string,phone:string,date_of_birth:string,created_at:string}[]>([])
  const [tcgMembersLoading, setTcgMembersLoading] = useState(false)
  const [tcgMembersSearch, setTcgMembersSearch] = useState('')
  const [tcgBookings, setTcgBookings] = useState<{id:string,name:string,phone:string,date:string,start_hour:number,duration:number,people:number,note:string,status:string,created_at:string}[]>([])
  const [tcgBookingsMonth, setTcgBookingsMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [tcgBookingsLoading, setTcgBookingsLoading] = useState(false)
  const [annForm, setAnnForm] = useState({ title: '', content: '', created_by: '', is_pinned: false, image_data: '', file_name: '', file_data: '', attached_file_name: '' })
  const [submittingAnn, setSubmittingAnn] = useState(false)
  const [deletingAnnId, setDeletingAnnId] = useState<string | null>(null)
  const [togglingAnnId, setTogglingAnnId] = useState<string | null>(null)
  const [annSubTab, setAnnSubTab] = useState<'general' | 'company' | 'dept' | 'rules'>('general')
  const [deptAnns, setDeptAnns] = useState<{ id: string; department: string; title: string; content: string; is_active: number; created_by: string; created_at: string; has_image?: number; has_file?: number; image_name?: string; file_name?: string }[]>([])
  const [loadingDeptAnns, setLoadingDeptAnns] = useState(false)
  const [deptAnnForm, setDeptAnnForm] = useState({ department: '', title: '', content: '', created_by: 'HR', image_data: '', image_name: '', file_data: '', file_name: '' })
  const [submittingDeptAnn, setSubmittingDeptAnn] = useState(false)
  const [deletingDeptAnnId, setDeletingDeptAnnId] = useState<string | null>(null)
  const [togglingDeptAnnId, setTogglingDeptAnnId] = useState<string | null>(null)
  const [deptRules, setDeptRules] = useState<{ id: string; department: string; title: string; content: string; sort_order: number; is_active: number; created_by: string; created_at: string; has_image?: number; has_file?: number; image_name?: string; file_name?: string }[]>([])
  const [loadingDeptRules, setLoadingDeptRules] = useState(false)
  const [deptRuleForm, setDeptRuleForm] = useState({ department: '', title: '', content: '', sort_order: 0, created_by: 'HR', image_data: '', image_name: '', file_data: '', file_name: '' })
  const [submittingDeptRule, setSubmittingDeptRule] = useState(false)
  const [deletingDeptRuleId, setDeletingDeptRuleId] = useState<string | null>(null)
  const [companyRules, setCompanyRules] = useState<{ id: string; title: string; content: string; sort_order: number; is_active: number; created_by: string; created_at: string; has_image?: number; has_file?: number; image_name?: string; file_name?: string }[]>([])
  const [loadingCompanyRules, setLoadingCompanyRules] = useState(false)
  const [companyRuleForm, setCompanyRuleForm] = useState({ title: '', content: '', sort_order: 0, created_by: 'HR', image_data: '', image_name: '', file_data: '', file_name: '' })
  const [submittingCompanyRule, setSubmittingCompanyRule] = useState(false)
  const [deletingCompanyRuleId, setDeletingCompanyRuleId] = useState<string | null>(null)
  const [editingAnn, setEditingAnn] = useState<{ id: string; title: string; content: string; image_data: string; file_name: string; file_data: string; attached_file_name: string; is_pinned: boolean } | null>(null)
  const [savingEditAnn, setSavingEditAnn] = useState(false)
  const [editingCompanyRule, setEditingCompanyRule] = useState<{ id: string; title: string; content: string; sort_order: number; created_by: string; image_data: string; image_name: string; file_data: string; file_name: string } | null>(null)
  const [savingEditCompanyRule, setSavingEditCompanyRule] = useState(false)
  const [editingDeptAnn, setEditingDeptAnn] = useState<{ id: string; department: string; title: string; content: string; created_by: string; image_data: string; image_name: string; file_data: string; file_name: string } | null>(null)
  const [savingEditDeptAnn, setSavingEditDeptAnn] = useState(false)
  const [editingDeptRule, setEditingDeptRule] = useState<{ id: string; department: string; title: string; content: string; sort_order: number; created_by: string; image_data: string; image_name: string; file_data: string; file_name: string } | null>(null)
  const [savingEditDeptRule, setSavingEditDeptRule] = useState(false)
  const [deptCodes, setDeptCodes] = useState<{ department: string; code: string; quarter: string; created_at: string }[]>([])
  const [loadingCodes, setLoadingCodes] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [sysLinks, setSysLinks] = useState<{ key: string; url: string; label: string; system_id: string; system_password: string }[]>([])
  const [sysLinksEdit, setSysLinksEdit] = useState<Record<string, string>>({})
  const [tournamentGames, setTournamentGames] = useState<{ id: string; store_id: string; game_name: string }[]>([])
  const [newGameName, setNewGameName] = useState<Record<string, string>>({})
  const [addingGame, setAddingGame] = useState<Record<string, boolean>>({})
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null)
  const [tournamentCreds, setTournamentCreds] = useState<Record<string, { system_id: string; system_password: string }>>({})
  const [tournamentCredsEdit, setTournamentCredsEdit] = useState<Record<string, string>>({})
  const [tournamentSystems, setTournamentSystems] = useState<{ id: string; label: string; url: string; emoji: string }[]>([])
  const [newSysLabel, setNewSysLabel] = useState('')
  const [newSysUrl, setNewSysUrl] = useState('')
  const [newSysEmoji, setNewSysEmoji] = useState('🎮')
  const [addingSystem, setAddingSystem] = useState(false)
  const [deletingSystemId, setDeletingSystemId] = useState<string | null>(null)
  const [restockRequests, setRestockRequests] = useState<RestockRequest[]>([])
  const [loadingRestock, setLoadingRestock] = useState(false)
  const [notingId, setNotingId] = useState<string | null>(null)
  const [promoThresholds, setPromoThresholds] = useState<PromoThreshold[]>([])
  const [loadingPromo, setLoadingPromo] = useState(false)
  const [ackingPromoId, setAckingPromoId] = useState<string | null>(null)
  const [deletingPromoId, setDeletingPromoId] = useState<string | null>(null)
  const [extendingPromoId, setExtendingPromoId] = useState<string | null>(null)
  const [extendModal, setExtendModal] = useState<{ promo: PromoThreshold; startMonth: string; endMonth: string } | null>(null)
  const [stockArrivals, setStockArrivals] = useState<StockArrival[]>([])
  const [loadingArrivals, setLoadingArrivals] = useState(false)
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
  const [deletingArrivalId, setDeletingArrivalId] = useState<string | null>(null)
  const [arrivalFilters, setArrivalFilters] = useState({ dateFrom: '', dateTo: '', search: '' })
  const [arrivalImageModal, setArrivalImageModal] = useState<string | null>(null)
  const [allocationEdits, setAllocationEdits] = useState<Record<string, string>>({})
  const [allocationStatus, setAllocationStatus] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({})
  const [pricingModal, setPricingModal] = useState<StockArrival | null>(null)
  const [pmMultiplier, setPmMultiplier] = useState<string>('')
  const [pmCustomMultiplier, setPmCustomMultiplier] = useState('')
  const [pmMsrpPrice, setPmMsrpPrice] = useState('')
  const [pmRisk, setPmRisk] = useState(0)
  const [pmCommission, setPmCommission] = useState('')
  const [pmBoxSystemEnabled, setPmBoxSystemEnabled] = useState(true)
  const [pmBoxNoExternal, setPmBoxNoExternal] = useState(false)
  const [pmBreakEnabled, setPmBreakEnabled] = useState(false)
  const [pmNoPackSale, setPmNoPackSale] = useState(false)
  const [pmSubmitting, setPmSubmitting] = useState(false)
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([])
  const [loadingTax, setLoadingTax] = useState(false)
  const [taxMonth, setTaxMonth] = useState('')
  const [taxImageModal, setTaxImageModal] = useState<string | null>(null)
  const [wageFilters, setWageFilters] = useState({ department: '', dateFrom: '', dateTo: '', nickname: '' })
  const [wageAnalysis, setWageAnalysis] = useState<Record<string, { score: number; estimated_wage: number; verdict: string; reason: string }>>({})
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [kpiOverviewAnalysis, setKpiOverviewAnalysis] = useState<{ overall: string; strong_depts: string; concern_depts: string; common_obstacles: string; recommendation: string } | null>(null)
  const [analyzingKpiOverview, setAnalyzingKpiOverview] = useState(false)
  const [kpiAnalysisDate, setKpiAnalysisDate] = useState('')
  const [equipmentRequests, setEquipmentRequests] = useState<EquipmentRequest[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  const [acknowledgingEquipId, setAcknowledgingEquipId] = useState<string | null>(null)
  const [equipDisbursements, setEquipDisbursements] = useState<{ equipment_id: string; status: string }[]>([])
  const [meetingReports, setMeetingReports] = useState<MeetingReport[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [liveStaff, setLiveStaff] = useState<LiveStaffMember[]>([])
  const [loadingLiveStaff, setLoadingLiveStaff] = useState(false)
  const [savingRankId, setSavingRankId] = useState<string | null>(null)
  const [rankSavedId, setRankSavedId] = useState<string | null>(null)
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffRank, setNewStaffRank] = useState('1|Junior Live Sales|🥉')
  const [addingStaff, setAddingStaff] = useState(false)
  const [addStaffError, setAddStaffError] = useState('')
  const [adjustRankDept, setAdjustRankDept] = useState<'ไลฟ์สด' | 'Creative' | 'การตลาด' | 'Sales Admin' | 'Store Retail' | 'สต๊อค&จัดซื้อ' | 'แพค' | 'บัญชี&การเงิน' | 'ธุรการ' | 'บุคคล' | 'ผู้จัดการไลฟ์สด' | 'ผู้จัดการหน้าร้าน'>('ไลฟ์สด')
  const [creativeStaff, setCreativeStaff] = useState<LiveStaffMember[]>([])
  const [loadingCreativeStaff, setLoadingCreativeStaff] = useState(false)
  const [savingCreativeRankId, setSavingCreativeRankId] = useState<string | null>(null)
  const [creativeRankSavedId, setCreativeRankSavedId] = useState<string | null>(null)
  const [newCreativeStaffName, setNewCreativeStaffName] = useState('')
  const [newCreativeStaffRank, setNewCreativeStaffRank] = useState('1|Junior Creative|🥉')
  const [addingCreativeStaff, setAddingCreativeStaff] = useState(false)
  const [addCreativeStaffError, setAddCreativeStaffError] = useState('')
  const [marketingStaff, setMarketingStaff] = useState<LiveStaffMember[]>([])
  const [loadingMarketingStaff, setLoadingMarketingStaff] = useState(false)
  const [savingMarketingRankId, setSavingMarketingRankId] = useState<string | null>(null)
  const [marketingRankSavedId, setMarketingRankSavedId] = useState<string | null>(null)
  const [newMarketingStaffName, setNewMarketingStaffName] = useState('')
  const [newMarketingStaffRank, setNewMarketingStaffRank] = useState('1|Junior Marketing|🥉')
  const [addingMarketingStaff, setAddingMarketingStaff] = useState(false)
  const [addMarketingStaffError, setAddMarketingStaffError] = useState('')
  const [saleAdminStaff, setSaleAdminStaff] = useState<LiveStaffMember[]>([])
  const [loadingSaleAdminStaff, setLoadingSaleAdminStaff] = useState(false)
  const [savingSaleAdminRankId, setSavingSaleAdminRankId] = useState<string | null>(null)
  const [saleAdminRankSavedId, setSaleAdminRankSavedId] = useState<string | null>(null)
  const [newSaleAdminStaffName, setNewSaleAdminStaffName] = useState('')
  const [newSaleAdminStaffRank, setNewSaleAdminStaffRank] = useState('2|Sales Admin|🥈')
  const [addingSaleAdminStaff, setAddingSaleAdminStaff] = useState(false)
  const [addSaleAdminStaffError, setAddSaleAdminStaffError] = useState('')
  const [storeRetailStaff, setStoreRetailStaff] = useState<LiveStaffMember[]>([])
  const [loadingStoreRetailStaff, setLoadingStoreRetailStaff] = useState(false)
  const [savingStoreRetailRankId, setSavingStoreRetailRankId] = useState<string | null>(null)
  const [storeRetailRankSavedId, setStoreRetailRankSavedId] = useState<string | null>(null)
  const [newStoreRetailStaffName, setNewStoreRetailStaffName] = useState('')
  const [newStoreRetailStaffRank, setNewStoreRetailStaffRank] = useState('1|Junior Store Retail|🥉')
  const [addingStoreRetailStaff, setAddingStoreRetailStaff] = useState(false)
  const [addStoreRetailStaffError, setAddStoreRetailStaffError] = useState('')
  const [stockPurchasingStaff, setStockPurchasingStaff] = useState<LiveStaffMember[]>([])
  const [loadingStockPurchasingStaff, setLoadingStockPurchasingStaff] = useState(false)
  const [savingStockPurchasingRankId, setSavingStockPurchasingRankId] = useState<string | null>(null)
  const [stockPurchasingRankSavedId, setStockPurchasingRankSavedId] = useState<string | null>(null)
  const [newStockPurchasingStaffName, setNewStockPurchasingStaffName] = useState('')
  const [newStockPurchasingStaffRank, setNewStockPurchasingStaffRank] = useState('3|Senior Stock & Purchasing|🥇')
  const [addingStockPurchasingStaff, setAddingStockPurchasingStaff] = useState(false)
  const [addStockPurchasingStaffError, setAddStockPurchasingStaffError] = useState('')
  const [packStaff, setPackStaff] = useState<LiveStaffMember[]>([])
  const [loadingPackStaff, setLoadingPackStaff] = useState(false)
  const [savingPackRankId, setSavingPackRankId] = useState<string | null>(null)
  const [packRankSavedId, setPackRankSavedId] = useState<string | null>(null)
  const [newPackStaffName, setNewPackStaffName] = useState('')
  const [newPackStaffRank, setNewPackStaffRank] = useState('2|Fulfillment|🥈')
  const [addingPackStaff, setAddingPackStaff] = useState(false)
  const [addPackStaffError, setAddPackStaffError] = useState('')
  const [accountingStaff, setAccountingStaff] = useState<LiveStaffMember[]>([])
  const [loadingAccountingStaff, setLoadingAccountingStaff] = useState(false)
  const [savingAccountingRankId, setSavingAccountingRankId] = useState<string | null>(null)
  const [accountingRankSavedId, setAccountingRankSavedId] = useState<string | null>(null)
  const [newAccountingStaffName, setNewAccountingStaffName] = useState('')
  const [newAccountingStaffRank, setNewAccountingStaffRank] = useState('2|Accounting Supervisor|📋')
  const [addingAccountingStaff, setAddingAccountingStaff] = useState(false)
  const [addAccountingStaffError, setAddAccountingStaffError] = useState('')
  const [administrationStaff, setAdministrationStaff] = useState<LiveStaffMember[]>([])
  const [loadingAdministrationStaff, setLoadingAdministrationStaff] = useState(false)
  const [savingAdministrationRankId, setSavingAdministrationRankId] = useState<string | null>(null)
  const [administrationRankSavedId, setAdministrationRankSavedId] = useState<string | null>(null)
  const [newAdministrationStaffName, setNewAdministrationStaffName] = useState('')
  const [newAdministrationStaffRank, setNewAdministrationStaffRank] = useState('1|Administration Officer|🗂️')
  const [addingAdministrationStaff, setAddingAdministrationStaff] = useState(false)
  const [addAdministrationStaffError, setAddAdministrationStaffError] = useState('')
  const [hrStaff, setHrStaff] = useState<LiveStaffMember[]>([])
  const [loadingHrStaff, setLoadingHrStaff] = useState(false)
  const [savingHrRankId, setSavingHrRankId] = useState<string | null>(null)
  const [hrRankSavedId, setHrRankSavedId] = useState<string | null>(null)
  const [newHrStaffName, setNewHrStaffName] = useState('')
  const [newHrStaffRank, setNewHrStaffRank] = useState('2|HR Supervisor|🧑‍💼')
  const [addingHrStaff, setAddingHrStaff] = useState(false)
  const [addHrStaffError, setAddHrStaffError] = useState('')
  const [liveManagerStaff, setLiveManagerStaff] = useState<LiveStaffMember[]>([])
  const [loadingLiveManagerStaff, setLoadingLiveManagerStaff] = useState(false)
  const [savingLiveManagerRankId, setSavingLiveManagerRankId] = useState<string | null>(null)
  const [liveManagerRankSavedId, setLiveManagerRankSavedId] = useState<string | null>(null)
  const [newLiveManagerStaffName, setNewLiveManagerStaffName] = useState('')
  const [newLiveManagerStaffRank, setNewLiveManagerStaffRank] = useState('1|Live Team Leader|👥')
  const [addingLiveManagerStaff, setAddingLiveManagerStaff] = useState(false)
  const [addLiveManagerStaffError, setAddLiveManagerStaffError] = useState('')
  const [storeManagerStaff, setStoreManagerStaff] = useState<LiveStaffMember[]>([])
  const [loadingStoreManagerStaff, setLoadingStoreManagerStaff] = useState(false)
  const [savingStoreManagerRankId, setSavingStoreManagerRankId] = useState<string | null>(null)
  const [storeManagerRankSavedId, setStoreManagerRankSavedId] = useState<string | null>(null)
  const [newStoreManagerStaffName, setNewStoreManagerStaffName] = useState('')
  const [newStoreManagerStaffRank, setNewStoreManagerStaffRank] = useState('1|Junior Store Manager|🥉')
  const [addingStoreManagerStaff, setAddingStoreManagerStaff] = useState(false)
  const [addStoreManagerStaffError, setAddStoreManagerStaffError] = useState('')
  const [savingHeadId, setSavingHeadId] = useState<string | null>(null)
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null)
  const [badgeModal, setBadgeModal] = useState<{ id: string; currentBadge: string } | null>(null)
  const [rankUnlocked, setRankUnlocked] = useState(() => {
    if (typeof window === 'undefined') return false
    const expiry = localStorage.getItem('rankUnlockedExpiry')
    return !!expiry && Date.now() < Number(expiry)
  })
  const [rankCodeInput, setRankCodeInput] = useState('')
  const [rankCodeError, setRankCodeError] = useState('')

  // Pre-order states
  const [preorderProducts, setPreorderProducts] = useState<PreorderProduct[]>([])
  const [preorderOrders, setPreorderOrders] = useState<PreorderOrder[]>([])
  const [preorderSubTab, setPreorderSubTab] = useState<'products' | 'orders'>('products')
  const [preorderForm, setPreorderForm] = useState<PreorderFormData | null>(null)
  const [preorderFilterPid, setPreorderFilterPid] = useState('')
  const [preorderSaving, setPreorderSaving] = useState(false)
  const [preorderSaveError, setPreorderSaveError] = useState('')
  const [preorderFormErrors, setPreorderFormErrors] = useState<Partial<PreorderFormData>>({})
  const [loadingPreorder, setLoadingPreorder] = useState(false)
  const promoFetched = useRef(false)
  const preorderImageRef = useRef<HTMLInputElement>(null)
  type PreorderImgPair = { t: string; f: string }
  const [preorderImages, setPreorderImages] = useState<PreorderImgPair[]>([])
  const [preorderFileKey, setPreorderFileKey] = useState(0)
  const [preorderCompressing, setPreorderCompressing] = useState(false)

  type TournamentEvent = { id: string; kpi_id: string; store_id: string; nickname: string; facebook_url: string; event_date: string; start_time: string; created_at: string }
  const [tournamentEvents, setTournamentEvents] = useState<TournamentEvent[]>([])
  const [loadingTournamentEvents, setLoadingTournamentEvents] = useState(false)

  async function fetchTournamentEvents() {
    setLoadingTournamentEvents(true)
    try {
      const res = await fetch('/api/tournament-events')
      const data = await res.json()
      setTournamentEvents(data.events || [])
    } catch { /* */ }
    finally { setLoadingTournamentEvents(false) }
  }

  function parsePreorderImages(raw: string): PreorderImgPair[] {
    if (!raw) return []
    try {
      const p = JSON.parse(raw)
      if (!Array.isArray(p)) return [{ t: raw, f: raw }]
      return p.map((item) => (typeof item === 'string' ? { t: item, f: item } : (item as PreorderImgPair)))
    } catch { return raw ? [{ t: raw, f: raw }] : [] }
  }

  function compressPreorderToDataURL(img: HTMLImageElement, maxPx: number, quality: number): string {
    let { width, height } = img
    if (width > maxPx || height > maxPx) {
      if (width > height) { height = Math.round((height * maxPx) / width); width = maxPx }
      else { width = Math.round((width * maxPx) / height); height = maxPx }
    }
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  }

  function compressPreorderImage(file: File): Promise<PreorderImgPair> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new Image()
        img.onload = () => {
          resolve({
            f: compressPreorderToDataURL(img, 1200, 0.78),
            t: compressPreorderToDataURL(img, 40, 0.5),
          })
        }
        img.src = ev.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  async function handleAddPreorderImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreorderCompressing(true)
    try {
      const pair = await compressPreorderImage(file)
      setPreorderImages((prev) => [...prev, pair].slice(0, 10))
    } finally {
      setPreorderCompressing(false)
      setPreorderFileKey((k) => k + 1)
    }
  }

  async function loadPreorderData() {
    setLoadingPreorder(true)
    const [prodRes, ordRes] = await Promise.all([
      fetch(`/api/preorder-products?key=${ADMIN_KEY}`),
      fetch(`/api/preorder-orders?key=${ADMIN_KEY}`),
    ])
    if (prodRes.ok) setPreorderProducts(await prodRes.json())
    if (ordRes.ok) setPreorderOrders(await ordRes.json())
    setLoadingPreorder(false)
  }

  async function deleteStaff(s: LiveStaffMember, staffSetter: React.Dispatch<React.SetStateAction<LiveStaffMember[]>>) {
    if (!window.confirm(`ยืนยันลบ "${s.name}" ออกจากระบบ?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return
    setDeletingStaffId(s.id)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id }),
      })
      if (res.ok) staffSetter((prev) => prev.filter((x) => x.id !== s.id))
      else alert('ลบไม่สำเร็จ — กรุณาลองอีกครั้ง')
    } catch { alert('เกิดข้อผิดพลาด — กรุณาลองอีกครั้ง') }
    finally { setDeletingStaffId(null) }
  }

  async function toggleHead(s: LiveStaffMember, staffSetter: React.Dispatch<React.SetStateAction<LiveStaffMember[]>>) {
    setSavingHeadId(s.id)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, is_head: s.is_head ? 0 : 1 }),
      })
      if (res.ok) {
        staffSetter((prev) => prev.map((x) => x.id === s.id ? { ...x, is_head: s.is_head ? 0 : 1 } : x))
      }
    } catch { /* ignore */ }
    finally { setSavingHeadId(null) }
  }

  function handleUnlockRank() {
    if (rankCodeInput === 'gap0000') {
      localStorage.setItem('rankUnlockedExpiry', String(Date.now() + 10 * 24 * 60 * 60 * 1000))
      setRankUnlocked(true)
      setRankCodeInput('')
    } else {
      setRankCodeError('รหัสไม่ถูกต้อง — กรุณาลองอีกครั้ง')
    }
  }

  async function handleSetBadge(id: string, emoji: string) {
    await fetch('/api/hr/employee-badge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, badge_emoji: emoji }),
    })
    const setterMap: Record<string, React.Dispatch<React.SetStateAction<LiveStaffMember[]>>> = {
      'ไลฟ์สด': setLiveStaff, 'Creative': setCreativeStaff, 'การตลาด': setMarketingStaff,
      'Sales Admin': setSaleAdminStaff, 'Store Retail': setStoreRetailStaff,
      'สต๊อค&จัดซื้อ': setStockPurchasingStaff, 'แพค': setPackStaff,
      'บัญชี&การเงิน': setAccountingStaff, 'ธุรการ': setAdministrationStaff,
      'บุคคล': setHrStaff, 'ผู้จัดการไลฟ์สด': setLiveManagerStaff,
      'ผู้จัดการหน้าร้าน': setStoreManagerStaff,
    }
    const setter = setterMap[adjustRankDept]
    if (setter) setter((prev) => prev.map((x) => x.id === id ? { ...x, badge_emoji: emoji } : x))
    setBadgeModal(null)
  }

  function handleLockRank() {
    localStorage.removeItem('rankUnlockedExpiry')
    setRankUnlocked(false)
    setRankCodeInput('')
    setRankCodeError('')
  }

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

  function loadCachedAnalysis(date: string) {
    try {
      const cached = localStorage.getItem(`kpiAnalysis_${date}`)
      if (cached) { setKpiOverviewAnalysis(JSON.parse(cached)); return true }
    } catch { /* ignore */ }
    return false
  }

  async function handleAnalyzeKpiOverview() {
    const dateEntries = entries.filter((e) => e.date === kpiAnalysisDate)
    if (dateEntries.length === 0) { alert('ไม่มีข้อมูล KPI ในวันที่เลือก'); return }
    setAnalyzingKpiOverview(true)
    setKpiOverviewAnalysis(null)
    try {
      const res = await fetch('/api/analyze-kpi-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: kpiAnalysisDate,
          entries: dateEntries.map((e) => ({
            department: e.department,
            nickname: e.nickname,
            tasks: e.tasks,
            obstacles: e.obstacles,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setKpiOverviewAnalysis(data)
        localStorage.setItem(`kpiAnalysis_${kpiAnalysisDate}`, JSON.stringify(data))
      } else alert(data.error || 'วิเคราะห์ไม่สำเร็จ')
    } catch { alert('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setAnalyzingKpiOverview(false) }
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
  const [editStatusModal, setEditStatusModal] = useState<string | null>(null)
  const [editStatusValue, setEditStatusValue] = useState('')
  const [editStatusReason, setEditStatusReason] = useState('')
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

  async function handleEditStatus(id: string, newStatus: string, reason: string) {
    try {
      const res = await fetch(`/api/product-requests?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'edit', status: newStatus, reason }),
      })
      if (res.ok) {
        setProductRequests((prev) =>
          prev.map((r) => r.id === id
            ? { ...r, status: newStatus, rejected_reason: newStatus === 'rejected' ? reason : null,
                approved_at: newStatus === 'approved' ? new Date().toISOString() : null }
            : r
          )
        )
        setEditStatusModal(null)
        setEditStatusValue('')
        setEditStatusReason('')
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
    try {
      const res2 = await fetch(`/api/system-links?key=${ADMIN_KEY}`)
      if (res2.ok) {
        const data = await res2.json()
        const links: { key: string; url: string; label: string; system_id: string; system_password: string }[] = data.links || []
        setSysLinks(links)
        const init: Record<string, string> = {}
        links.forEach((l) => {
          init[`${l.key}_url`] = l.url
          init[`${l.key}_system_id`] = l.system_id || ''
          init[`${l.key}_system_password`] = l.system_password || ''
        })
        setSysLinksEdit(init)
      }
    } catch { /* silent */ }
  }, [])

  const fetchTournamentCreds = useCallback(async () => {
    try {
      const res = await fetch('/api/tournament-creds')
      if (!res.ok) return
      const data = await res.json()
      const map: Record<string, { system_id: string; system_password: string }> = {}
      const edit: Record<string, string> = {}
      ;(data.creds || []).forEach((r: { store: string; system: string; system_id: string; system_password: string }) => {
        const k = `${r.store}_${r.system}`
        map[k] = { system_id: r.system_id || '', system_password: r.system_password || '' }
        edit[`${k}_system_id`] = r.system_id || ''
        edit[`${k}_system_password`] = r.system_password || ''
      })
      setTournamentCreds(map)
      setTournamentCredsEdit(edit)
    } catch { /* silent */ }
  }, [])

  const fetchTournamentGames = useCallback(async () => {
    try {
      const res = await fetch('/api/tournament-games')
      if (res.ok) { const data = await res.json(); setTournamentGames(data.games || []) }
    } catch { /* silent */ }
  }, [])

  const fetchTournamentSystems = useCallback(async () => {
    try {
      const res = await fetch('/api/tournament-systems')
      if (res.ok) { const data = await res.json(); setTournamentSystems(data.systems || []) }
    } catch { /* silent */ }
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

  const FIXED_MULTIPLIER_KEYS = ['2.4', '2.6', '2.8', '3', 'msrp', 'old']

  function openPricingModal(r: StockArrival) {
    setPricingModal(r)
    if (r.pricing_data) {
      const p = JSON.parse(r.pricing_data)
      if (!FIXED_MULTIPLIER_KEYS.includes(p.multiplier)) {
        setPmMultiplier('custom')
        setPmCustomMultiplier(p.multiplier)
      } else {
        setPmMultiplier(p.multiplier)
        setPmCustomMultiplier('')
      }
      setPmMsrpPrice(p.msrp_price || '')
      setPmRisk(p.risk_amount)
      setPmCommission(p.commission_tier)
      setPmBoxSystemEnabled(p.box_system_enabled !== false)
      setPmBoxNoExternal(p.box_no_external === true)
      setPmBreakEnabled(p.break_enabled === true)
      setPmNoPackSale(p.no_pack_sale === true)
    } else {
      setPmMultiplier('')
      setPmCustomMultiplier('')
      setPmMsrpPrice('')
      setPmRisk(0)
      setPmCommission('')
      setPmBoxSystemEnabled(true)
      setPmBoxNoExternal(false)
      setPmBreakEnabled(false)
      setPmNoPackSale(false)
    }
  }

  async function handlePricingSubmit() {
    if (!pricingModal) return
    if (!pmMultiplier) { alert('กรุณาเลือกประเภทสินค้า'); return }
    if (pmMultiplier === 'msrp' && !pmMsrpPrice.trim()) { alert('กรุณาระบุราคา MSRP'); return }
    if (pmMultiplier === 'custom' && (!pmCustomMultiplier || Number(pmCustomMultiplier) <= 0)) { alert('กรุณาระบุตัวคูณ'); return }
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
      const effectiveMult = pmMultiplier === 'custom' ? Number(pmCustomMultiplier) : Number(pmMultiplier)
      const rawBoxSystem = pmMultiplier === 'msrp' ? Number(pmMsrpPrice) : cost * effectiveMult
      boxPriceSystem = pmMultiplier === 'msrp' ? rawBoxSystem : roundUp10(rawBoxSystem)
      boxPriceExternal = roundUp10(boxPriceSystem * 0.90 * 0.84)
      packPriceSystem = roundUp10((boxPriceSystem / packs) + pmRisk)
      packPriceExternal = pmBreakEnabled
        ? roundUp10(boxPriceExternal / packs)
        : roundUp10(packPriceSystem * 0.90)
    }

    const pricing = {
      multiplier: pmMultiplier === 'custom' ? pmCustomMultiplier : pmMultiplier,
      msrp_price: pmMsrpPrice || null,
      risk_amount: pmRisk,
      commission_tier: pmCommission,
      box_system_enabled: pmBoxSystemEnabled,
      box_no_external: pmBoxNoExternal,
      break_enabled: pmBreakEnabled,
      no_pack_sale: pmNoPackSale,
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

  const fetchLiveStaff = useCallback(async () => {
    setLoadingLiveStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=ไลฟ์สด`)
      if (res.ok) {
        const data = await res.json()
        setLiveStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingLiveStaff(false) }
  }, [])

  const fetchCreativeStaff = useCallback(async () => {
    setLoadingCreativeStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=Creative`)
      if (res.ok) {
        const data = await res.json()
        setCreativeStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingCreativeStaff(false) }
  }, [])

  const fetchMarketingStaff = useCallback(async () => {
    setLoadingMarketingStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=การตลาด`)
      if (res.ok) {
        const data = await res.json()
        setMarketingStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingMarketingStaff(false) }
  }, [])

  const fetchSaleAdminStaff = useCallback(async () => {
    setLoadingSaleAdminStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=sale admin`)
      if (res.ok) {
        const data = await res.json()
        setSaleAdminStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingSaleAdminStaff(false) }
  }, [])

  const fetchStoreRetailStaff = useCallback(async () => {
    setLoadingStoreRetailStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=Store Retail`)
      if (res.ok) {
        const data = await res.json()
        setStoreRetailStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingStoreRetailStaff(false) }
  }, [])

  const fetchStockPurchasingStaff = useCallback(async () => {
    setLoadingStockPurchasingStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=` + encodeURIComponent('สต๊อค&จัดซื้อ'))
      if (res.ok) {
        const data = await res.json()
        setStockPurchasingStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingStockPurchasingStaff(false) }
  }, [])

  const fetchPackStaff = useCallback(async () => {
    setLoadingPackStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=แพค`)
      if (res.ok) {
        const data = await res.json()
        setPackStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingPackStaff(false) }
  }, [])

  const fetchAccountingStaff = useCallback(async () => {
    setLoadingAccountingStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=` + encodeURIComponent('บัญชี&การเงิน'))
      if (res.ok) {
        const data = await res.json()
        setAccountingStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingAccountingStaff(false) }
  }, [])

  const fetchAdministrationStaff = useCallback(async () => {
    setLoadingAdministrationStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=ธุรการ`)
      if (res.ok) {
        const data = await res.json()
        setAdministrationStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingAdministrationStaff(false) }
  }, [])

  const fetchHrStaff = useCallback(async () => {
    setLoadingHrStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=บุคคล`)
      if (res.ok) {
        const data = await res.json()
        setHrStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingHrStaff(false) }
  }, [])

  const fetchLiveManagerStaff = useCallback(async () => {
    setLoadingLiveManagerStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=` + encodeURIComponent('ผู้จัดการไลฟ์สด'))
      if (res.ok) {
        const data = await res.json()
        setLiveManagerStaff(data.staff || [])
      }
    } catch { /* silent */ }
    finally { setLoadingLiveManagerStaff(false) }
  }, [])

  const fetchStoreManagerStaff = useCallback(async () => {
    setLoadingStoreManagerStaff(true)
    try {
      const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}&department=` + encodeURIComponent('ผู้จัดการหน้าร้าน'))
      if (res.ok) { const data = await res.json(); setStoreManagerStaff(data.staff || []) }
    } catch { /* silent */ }
    finally { setLoadingStoreManagerStaff(false) }
  }, [])

  const fetchEquipment = useCallback(async () => {
    setLoadingEquipment(true)
    try {
      const [eqRes, disbRes] = await Promise.all([
        fetch(`/api/equipment?key=${ADMIN_KEY}`),
        fetch('/api/disbursements'),
      ])
      if (eqRes.ok) setEquipmentRequests(await eqRes.json())
      if (disbRes.ok) {
        const disbs: { equipment_id: string; status: string }[] = await disbRes.json()
        setEquipDisbursements(disbs.filter((d) => d.equipment_id))
      }
    } catch { /* silent */ }
    finally { setLoadingEquipment(false) }
  }, [])

  const [sendingToDisbursementId, setSendingToDisbursementId] = useState<string | null>(null)

  async function handleSendToDisbursement(r: EquipmentRequest) {
    if (!confirm(`ยืนยันส่ง "${r.nickname}" เข้าระบบเบิกจ่าย?`)) return
    setSendingToDisbursementId(r.id)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await fetch('/api/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester: r.nickname,
          item_list: r.description || r.request_type,
          amount: 0,
          request_date: today,
          request_doc: r.image_data || '',
          equipment_id: r.id,
          initial_status: 'pending_approval',
        }),
      })
      if (res.ok) {
        await fetch(`/api/equipment?key=${ADMIN_KEY}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.id }),
        })
        setEquipmentRequests((prev) => prev.map((eq) => eq.id === r.id ? { ...eq, status: 'acknowledged' } : eq))
        alert('ส่งเข้าระบบเบิกจ่ายเรียบร้อย')
      } else {
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setSendingToDisbursementId(null) }
  }

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
    if (authed) {
      fetchEntries()
      fetchProductRequests()
      fetchComplaints()
      fetchTaxInvoices()
      fetchRestock()
      fetchCodes()
      fetchEquipment()
      fetchMeetings()
      fetchTournamentCreds()
    }
  }, [authed, fetchEntries, fetchProductRequests, fetchComplaints, fetchTaxInvoices, fetchRestock, fetchCodes, fetchEquipment, fetchMeetings, fetchTournamentCreds])

  useEffect(() => {
    if (!authed || activeTab !== 'tcg-bookings') return
    setTcgBookingsLoading(true)
    fetch(`/api/tcg/bookings?month=${tcgBookingsMonth}`)
      .then(r => r.json())
      .then(data => setTcgBookings(data.bookings || []))
      .catch(() => {})
      .finally(() => setTcgBookingsLoading(false))
  }, [authed, activeTab, tcgBookingsMonth])

  function shiftTcgMonth(delta: number) {
    const [y, m] = tcgBookingsMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setTcgBookingsMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function formatTcgMonth(ym: string) {
    const [y, m] = ym.split('-').map(Number)
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
    return `${months[m - 1]} ${y + 543}`
  }

  function formatThaiDateAdmin(dateStr: string) {
    if (!dateStr) return ''
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
    const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์']
    const d = new Date(dateStr + 'T12:00:00')
    return `วัน${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full space-y-4">
          <p className="text-4xl text-center">🔒</p>
          <p className="font-bold text-[#1E3A5F] text-lg text-center">G Admin — GAP TRADING</p>
          <input
            type="password"
            placeholder="ใส่รหัสผ่าน"
            value={passwordInput}
            onChange={(e) => { setPasswordInput(e.target.value); setPasswordError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className={`w-full border rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1E3A5F] ${passwordError ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`}
          />
          {passwordError && <p className="text-xs text-[#DC2626]">{passwordError}</p>}
          <button onClick={handleLogin} className="w-full bg-[#1E3A5F] text-white font-bold py-3 rounded-xl">
            เข้าสู่ระบบ
          </button>
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

  async function handleSaveEditAnn() {
    if (!editingAnn || !editingAnn.title.trim()) return
    setSavingEditAnn(true)
    try {
      const res = await fetch('/api/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: ADMIN_KEY, id: editingAnn.id, title: editingAnn.title, content: editingAnn.content, image_data: editingAnn.image_data, file_name: editingAnn.file_name, file_data: editingAnn.file_data, attached_file_name: editingAnn.attached_file_name, is_pinned: editingAnn.is_pinned }),
      })
      if (res.ok) {
        setAnnouncements((prev) => prev.map((a) => a.id === editingAnn.id ? { ...a, title: editingAnn.title, content: editingAnn.content, image_data: editingAnn.image_data, file_name: editingAnn.file_name, is_pinned: editingAnn.is_pinned ? 1 : 0 } : a))
        setEditingAnn(null)
      }
    } catch { /* silent */ } finally { setSavingEditAnn(false) }
  }

  async function handleSaveEditCompanyRule() {
    if (!editingCompanyRule || !editingCompanyRule.title.trim()) return
    setSavingEditCompanyRule(true)
    try {
      const res = await fetch(`/api/dept-rules?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCompanyRule.id, title: editingCompanyRule.title, content: editingCompanyRule.content, sort_order: editingCompanyRule.sort_order, image_data: editingCompanyRule.image_data, image_name: editingCompanyRule.image_name, file_data: editingCompanyRule.file_data, file_name: editingCompanyRule.file_name }),
      })
      if (res.ok) {
        setCompanyRules((prev) => prev.map((r) => r.id === editingCompanyRule.id ? { ...r, title: editingCompanyRule.title, content: editingCompanyRule.content, sort_order: editingCompanyRule.sort_order } : r))
        setEditingCompanyRule(null)
      }
    } catch { /* silent */ } finally { setSavingEditCompanyRule(false) }
  }

  async function handleSaveEditDeptAnn() {
    if (!editingDeptAnn || !editingDeptAnn.title.trim()) return
    setSavingEditDeptAnn(true)
    try {
      const res = await fetch(`/api/dept-announcements?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingDeptAnn.id, title: editingDeptAnn.title, content: editingDeptAnn.content, image_data: editingDeptAnn.image_data, image_name: editingDeptAnn.image_name, file_data: editingDeptAnn.file_data, file_name: editingDeptAnn.file_name }),
      })
      if (res.ok) {
        setDeptAnns((prev) => prev.map((a) => a.id === editingDeptAnn.id ? { ...a, title: editingDeptAnn.title, content: editingDeptAnn.content } : a))
        setEditingDeptAnn(null)
      }
    } catch { /* silent */ } finally { setSavingEditDeptAnn(false) }
  }

  async function handleSaveEditDeptRule() {
    if (!editingDeptRule || !editingDeptRule.title.trim()) return
    setSavingEditDeptRule(true)
    try {
      const res = await fetch(`/api/dept-rules?key=${ADMIN_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingDeptRule.id, title: editingDeptRule.title, content: editingDeptRule.content, sort_order: editingDeptRule.sort_order, image_data: editingDeptRule.image_data, image_name: editingDeptRule.image_name, file_data: editingDeptRule.file_data, file_name: editingDeptRule.file_name }),
      })
      if (res.ok) {
        setDeptRules((prev) => prev.map((r) => r.id === editingDeptRule.id ? { ...r, title: editingDeptRule.title, content: editingDeptRule.content, sort_order: editingDeptRule.sort_order } : r))
        setEditingDeptRule(null)
      }
    } catch { /* silent */ } finally { setSavingEditDeptRule(false) }
  }

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
            onClick={() => { fetchEntries(); fetchProductRequests(); fetchComplaints(); fetchTaxInvoices(taxMonth || undefined); fetchRestock(); if (activeTab === 'stock-arrival') fetchStockArrivals(); fetchCodes(); fetchPromoThresholds(); fetchEquipment(); fetchMeetings(); fetchTournamentCreds() }}
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
            onClick={() => { setActiveTab('stock-arrival'); if (stockArrivals.length === 0) fetchStockArrivals() }}
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
            onClick={() => { setActiveTab('promo'); if (!promoFetched.current) { fetchPromoThresholds(); promoFetched.current = true } }}
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
            แจ้งเบิก
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
          <button
            onClick={() => { setActiveTab('adjust-rank'); fetchLiveStaff(); fetchCreativeStaff(); fetchMarketingStaff(); fetchSaleAdminStaff(); fetchStoreRetailStaff(); fetchStockPurchasingStaff(); fetchPackStaff(); fetchAccountingStaff(); fetchAdministrationStaff(); fetchHrStaff(); fetchLiveManagerStaff(); fetchStoreManagerStaff() }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'adjust-rank'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            ปรับตำแหน่ง
          </button>
          <button
            onClick={() => { setActiveTab('preorder'); loadPreorderData() }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'preorder'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            Pre-Order
          </button>
          <button
            onClick={() => { setActiveTab('tournament-creds'); fetchTournamentCreds(); fetchTournamentGames(); fetchTournamentSystems() }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'tournament-creds'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            รหัสจัดงานแข่ง
          </button>
          <button
            onClick={() => { setActiveTab('tournament-schedule'); fetchTournamentEvents() }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'tournament-schedule'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            📅 ปฏิทินแข่ง
          </button>
          <button
            onClick={() => {
              setActiveTab('announcements')
              if (announcements.length === 0) {
                setLoadingAnnouncements(true)
                fetch('/api/announcements').then((r) => r.json()).then((data) => { if (Array.isArray(data)) setAnnouncements(data) }).catch(() => {}).finally(() => setLoadingAnnouncements(false))
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'announcements'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            📢 ประกาศ (HR)
          </button>
          <button
            onClick={() => {
              setActiveTab('tcg-rewards')
              if (tcgGames.length === 0) {
                fetch('/api/tcg/games').then((r) => r.json()).then((data) => { if (Array.isArray(data)) setTcgGames(data) }).catch(() => {})
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'tcg-rewards'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            🎁 TCG รางวัล
          </button>
          <button
            onClick={() => {
              setActiveTab('tcg-members')
              setTcgMembersLoading(true)
              fetch('/api/tcg/members?branch=gap7card')
                .then(r => r.json())
                .then(data => { if (Array.isArray(data)) setTcgMembers(data) })
                .catch(() => {})
                .finally(() => setTcgMembersLoading(false))
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'tcg-members'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            👥 TCG สมาชิก
          </button>
          <button
            onClick={() => setActiveTab('tcg-bookings')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'tcg-bookings'
                ? 'bg-white text-[#1E3A5F]'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            📅 จองเวลา TCG
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
                              onClick={() => { setEditStatusModal(req.id); setEditStatusValue(req.status); setEditStatusReason(req.rejected_reason || '') }}
                              className="border border-[#E2E8F0] text-[#1E3A5F] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-[#F5F6F8]"
                            >
                              แก้ไข
                            </button>
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

          {/* Edit status modal */}
          {editStatusModal && (
            <div
              className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
              onClick={(e) => { if (e.target === e.currentTarget) { setEditStatusModal(null) } }}
            >
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h2 className="font-bold text-[#1E3A5F] text-base">แก้ไขสถานะคำขอ</h2>
                <select
                  value={editStatusValue}
                  onChange={(e) => setEditStatusValue(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                >
                  <option value="pending">🟡 รอดำเนินการ</option>
                  <option value="approved">✅ อนุมัติแล้ว</option>
                  <option value="rejected">❌ ไม่อนุมัติ</option>
                </select>
                {editStatusValue === 'rejected' && (
                  <select
                    value={editStatusReason}
                    onChange={(e) => setEditStatusReason(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                  >
                    <option value="">— เลือกเหตุผล —</option>
                    <option value="ต้นทุนสูง">ต้นทุนสูง</option>
                    <option value="รุ่นใหม่กว่ากำลังออก">รุ่นใหม่กว่ากำลังออก</option>
                    <option value="รอราคาลงค่อยสั่ง">รอราคาลงค่อยสั่ง</option>
                  </select>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditStatusModal(null); setEditStatusValue(''); setEditStatusReason('') }}
                    className="flex-1 border border-[#E2E8F0] text-gray-500 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F5F6F8]"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleEditStatus(editStatusModal, editStatusValue, editStatusReason)}
                    disabled={editStatusValue === 'rejected' && !editStatusReason.trim()}
                    className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#163058] disabled:opacity-50"
                  >
                    บันทึก
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#1E3A5F]">
              สรุปวันนี้ — {formatDate(today)}
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={kpiAnalysisDate}
                onChange={(e) => { const d = e.target.value; setKpiAnalysisDate(d); setKpiOverviewAnalysis(null); loadCachedAnalysis(d) }}
                className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#1E3A5F]"
              />
              <button
                onClick={handleAnalyzeKpiOverview}
                disabled={analyzingKpiOverview || !kpiAnalysisDate}
                className="text-xs text-[#1E3A5F] border border-[#E2E8F0] rounded-lg px-3 py-1.5 hover:bg-[#F5F6F8] disabled:opacity-40 whitespace-nowrap"
              >
                {analyzingKpiOverview ? '⏳ กำลังวิเคราะห์...' : '🤖 AI วิเคราะห์รายวัน'}
              </button>
            </div>
          </div>

          {kpiOverviewAnalysis && (
            <div className="mt-4 space-y-3">
              <p className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider">🤖 AI วิเคราะห์ภาพรวมวันนี้</p>
              <p className="text-sm text-[#374151] leading-relaxed">{kpiOverviewAnalysis.overall}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#F0FDF4] border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-green-700 mb-1">แผนกที่โดดเด่น</p>
                  <p className="text-sm text-green-800">{kpiOverviewAnalysis.strong_depts || '—'}</p>
                </div>
                <div className="bg-[#FEF2F2] border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-700 mb-1">ประเด็นน่าเป็นห่วง</p>
                  <p className="text-sm text-red-800">{kpiOverviewAnalysis.concern_depts || '—'}</p>
                </div>
                <div className="bg-[#FFFBEB] border border-yellow-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-yellow-700 mb-1">อุปสรรคที่พบบ่อย</p>
                  <p className="text-sm text-yellow-800">{kpiOverviewAnalysis.common_obstacles || 'ไม่มี'}</p>
                </div>
                <div className="bg-[#EFF6FF] border border-blue-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-blue-700 mb-1">คำแนะนำผู้บริหาร</p>
                  <p className="text-sm text-blue-800">{kpiOverviewAnalysis.recommendation}</p>
                </div>
              </div>
              <button
                onClick={() => setKpiOverviewAnalysis(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕ ปิดผลวิเคราะห์
              </button>
            </div>
          )}

          <div className={`flex flex-wrap items-center gap-4 ${kpiOverviewAnalysis ? 'mt-4 pt-4 border-t border-[#E2E8F0]' : ''}`}>
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
                      {(() => {
                        const disburse = equipDisbursements.find((d) => d.equipment_id === r.id)
                        const statusMap: Record<string, { label: string; cls: string }> = {
                          approved: { label: 'บัญชีอนุมัติแล้ว', cls: 'bg-green-100 text-green-700' },
                          ordered: { label: 'สั่งซื้อแล้ว', cls: 'bg-blue-100 text-blue-700' },
                          payment_recorded: { label: 'บันทึกจ่ายแล้ว', cls: 'bg-indigo-100 text-indigo-700' },
                          monthly_closed: { label: 'ปิดงบเดือน', cls: 'bg-gray-100 text-gray-600' },
                        }
                        const s = disburse ? statusMap[disburse.status] : null
                        return (
                          <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${s ? s.cls : 'bg-red-50 text-[#DC2626]'}`}>
                            {s ? s.label : 'รอดำเนินการ'}
                          </span>
                        )
                      })()}
                    </div>
                    <p className="text-sm text-[#374151]">{r.description}</p>
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
        const nextMonth = (ym: string) => {
          const [y, mo] = ym.split('-').map(Number)
          const d = new Date(y, mo)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        }
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
                    {r.has_image === 1 && (
                      <img src={`/api/promo-threshold?image_id=${r.id}`} alt="สินค้า" className="w-full h-48 object-cover" />
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
                          onClick={() => setExtendModal({ promo: r, startMonth: nextMonth(r.start_month), endMonth: nextMonth(r.end_month) })}
                          className="flex-1 bg-[#1E3A5F]/10 text-[#1E3A5F] py-2 rounded-xl text-sm font-semibold hover:bg-[#1E3A5F]/20"
                        >
                          📅 ต่อโปร
                        </button>
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
          if (arrivalFilters.search) {
            const q = arrivalFilters.search.toLowerCase()
            const haystack = `${r.product_name} ${r.note ?? ''}`.toLowerCase()
            if (!haystack.includes(q)) return false
          }
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
                {(arrivalFilters.dateFrom || arrivalFilters.dateTo || arrivalFilters.search) && (
                  <button
                    onClick={() => setArrivalFilters({ dateFrom: '', dateTo: '', search: '' })}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    ล้าง
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="ค้นหาชื่อสินค้า..."
                value={arrivalFilters.search}
                onChange={(e) => setArrivalFilters((p) => ({ ...p, search: e.target.value }))}
                className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
              />
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
                        <th className="text-left px-4 py-3">Allocation</th>
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
                            <img
                              src={`/api/stock-arrival?image_id=${r.id}`}
                              alt="สินค้า"
                              loading="lazy"
                              onClick={() => setArrivalImageModal(`/api/stock-arrival?image_id=${r.id}`)}
                              className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 mx-auto"
                            />
                          </td>
                          <td className="px-4 py-3 min-w-[140px]">
                            <div className="flex flex-col items-start gap-1">
                              <input
                                type="text"
                                value={allocationEdits[r.id] ?? (r.allocation || '')}
                                onChange={(e) => {
                                  setAllocationEdits(prev => ({ ...prev, [r.id]: e.target.value }))
                                  setAllocationStatus(prev => ({ ...prev, [r.id]: 'idle' }))
                                }}
                                className="w-full border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#1E3A5F]"
                              />
                              {allocationStatus[r.id] === 'saved' ? (
                                <span className="text-[10px] text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>
                              ) : allocationStatus[r.id] === 'error' ? (
                                <span className="text-[10px] text-[#DC2626]">ผิดพลาด</span>
                              ) : (
                                <button
                                  onClick={async () => {
                                    const val = (allocationEdits[r.id] ?? (r.allocation || '')).trim()
                                    setAllocationStatus(prev => ({ ...prev, [r.id]: 'saving' }))
                                    try {
                                      const res = await fetch('/api/stock-arrival', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ id: r.id, action: 'update_allocation', allocation: val }),
                                      })
                                      if (!res.ok) throw new Error()
                                      setStockArrivals(prev => prev.map(x => x.id === r.id ? { ...x, allocation: val } : x))
                                      setAllocationStatus(prev => ({ ...prev, [r.id]: 'saved' }))
                                      setTimeout(() => setAllocationStatus(prev => ({ ...prev, [r.id]: 'idle' })), 2000)
                                    } catch {
                                      setAllocationStatus(prev => ({ ...prev, [r.id]: 'error' }))
                                      setTimeout(() => setAllocationStatus(prev => ({ ...prev, [r.id]: 'idle' })), 3000)
                                    }
                                  }}
                                  disabled={allocationStatus[r.id] === 'saving'}
                                  className="text-[10px] bg-[#1E3A5F] text-white px-2 py-0.5 rounded-lg disabled:opacity-50 whitespace-nowrap"
                                >
                                  {allocationStatus[r.id] === 'saving' ? '...' : 'บันทึก'}
                                </button>
                              )}
                            </div>
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
                  const effectiveMult = pmMultiplier === 'custom' ? Number(pmCustomMultiplier) : Number(pmMultiplier)
                  if (pmMultiplier !== 'custom' || (pmCustomMultiplier && Number(pmCustomMultiplier) > 0)) {
                    boxPriceSystem = roundUp10(cost * effectiveMult)
                    calcReady = true
                  }
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
              const MULTIPLIERS: { key: string; label: string; value?: number }[] = [
                { key: '2.4', label: 'ทั่วไป', value: 2.4 },
                { key: '2.6', label: 'หายาก', value: 2.6 },
                { key: '2.8', label: 'หายากมาก', value: 2.8 },
                { key: '3', label: 'สั่งไม่ได้อีก', value: 3 },
                { key: 'custom', label: 'อื่นๆ' },
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
                                  {m.value != null && <span className="text-xs text-gray-400">× {m.value}</span>}
                                  {m.key === 'custom' && pmMultiplier === 'custom' ? (
                                    <input type="number" value={pmCustomMultiplier} onChange={(e) => setPmCustomMultiplier(e.target.value)}
                                      placeholder="เช่น 2, 4, 5" step="0.1" min="0.1"
                                      className="ml-auto border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                                      onClick={(e) => e.stopPropagation()} />
                                  ) : (
                                    m.value != null && cost > 0 && <span className="ml-auto text-sm font-bold text-[#1E3A5F]">{(cost * m.value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ฿</span>
                                  )}
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
                                <button type="button" onClick={() => { setPmBoxSystemEnabled(true); setPmBoxNoExternal(false) }}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${pmBoxSystemEnabled && !pmBoxNoExternal ? 'bg-[#16A34A] text-white border-[#16A34A]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  ลงระบบ
                                </button>
                                <button type="button" onClick={() => { setPmBoxSystemEnabled(false); setPmBoxNoExternal(false) }}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${!pmBoxSystemEnabled ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  ไม่ลงระบบ
                                </button>
                                <button type="button" onClick={() => { setPmBoxSystemEnabled(true); setPmBoxNoExternal(true) }}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${pmBoxNoExternal ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  ลงระบบไม่ยน.
                                </button>
                              </div>
                            </div>
                            {!pmBoxNoExternal && (
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <p className="text-xs text-gray-400 mb-1">ยกกล่อง (โยนนอก)</p>
                              <p className="text-base font-bold text-[#374151]">{fmt(boxPriceExternal)}</p>
                              <p className="text-xs text-gray-400">บาท</p>
                              {pmMultiplier !== 'old' && oldPricing?.box_price_external && (
                                <p className="text-xs text-gray-400 mt-1 pt-1 border-t border-[#E2E8F0]">เดิม: {oldPricing.box_price_external} บาท</p>
                              )}
                            </div>
                            )}
                            <div className="bg-white rounded-lg p-3 shadow-sm">
                              <p className="text-xs text-gray-400 mb-1">แยกซอง (ในระบบ){pmRisk > 0 ? ` +${pmRisk}฿` : ''}</p>
                              <p className="text-base font-bold text-[#16A34A]">{fmt(packPriceSystem)}</p>
                              <p className="text-xs text-gray-400">บาท/ซอง</p>
                              {pmMultiplier !== 'old' && oldPricing?.pack_price_system && (
                                <p className="text-xs text-gray-400 mt-1 pt-1 border-t border-[#E2E8F0]">เดิม: {oldPricing.pack_price_system} บาท</p>
                              )}
                              <div className="flex gap-1 mt-2">
                                <button type="button" onClick={() => { setPmBreakEnabled(false); setPmNoPackSale(false) }}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${!pmBreakEnabled && !pmNoPackSale ? 'bg-[#374151] text-white border-[#374151]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  break ได้ปกติ
                                </button>
                                <button type="button" onClick={() => { setPmBreakEnabled(true); setPmNoPackSale(false) }}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${pmBreakEnabled ? 'bg-[#D97706] text-white border-[#D97706]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  เปิด break เท่านั้น
                                </button>
                                <button type="button" onClick={() => { setPmNoPackSale(true); setPmBreakEnabled(false) }}
                                  className={`flex-1 text-[10px] py-0.5 rounded border font-semibold transition-colors ${pmNoPackSale ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white text-gray-400 border-[#E2E8F0]'}`}>
                                  ไม่ขายแยกซอง
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
              <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
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
              </table></div>
            )}
          </div>

        </div>
      )}

      {/* ปรับตำแหน่ง Tab */}
      {activeTab === 'adjust-rank' && !rankUnlocked && (
        <div className="max-w-sm mx-auto px-4 py-16 flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-[#1E3A5F] rounded-2xl flex items-center justify-center text-2xl">🔒</div>
          <p className="font-bold text-[#1E3A5F] text-lg">กรอกรหัสเพื่อปรับตำแหน่ง</p>
          <input
            type="password"
            value={rankCodeInput}
            onChange={(e) => { setRankCodeInput(e.target.value); setRankCodeError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlockRank()}
            placeholder="รหัสผ่าน"
            className="w-full border border-[#E2E8F0] rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:border-[#1E3A5F]"
          />
          {rankCodeError && <p className="text-xs text-[#DC2626]">{rankCodeError}</p>}
          <button
            onClick={handleUnlockRank}
            className="w-full bg-[#1E3A5F] text-white rounded-xl py-3 font-semibold text-sm hover:bg-[#16305A] transition-colors"
          >
            ยืนยัน
          </button>
        </div>
      )}
      {activeTab === 'adjust-rank' && rankUnlocked && (
        <div className="max-w-6xl mx-auto px-4 pb-10 space-y-4">
          <div className="flex justify-end pt-4">
            <button onClick={handleLockRank} className="text-xs text-gray-400 hover:text-[#DC2626] transition-colors">
              🔒 ล็อคอีกครั้ง
            </button>
          </div>
          {/* Department toggle */}
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-2">
              {(['ไลฟ์สด', 'Creative', 'การตลาด', 'Sales Admin', 'Store Retail', 'สต๊อค&จัดซื้อ', 'แพค', 'บัญชี&การเงิน', 'ธุรการ', 'บุคคล', 'ผู้จัดการไลฟ์สด', 'ผู้จัดการหน้าร้าน'] as const).map((dept) => (
                <button
                  key={dept}
                  onClick={() => setAdjustRankDept(dept)}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    adjustRankDept === dept
                      ? 'bg-[#1E3A5F] text-white'
                      : 'bg-white text-[#374151] border border-[#E2E8F0] hover:border-[#1E3A5F]'
                  }`}
                >
                  {dept === 'ไลฟ์สด' ? 'Sales ไลฟ์สด' : dept}
                </button>
              ))}
            </div>
          </div>

          {/* ไลฟ์สด section */}
          {adjustRankDept === 'ไลฟ์สด' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศไลฟ์สด</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงานไลฟ์แต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {liveStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setLiveStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newStaffName}
                    onChange={(e) => { setNewStaffName(e.target.value); setAddStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newStaffRank}
                    onChange={(e) => setNewStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Junior Live Sales|🥉">🥉 Junior Live Sales</option>
                    <option value="2|Live Sales|🥈">🥈 Live Sales</option>
                    <option value="3|Senior Live Sales|🥇">🥇 Senior Live Sales</option>
                    <option value="4|Expert Live Sales|🏅">🏅 Expert Live Sales</option>
                    <option value="5|Master Live Sales|🏆">🏆 Master Live Sales</option>
                    <option value="6|Elite Live Sales|💠">💠 Elite Live Sales</option>
                    <option value="7|Legend Live Sales|💎">💎 Legend Live Sales</option>
                    <option value="8|Grandmaster Live Sales|👑">👑 Grandmaster Live Sales</option>
                  </select>
                  <button
                    disabled={addingStaff || !newStaffName.trim()}
                    onClick={async () => {
                      const parts = newStaffRank.split('|')
                      setAddingStaff(true)
                      setAddStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'ไลฟ์สด' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setLiveStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewStaffName('')
                        } else {
                          setAddStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addStaffError}</p>}
              </div>
              {loadingLiveStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : liveStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setLiveStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setRankSavedId(s.id)
                                  setTimeout(() => setRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Junior Live Sales|🥉">🥉 Junior Live Sales</option>
                            <option value="2|Live Sales|🥈">🥈 Live Sales</option>
                            <option value="3|Senior Live Sales|🥇">🥇 Senior Live Sales</option>
                            <option value="4|Expert Live Sales|🏅">🏅 Expert Live Sales</option>
                            <option value="5|Master Live Sales|🏆">🏆 Master Live Sales</option>
                            <option value="6|Elite Live Sales|💠">💠 Elite Live Sales</option>
                            <option value="7|Legend Live Sales|💎">💎 Legend Live Sales</option>
                            <option value="8|Grandmaster Live Sales|👑">👑 Grandmaster Live Sales</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setLiveStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {rankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setLiveStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* Stock & Purchasing section */}
          {adjustRankDept === 'สต๊อค&จัดซื้อ' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ สต๊อค&amp;จัดซื้อ</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงานสต๊อค&amp;จัดซื้อแต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {stockPurchasingStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setStockPurchasingStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newStockPurchasingStaffName}
                    onChange={(e) => { setNewStockPurchasingStaffName(e.target.value); setAddStockPurchasingStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newStockPurchasingStaffRank}
                    onChange={(e) => setNewStockPurchasingStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Junior Stock & Purchasing|🥉">🥉 Junior Stock &amp; Purchasing</option>
                    <option value="2|Stock & Purchasing|🥈">🥈 Stock &amp; Purchasing</option>
                    <option value="3|Senior Stock & Purchasing|🥇">🥇 Senior Stock &amp; Purchasing</option>
                    <option value="4|Expert Stock & Purchasing|🏅">🏅 Expert Stock &amp; Purchasing</option>
                    <option value="5|Master Stock & Purchasing|🏆">🏆 Master Stock &amp; Purchasing</option>
                    <option value="6|Elite Stock & Purchasing|💠">💠 Elite Stock &amp; Purchasing</option>
                    <option value="7|Legend Stock & Purchasing|💎">💎 Legend Stock &amp; Purchasing</option>
                    <option value="8|Grandmaster Stock & Purchasing|👑">👑 Grandmaster Stock &amp; Purchasing</option>
                  </select>
                  <button
                    disabled={addingStockPurchasingStaff || !newStockPurchasingStaffName.trim()}
                    onClick={async () => {
                      const parts = newStockPurchasingStaffRank.split('|')
                      setAddingStockPurchasingStaff(true)
                      setAddStockPurchasingStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newStockPurchasingStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'สต๊อค&จัดซื้อ' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setStockPurchasingStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewStockPurchasingStaffName('')
                        } else {
                          setAddStockPurchasingStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddStockPurchasingStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingStockPurchasingStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingStockPurchasingStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addStockPurchasingStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addStockPurchasingStaffError}</p>}
              </div>
              {loadingStockPurchasingStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : stockPurchasingStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockPurchasingStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingStockPurchasingRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingStockPurchasingRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setStockPurchasingStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setStockPurchasingRankSavedId(s.id)
                                  setTimeout(() => setStockPurchasingRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingStockPurchasingRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Junior Stock & Purchasing|🥉">🥉 Junior Stock &amp; Purchasing</option>
                            <option value="2|Stock & Purchasing|🥈">🥈 Stock &amp; Purchasing</option>
                            <option value="3|Senior Stock & Purchasing|🥇">🥇 Senior Stock &amp; Purchasing</option>
                            <option value="4|Expert Stock & Purchasing|🏅">🏅 Expert Stock &amp; Purchasing</option>
                            <option value="5|Master Stock & Purchasing|🏆">🏆 Master Stock &amp; Purchasing</option>
                            <option value="6|Elite Stock & Purchasing|💠">💠 Elite Stock &amp; Purchasing</option>
                            <option value="7|Legend Stock & Purchasing|💎">💎 Legend Stock &amp; Purchasing</option>
                            <option value="8|Grandmaster Stock & Purchasing|👑">👑 Grandmaster Stock &amp; Purchasing</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setStockPurchasingStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingStockPurchasingRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {stockPurchasingRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setStockPurchasingStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* แพค section */}
          {adjustRankDept === 'แพค' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ แพค</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงานแพคแต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {packStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setPackStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newPackStaffName}
                    onChange={(e) => { setNewPackStaffName(e.target.value); setAddPackStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newPackStaffRank}
                    onChange={(e) => setNewPackStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Junior Fulfillment|🥉">🥉 Junior Fulfillment</option>
                    <option value="2|Fulfillment|🥈">🥈 Fulfillment</option>
                    <option value="3|Senior Fulfillment|🥇">🥇 Senior Fulfillment</option>
                    <option value="4|Expert Fulfillment|🏅">🏅 Expert Fulfillment</option>
                    <option value="5|Master Fulfillment|🏆">🏆 Master Fulfillment</option>
                    <option value="6|Elite Fulfillment|💠">💠 Elite Fulfillment</option>
                    <option value="7|Legend Fulfillment|💎">💎 Legend Fulfillment</option>
                    <option value="8|Grandmaster Fulfillment|👑">👑 Grandmaster Fulfillment</option>
                  </select>
                  <button
                    disabled={addingPackStaff || !newPackStaffName.trim()}
                    onClick={async () => {
                      const parts = newPackStaffRank.split('|')
                      setAddingPackStaff(true)
                      setAddPackStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newPackStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'แพค' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setPackStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewPackStaffName('')
                        } else {
                          setAddPackStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddPackStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingPackStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingPackStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addPackStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addPackStaffError}</p>}
              </div>
              {loadingPackStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : packStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {packStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingPackRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingPackRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setPackStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setPackRankSavedId(s.id)
                                  setTimeout(() => setPackRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingPackRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Junior Fulfillment|🥉">🥉 Junior Fulfillment</option>
                            <option value="2|Fulfillment|🥈">🥈 Fulfillment</option>
                            <option value="3|Senior Fulfillment|🥇">🥇 Senior Fulfillment</option>
                            <option value="4|Expert Fulfillment|🏅">🏅 Expert Fulfillment</option>
                            <option value="5|Master Fulfillment|🏆">🏆 Master Fulfillment</option>
                            <option value="6|Elite Fulfillment|💠">💠 Elite Fulfillment</option>
                            <option value="7|Legend Fulfillment|💎">💎 Legend Fulfillment</option>
                            <option value="8|Grandmaster Fulfillment|👑">👑 Grandmaster Fulfillment</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setPackStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingPackRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {packRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setPackStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* บัญชี&การเงิน section */}
          {adjustRankDept === 'บัญชี&การเงิน' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ บัญชี&amp;การเงิน</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงานบัญชี&amp;การเงินแต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {accountingStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setAccountingStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newAccountingStaffName}
                    onChange={(e) => { setNewAccountingStaffName(e.target.value); setAddAccountingStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newAccountingStaffRank}
                    onChange={(e) => setNewAccountingStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Accounting Lead|🗂️">🗂️ Accounting Lead</option>
                    <option value="2|Accounting Supervisor|📋">📋 Accounting Supervisor</option>
                    <option value="3|Accounting Manager|📊">📊 Accounting Manager</option>
                    <option value="4|Finance Manager|🏢">🏢 Finance Manager</option>
                    <option value="5|Finance Director|🌐">🌐 Finance Director</option>
                  </select>
                  <button
                    disabled={addingAccountingStaff || !newAccountingStaffName.trim()}
                    onClick={async () => {
                      const parts = newAccountingStaffRank.split('|')
                      setAddingAccountingStaff(true)
                      setAddAccountingStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newAccountingStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'บัญชี&การเงิน' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setAccountingStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewAccountingStaffName('')
                        } else {
                          setAddAccountingStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddAccountingStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingAccountingStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingAccountingStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addAccountingStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addAccountingStaffError}</p>}
              </div>
              {loadingAccountingStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : accountingStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountingStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingAccountingRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingAccountingRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setAccountingStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setAccountingRankSavedId(s.id)
                                  setTimeout(() => setAccountingRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingAccountingRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Accounting Lead|🗂️">🗂️ Accounting Lead</option>
                            <option value="2|Accounting Supervisor|📋">📋 Accounting Supervisor</option>
                            <option value="3|Accounting Manager|📊">📊 Accounting Manager</option>
                            <option value="4|Finance Manager|🏢">🏢 Finance Manager</option>
                            <option value="5|Finance Director|🌐">🌐 Finance Director</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setAccountingStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingAccountingRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {accountingRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setAccountingStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* ธุรการ section */}
          {adjustRankDept === 'ธุรการ' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ ธุรการ</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงานธุรการแต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {administrationStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setAdministrationStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newAdministrationStaffName}
                    onChange={(e) => { setNewAdministrationStaffName(e.target.value); setAddAdministrationStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newAdministrationStaffRank}
                    onChange={(e) => setNewAdministrationStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Administration Officer|🗂️">🗂️ Administration Officer</option>
                    <option value="2|Senior Administration Officer|📋">📋 Senior Administration Officer</option>
                    <option value="3|Administration Supervisor|📊">📊 Administration Supervisor</option>
                    <option value="4|Administration Manager|🏢">🏢 Administration Manager</option>
                    <option value="5|Senior Administration Manager|🌐">🌐 Senior Administration Manager</option>
                    <option value="6|Administration Director|🏛️">🏛️ Administration Director</option>
                  </select>
                  <button
                    disabled={addingAdministrationStaff || !newAdministrationStaffName.trim()}
                    onClick={async () => {
                      const parts = newAdministrationStaffRank.split('|')
                      setAddingAdministrationStaff(true)
                      setAddAdministrationStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newAdministrationStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'ธุรการ' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setAdministrationStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewAdministrationStaffName('')
                        } else {
                          setAddAdministrationStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddAdministrationStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingAdministrationStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingAdministrationStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addAdministrationStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addAdministrationStaffError}</p>}
              </div>
              {loadingAdministrationStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : administrationStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {administrationStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingAdministrationRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingAdministrationRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setAdministrationStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setAdministrationRankSavedId(s.id)
                                  setTimeout(() => setAdministrationRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingAdministrationRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Administration Officer|🗂️">🗂️ Administration Officer</option>
                            <option value="2|Senior Administration Officer|📋">📋 Senior Administration Officer</option>
                            <option value="3|Administration Supervisor|📊">📊 Administration Supervisor</option>
                            <option value="4|Administration Manager|🏢">🏢 Administration Manager</option>
                            <option value="5|Senior Administration Manager|🌐">🌐 Senior Administration Manager</option>
                            <option value="6|Administration Director|🏛️">🏛️ Administration Director</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setAdministrationStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingAdministrationRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {administrationRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setAdministrationStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* บุคคล section */}
          {adjustRankDept === 'บุคคล' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ บุคคล (HR)</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงาน HR แต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {hrStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setHrStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newHrStaffName}
                    onChange={(e) => { setNewHrStaffName(e.target.value); setAddHrStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newHrStaffRank}
                    onChange={(e) => setNewHrStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|HR Lead|👔">👔 HR Lead</option>
                    <option value="2|HR Supervisor|🧑‍💼">🧑‍💼 HR Supervisor</option>
                    <option value="3|HR Manager|👨‍💼">👨‍💼 HR Manager</option>
                    <option value="4|Senior HR Manager|💼">💼 Senior HR Manager</option>
                    <option value="5|HR Director|👑">👑 HR Director</option>
                  </select>
                  <button
                    disabled={addingHrStaff || !newHrStaffName.trim()}
                    onClick={async () => {
                      const parts = newHrStaffRank.split('|')
                      setAddingHrStaff(true)
                      setAddHrStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newHrStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'บุคคล' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setHrStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewHrStaffName('')
                        } else {
                          setAddHrStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddHrStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingHrStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingHrStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addHrStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addHrStaffError}</p>}
              </div>
              {loadingHrStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : hrStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {hrStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingHrRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingHrRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setHrStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setHrRankSavedId(s.id)
                                  setTimeout(() => setHrRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingHrRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|HR Lead|👔">👔 HR Lead</option>
                            <option value="2|HR Supervisor|🧑‍💼">🧑‍💼 HR Supervisor</option>
                            <option value="3|HR Manager|👨‍💼">👨‍💼 HR Manager</option>
                            <option value="4|Senior HR Manager|💼">💼 Senior HR Manager</option>
                            <option value="5|HR Director|👑">👑 HR Director</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setHrStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingHrRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {hrRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setHrStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* ผู้จัดการไลฟ์สด section */}
          {adjustRankDept === 'ผู้จัดการไลฟ์สด' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ ผู้จัดการไลฟ์สด</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศผู้จัดการไลฟ์สดแต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {liveManagerStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setLiveManagerStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newLiveManagerStaffName}
                    onChange={(e) => { setNewLiveManagerStaffName(e.target.value); setAddLiveManagerStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newLiveManagerStaffRank}
                    onChange={(e) => setNewLiveManagerStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Live Team Leader|👥">👥 Live Team Leader</option>
                    <option value="2|Live Supervisor|🗂️">🗂️ Live Supervisor</option>
                    <option value="3|Assistant Live Manager|📋">📋 Assistant Live Manager</option>
                    <option value="4|Live Manager|📊">📊 Live Manager</option>
                    <option value="5|Senior Live Manager|🏢">🏢 Senior Live Manager</option>
                    <option value="6|Head of Live|🌐">🌐 Head of Live</option>
                    <option value="7|Director of Live Commerce|🏛️">🏛️ Director of Live Commerce</option>
                  </select>
                  <button
                    disabled={addingLiveManagerStaff || !newLiveManagerStaffName.trim()}
                    onClick={async () => {
                      const parts = newLiveManagerStaffRank.split('|')
                      setAddingLiveManagerStaff(true)
                      setAddLiveManagerStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newLiveManagerStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'ผู้จัดการไลฟ์สด' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setLiveManagerStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewLiveManagerStaffName('')
                        } else {
                          setAddLiveManagerStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddLiveManagerStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingLiveManagerStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingLiveManagerStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addLiveManagerStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addLiveManagerStaffError}</p>}
              </div>
              {loadingLiveManagerStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : liveManagerStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveManagerStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingLiveManagerRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingLiveManagerRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setLiveManagerStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setLiveManagerRankSavedId(s.id)
                                  setTimeout(() => setLiveManagerRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingLiveManagerRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Live Team Leader|👥">👥 Live Team Leader</option>
                            <option value="2|Live Supervisor|🗂️">🗂️ Live Supervisor</option>
                            <option value="3|Assistant Live Manager|📋">📋 Assistant Live Manager</option>
                            <option value="4|Live Manager|📊">📊 Live Manager</option>
                            <option value="5|Senior Live Manager|🏢">🏢 Senior Live Manager</option>
                            <option value="6|Head of Live|🌐">🌐 Head of Live</option>
                            <option value="7|Director of Live Commerce|🏛️">🏛️ Director of Live Commerce</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setLiveManagerStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingLiveManagerRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {liveManagerRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setLiveManagerStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {adjustRankDept === 'ผู้จัดการหน้าร้าน' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ ผู้จัดการหน้าร้าน</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศผู้จัดการหน้าร้านแต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {storeManagerStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setStoreManagerStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newStoreManagerStaffName}
                    onChange={(e) => { setNewStoreManagerStaffName(e.target.value); setAddStoreManagerStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newStoreManagerStaffRank}
                    onChange={(e) => setNewStoreManagerStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Junior Store Manager|🥉">🥉 Junior Store Manager</option>
                    <option value="2|Store Manager|🥈">🥈 Store Manager</option>
                    <option value="3|Senior Store Manager|🥇">🥇 Senior Store Manager</option>
                    <option value="4|Expert Store Manager|🏅">🏅 Expert Store Manager</option>
                    <option value="5|Master Store Manager|🏆">🏆 Master Store Manager</option>
                    <option value="6|Elite Store Manager|💠">💠 Elite Store Manager</option>
                    <option value="7|Legend Store Manager|💎">💎 Legend Store Manager</option>
                    <option value="8|Grandmaster Store Manager|👑">👑 Grandmaster Store Manager</option>
                  </select>
                  <button
                    disabled={addingStoreManagerStaff || !newStoreManagerStaffName.trim()}
                    onClick={async () => {
                      const parts = newStoreManagerStaffRank.split('|')
                      setAddingStoreManagerStaff(true)
                      setAddStoreManagerStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newStoreManagerStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'ผู้จัดการหน้าร้าน' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setStoreManagerStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewStoreManagerStaffName('')
                        } else {
                          setAddStoreManagerStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddStoreManagerStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingStoreManagerStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingStoreManagerStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addStoreManagerStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addStoreManagerStaffError}</p>}
              </div>
              {loadingStoreManagerStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : storeManagerStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeManagerStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingStoreManagerRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingStoreManagerRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setStoreManagerStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setStoreManagerRankSavedId(s.id)
                                  setTimeout(() => setStoreManagerRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingStoreManagerRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Junior Store Manager|🥉">🥉 Junior Store Manager</option>
                            <option value="2|Store Manager|🥈">🥈 Store Manager</option>
                            <option value="3|Senior Store Manager|🥇">🥇 Senior Store Manager</option>
                            <option value="4|Expert Store Manager|🏅">🏅 Expert Store Manager</option>
                            <option value="5|Master Store Manager|🏆">🏆 Master Store Manager</option>
                            <option value="6|Elite Store Manager|💠">💠 Elite Store Manager</option>
                            <option value="7|Legend Store Manager|💎">💎 Legend Store Manager</option>
                            <option value="8|Grandmaster Store Manager|👑">👑 Grandmaster Store Manager</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setStoreManagerStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingStoreManagerRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {storeManagerRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setStoreManagerStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* Store Retail section */}
          {adjustRankDept === 'Store Retail' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ Store Retail</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงาน Store Retail แต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {storeRetailStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setStoreRetailStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newStoreRetailStaffName}
                    onChange={(e) => { setNewStoreRetailStaffName(e.target.value); setAddStoreRetailStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newStoreRetailStaffRank}
                    onChange={(e) => setNewStoreRetailStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Junior Store Retail|🥉">🥉 Junior Store Retail</option>
                    <option value="2|Store Retail|🥈">🥈 Store Retail</option>
                    <option value="3|Senior Store Retail|🥇">🥇 Senior Store Retail</option>
                    <option value="4|Expert Store Retail|🏅">🏅 Expert Store Retail</option>
                    <option value="5|Master Store Retail|🏆">🏆 Master Store Retail</option>
                    <option value="6|Elite Store Retail|💠">💠 Elite Store Retail</option>
                    <option value="7|Legend Store Retail|💎">💎 Legend Store Retail</option>
                    <option value="8|Grandmaster Store Retail|👑">👑 Grandmaster Store Retail</option>
                  </select>
                  <button
                    disabled={addingStoreRetailStaff || !newStoreRetailStaffName.trim()}
                    onClick={async () => {
                      const parts = newStoreRetailStaffRank.split('|')
                      setAddingStoreRetailStaff(true)
                      setAddStoreRetailStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newStoreRetailStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'Store Retail' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setStoreRetailStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewStoreRetailStaffName('')
                        } else {
                          setAddStoreRetailStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddStoreRetailStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingStoreRetailStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingStoreRetailStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addStoreRetailStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addStoreRetailStaffError}</p>}
              </div>
              {loadingStoreRetailStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : storeRetailStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeRetailStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingStoreRetailRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingStoreRetailRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setStoreRetailStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setStoreRetailRankSavedId(s.id)
                                  setTimeout(() => setStoreRetailRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingStoreRetailRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Junior Store Retail|🥉">🥉 Junior Store Retail</option>
                            <option value="2|Store Retail|🥈">🥈 Store Retail</option>
                            <option value="3|Senior Store Retail|🥇">🥇 Senior Store Retail</option>
                            <option value="4|Expert Store Retail|🏅">🏅 Expert Store Retail</option>
                            <option value="5|Master Store Retail|🏆">🏆 Master Store Retail</option>
                            <option value="6|Elite Store Retail|💠">💠 Elite Store Retail</option>
                            <option value="7|Legend Store Retail|💎">💎 Legend Store Retail</option>
                            <option value="8|Grandmaster Store Retail|👑">👑 Grandmaster Store Retail</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setStoreRetailStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingStoreRetailRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {storeRetailRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setStoreRetailStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* Sale Admin section */}
          {adjustRankDept === 'Sales Admin' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ Sale Admin</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงาน Sale Admin แต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {saleAdminStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setSaleAdminStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newSaleAdminStaffName}
                    onChange={(e) => { setNewSaleAdminStaffName(e.target.value); setAddSaleAdminStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newSaleAdminStaffRank}
                    onChange={(e) => setNewSaleAdminStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Junior Sales Admin|🥉">🥉 Junior Sales Admin</option>
                    <option value="2|Sales Admin|🥈">🥈 Sales Admin</option>
                    <option value="3|Senior Sales Admin|🥇">🥇 Senior Sales Admin</option>
                    <option value="4|Expert Sales Admin|🏅">🏅 Expert Sales Admin</option>
                    <option value="5|Master Sales Admin|🏆">🏆 Master Sales Admin</option>
                    <option value="6|Elite Sales Admin|💠">💠 Elite Sales Admin</option>
                    <option value="7|Legend Sales Admin|💎">💎 Legend Sales Admin</option>
                    <option value="8|Grandmaster Sales Admin|👑">👑 Grandmaster Sales Admin</option>
                  </select>
                  <button
                    disabled={addingSaleAdminStaff || !newSaleAdminStaffName.trim()}
                    onClick={async () => {
                      const parts = newSaleAdminStaffRank.split('|')
                      setAddingSaleAdminStaff(true)
                      setAddSaleAdminStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newSaleAdminStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'Sales Admin' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setSaleAdminStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewSaleAdminStaffName('')
                        } else {
                          setAddSaleAdminStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddSaleAdminStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingSaleAdminStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingSaleAdminStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addSaleAdminStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addSaleAdminStaffError}</p>}
              </div>
              {loadingSaleAdminStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : saleAdminStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleAdminStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingSaleAdminRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingSaleAdminRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setSaleAdminStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setSaleAdminRankSavedId(s.id)
                                  setTimeout(() => setSaleAdminRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingSaleAdminRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Junior Sales Admin|🥉">🥉 Junior Sales Admin</option>
                            <option value="2|Sales Admin|🥈">🥈 Sales Admin</option>
                            <option value="3|Senior Sales Admin|🥇">🥇 Senior Sales Admin</option>
                            <option value="4|Expert Sales Admin|🏅">🏅 Expert Sales Admin</option>
                            <option value="5|Master Sales Admin|🏆">🏆 Master Sales Admin</option>
                            <option value="6|Elite Sales Admin|💠">💠 Elite Sales Admin</option>
                            <option value="7|Legend Sales Admin|💎">💎 Legend Sales Admin</option>
                            <option value="8|Grandmaster Sales Admin|👑">👑 Grandmaster Sales Admin</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setSaleAdminStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingSaleAdminRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {saleAdminRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setSaleAdminStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* Marketing section */}
          {adjustRankDept === 'การตลาด' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ การตลาด</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงานการตลาดแต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {marketingStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setMarketingStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newMarketingStaffName}
                    onChange={(e) => { setNewMarketingStaffName(e.target.value); setAddMarketingStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newMarketingStaffRank}
                    onChange={(e) => setNewMarketingStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Junior Marketing|🥉">🥉 Junior Marketing</option>
                    <option value="2|Marketing|🥈">🥈 Marketing</option>
                    <option value="3|Senior Marketing|🥇">🥇 Senior Marketing</option>
                    <option value="4|Expert Marketing|🏅">🏅 Expert Marketing</option>
                    <option value="5|Master Marketing|🏆">🏆 Master Marketing</option>
                    <option value="6|Elite Marketing|💠">💠 Elite Marketing</option>
                    <option value="7|Legend Marketing|💎">💎 Legend Marketing</option>
                    <option value="8|Grandmaster Marketing|👑">👑 Grandmaster Marketing</option>
                  </select>
                  <button
                    disabled={addingMarketingStaff || !newMarketingStaffName.trim()}
                    onClick={async () => {
                      const parts = newMarketingStaffRank.split('|')
                      setAddingMarketingStaff(true)
                      setAddMarketingStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newMarketingStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'การตลาด' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setMarketingStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewMarketingStaffName('')
                        } else {
                          setAddMarketingStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddMarketingStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingMarketingStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingMarketingStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addMarketingStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addMarketingStaffError}</p>}
              </div>
              {loadingMarketingStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : marketingStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketingStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingMarketingRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingMarketingRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setMarketingStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setMarketingRankSavedId(s.id)
                                  setTimeout(() => setMarketingRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingMarketingRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Junior Marketing|🥉">🥉 Junior Marketing</option>
                            <option value="2|Marketing|🥈">🥈 Marketing</option>
                            <option value="3|Senior Marketing|🥇">🥇 Senior Marketing</option>
                            <option value="4|Expert Marketing|🏅">🏅 Expert Marketing</option>
                            <option value="5|Master Marketing|🏆">🏆 Master Marketing</option>
                            <option value="6|Elite Marketing|💠">💠 Elite Marketing</option>
                            <option value="7|Legend Marketing|💎">💎 Legend Marketing</option>
                            <option value="8|Grandmaster Marketing|👑">👑 Grandmaster Marketing</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setMarketingStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingMarketingRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {marketingRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setMarketingStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}

          {/* Creative section */}
          {adjustRankDept === 'Creative' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">จัดการยศ Creative</h2>
                <p className="text-xs text-gray-400 mt-0.5">เปลี่ยนยศพนักงาน Creative แต่ละคน — มีผลกับหน้ากรอก KPI ทันที</p>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/30">
                <p className="text-xs font-semibold text-[#374151] mb-2">⚜️ Head ของแผนก</p>
                <div className="flex flex-wrap gap-2">
                  {creativeStaff.map((s) => (
                    <button
                      key={s.id}
                      disabled={savingHeadId === s.id}
                      onClick={() => toggleHead(s, setCreativeStaff)}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50 ${
                        s.is_head
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {s.is_head ? `⚜️ ${s.name}` : s.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F5F6F8]/50">
                <p className="text-xs font-semibold text-[#374151] mb-2">เพิ่มพนักงานใหม่</p>
                <div className="flex gap-2 flex-wrap items-start">
                  <input
                    type="text"
                    placeholder="ชื่อเล่น"
                    value={newCreativeStaffName}
                    onChange={(e) => { setNewCreativeStaffName(e.target.value); setAddCreativeStaffError('') }}
                    className="border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white w-32 focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <select
                    value={newCreativeStaffRank}
                    onChange={(e) => setNewCreativeStaffRank(e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="1|Junior Creative|🥉">🥉 Junior Creative</option>
                    <option value="2|Creative|🥈">🥈 Creative</option>
                    <option value="3|Senior Creative|🥇">🥇 Senior Creative</option>
                    <option value="4|Expert Creative|🏅">🏅 Expert Creative</option>
                    <option value="5|Master Creative|🏆">🏆 Master Creative</option>
                    <option value="6|Elite Creative|💠">💠 Elite Creative</option>
                    <option value="7|Legend Creative|💎">💎 Legend Creative</option>
                    <option value="8|Grandmaster Creative|👑">👑 Grandmaster Creative</option>
                  </select>
                  <button
                    disabled={addingCreativeStaff || !newCreativeStaffName.trim()}
                    onClick={async () => {
                      const parts = newCreativeStaffRank.split('|')
                      setAddingCreativeStaff(true)
                      setAddCreativeStaffError('')
                      try {
                        const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: newCreativeStaffName.trim(), rank_order: Number(parts[0]), rank_name: parts[1], rank_emoji: parts[2], department: 'Creative' }),
                        })
                        const data = await res.json()
                        if (res.ok) {
                          setCreativeStaff((prev) => [...prev, data.staff].sort((a, b) => a.rank_order - b.rank_order || a.name.localeCompare(b.name, 'th')))
                          setNewCreativeStaffName('')
                        } else {
                          setAddCreativeStaffError(data.error || 'เพิ่มไม่สำเร็จ')
                        }
                      } catch { setAddCreativeStaffError('เกิดข้อผิดพลาด') }
                      finally { setAddingCreativeStaff(false) }
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {addingCreativeStaff ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
                {addCreativeStaffError && <p className="text-[#DC2626] text-xs mt-1.5">{addCreativeStaffError}</p>}
              </div>
              {loadingCreativeStaff ? (
                <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
              ) : creativeStaff.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm">ไม่มีข้อมูล</div>
              ) : (
                <div className="overflow-x-auto"><table className="min-w-[500px] text-sm">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-[#374151]">
                      <th className="text-left px-5 py-3 font-semibold">ชื่อ</th>
                      <th className="text-left px-5 py-3 font-semibold">ยศปัจจุบัน</th>
                      <th className="text-left px-5 py-3 font-semibold">เปลี่ยนยศ</th>
                      <th className="text-left px-5 py-3 font-semibold">Badge</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {creativeStaff.map((s, i) => (
                      <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/50'}>
                        <td className="px-5 py-3 font-semibold text-[#1E3A5F]">{s.is_head ? '⚜️ ' : ''}{s.name}</td>
                        <td className="px-5 py-3 text-sm text-[#374151]">{s.rank_emoji} {s.rank_name}</td>
                        <td className="px-5 py-3">
                          <select
                            value={`${s.rank_order}|${s.rank_name}|${s.rank_emoji}`}
                            disabled={savingCreativeRankId === s.id}
                            onChange={async (e) => {
                              const parts = e.target.value.split('|')
                              const newOrder = Number(parts[0])
                              const newName = parts[1]
                              const newEmoji = parts[2]
                              setSavingCreativeRankId(s.id)
                              try {
                                const res = await fetch(`/api/live-staff?key=${ADMIN_KEY}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ id: s.id, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder }),
                                })
                                if (res.ok) {
                                  setCreativeStaff((prev) =>
                                    prev.map((x) => x.id === s.id ? { ...x, rank_name: newName, rank_emoji: newEmoji, rank_order: newOrder } : x)
                                  )
                                  setCreativeRankSavedId(s.id)
                                  setTimeout(() => setCreativeRankSavedId((prev) => prev === s.id ? null : prev), 2000)
                                } else {
                                  alert('บันทึกไม่สำเร็จ')
                                }
                              } catch { alert('เกิดข้อผิดพลาด') }
                              finally { setSavingCreativeRankId(null) }
                            }}
                            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-60"
                          >
                            <option value="1|Junior Creative|🥉">🥉 Junior Creative</option>
                            <option value="2|Creative|🥈">🥈 Creative</option>
                            <option value="3|Senior Creative|🥇">🥇 Senior Creative</option>
                            <option value="4|Expert Creative|🏅">🏅 Expert Creative</option>
                            <option value="5|Master Creative|🏆">🏆 Master Creative</option>
                            <option value="6|Elite Creative|💠">💠 Elite Creative</option>
                            <option value="7|Legend Creative|💎">💎 Legend Creative</option>
                            <option value="8|Grandmaster Creative|👑">👑 Grandmaster Creative</option>
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() => setBadgeModal({ id: s.id, currentBadge: s.badge_emoji || '' })}
                            className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-base flex items-center justify-center hover:bg-[#F5F6F8] transition-colors"
                            title="ตั้ง Badge"
                          >{s.badge_emoji || '—'}</button>
                        </td>
                        <td className="px-5 py-3 text-right w-32">
                          <button
                            disabled={savingHeadId === s.id}
                            onClick={() => toggleHead(s, setCreativeStaff)}
                            title={s.is_head ? 'ถอด Head' : 'ตั้งเป็น Head'}
                            className={`text-lg mr-2 disabled:opacity-40 transition-opacity ${s.is_head ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                          >⚜️</button>
                          {savingCreativeRankId === s.id && <span className="text-xs text-gray-400">กำลังบันทึก...</span>}
                          {creativeRankSavedId === s.id && <span className="text-xs text-[#16A34A] font-semibold">✓ บันทึกแล้ว</span>}
                          <button
                            disabled={deletingStaffId === s.id}
                            onClick={() => deleteStaff(s, setCreativeStaff)}
                            title="ลบพนักงานนี้"
                            className="text-[#DC2626] text-sm opacity-100 transition-opacity disabled:opacity-20 ml-2"
                          >🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Badge emoji modal */}
      {badgeModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setBadgeModal(null)}>
          <div className="bg-white rounded-2xl p-5 w-64 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-[#1E3A5F]">🏅 ตั้ง Badge</p>
            <div className="flex flex-wrap gap-2">
              {BADGE_PRESETS.map((e) => (
                <button key={e} onClick={() => handleSetBadge(badgeModal.id, e)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center hover:bg-blue-50 ${badgeModal.currentBadge === e ? 'bg-blue-100 ring-2 ring-[#1E3A5F]' : 'border border-[#E2E8F0]'}`}
                >{e}</button>
              ))}
            </div>
            {badgeModal.currentBadge && (
              <button onClick={() => handleSetBadge(badgeModal.id, '')}
                className="w-full py-2 text-sm text-[#DC2626] hover:bg-red-50 rounded-xl border border-red-100 font-medium"
              >ลบ badge</button>
            )}
            <button onClick={() => setBadgeModal(null)}
              className="w-full py-2 text-sm text-[#374151] hover:bg-gray-50 rounded-xl border border-[#E2E8F0] font-medium"
            >ยกเลิก</button>
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
                    { k: 'live_hours', l: 'ชั่วโมงไลฟ์', u: 'ชม.' },
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

      {/* Pre-Order Tab */}
      {activeTab === 'preorder' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-[#F5F6F8] rounded-xl p-1 mb-4 w-fit">
            {(['products', 'orders'] as const).map((t) => (
              <button key={t} onClick={() => setPreorderSubTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${preorderSubTab === t ? 'bg-white text-[#1E3A5F] shadow-sm' : 'text-gray-500'}`}>
                {t === 'products' ? `สินค้า (${preorderProducts.length})` : `ออเดอร์ (${preorderOrders.filter((o) => o.status !== 'cancelled').length})`}
              </button>
            ))}
          </div>

          {loadingPreorder ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : preorderSubTab === 'products' ? (
            <div className="space-y-3">
              <button onClick={() => { setPreorderForm({ name: '', description: '', price: '', close_date: '', release_date: '', sku: '', max_qty: '0', image_data: '' }); setPreorderImages([]); setPreorderFileKey(0); setPreorderFormErrors({}); setPreorderSaveError('') }}
                className="w-full bg-[#1E3A5F] text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                + เพิ่มสินค้า Pre-Order
              </button>

              {preorderProducts.length === 0 && (
                <div className="bg-white rounded-2xl py-12 text-center text-gray-400 shadow-sm">
                  <p className="text-3xl mb-2">📦</p><p className="text-sm">ยังไม่มีสินค้า</p>
                </div>
              )}

              {preorderProducts.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[680px]">
                      <thead>
                        <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold">
                          <th className="text-left px-3 py-3 w-14">ภาพ</th>
                          <th className="text-left px-3 py-3">ชื่อสินค้า / SKU</th>
                          <th className="text-right px-3 py-3">ราคา</th>
                          <th className="text-center px-3 py-3">ปิดรับ</th>
                          <th className="text-center px-3 py-3">วางจำหน่าย</th>
                          <th className="text-center px-3 py-3">สั่งแล้ว</th>
                          <th className="text-center px-3 py-3">สถานะ</th>
                          <th className="text-center px-3 py-3">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preorderProducts.map((p, idx) => {
                          const orderedQty = preorderOrders.filter((o) => o.product_id === p.id && o.status !== 'cancelled').reduce((s, o) => s + o.quantity, 0)
                          return (
                            <tr key={p.id} className={`border-t border-[#E2E8F0] ${!p.is_active ? 'opacity-50' : ''} ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                              <td className="px-3 py-2.5 w-14">
                                {parsePreorderImages(p.image_data)[0]
                                  ? <img src={parsePreorderImages(p.image_data)[0].f} alt={p.name} className="w-11 h-11 object-cover rounded-xl" />
                                  : <div className="w-11 h-11 bg-[#F5F6F8] rounded-xl flex items-center justify-center text-lg">🛍️</div>
                                }
                              </td>
                              <td className="px-3 py-2.5 max-w-[200px]">
                                <p className="font-bold text-[#1E3A5F] text-sm leading-tight truncate">{p.name}</p>
                                {p.sku && <p className="text-xs font-mono text-[#1E3A5F]/50 mt-0.5 truncate">SKU: {p.sku}</p>}
                                {p.max_qty > 0 && <p className="text-xs text-gray-400 mt-0.5">จำกัด {p.max_qty} ชิ้น</p>}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-[#374151] whitespace-nowrap">
                                ฿{p.price.toLocaleString('th-TH')}
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs text-gray-500 whitespace-nowrap">
                                {new Date(p.close_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs text-gray-500 whitespace-nowrap">
                                {p.release_date ? new Date(p.release_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs font-semibold text-amber-600">
                                {orderedQty > 0 ? `${orderedQty} ชิ้น` : <span className="text-gray-300">-</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {p.is_active ? 'เปิด' : 'ปิด'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  <button onClick={() => { setPreorderForm({ id: p.id, name: p.name, description: p.description, price: String(p.price), close_date: p.close_date, release_date: p.release_date || '', sku: p.sku || '', max_qty: String(p.max_qty), image_data: p.image_data }); setPreorderImages(parsePreorderImages(p.image_data)); setPreorderFileKey(0); setPreorderFormErrors({}); setPreorderSaveError('') }}
                                    className="text-xs font-semibold text-[#1E3A5F] px-2.5 py-1 rounded-lg hover:bg-[#1E3A5F]/5 transition-colors">แก้ไข</button>
                                  <button onClick={async () => {
                                    await fetch(`/api/preorder-products/${p.id}?key=${ADMIN_KEY}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: p.is_active ? 0 : 1 }) })
                                    loadPreorderData()
                                  }} className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${p.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-[#16A34A] hover:bg-green-50'}`}>
                                    {p.is_active ? 'ปิดรับ' : 'เปิดรับ'}
                                  </button>
                                  <button onClick={async () => {
                                    if (!window.confirm(`ลบ "${p.name}" และออเดอร์ทั้งหมด?`)) return
                                    await fetch(`/api/preorder-products/${p.id}?key=${ADMIN_KEY}`, { method: 'DELETE' })
                                    loadPreorderData()
                                  }} className="text-xs font-semibold text-[#DC2626] px-2.5 py-1 rounded-lg hover:bg-[#DC2626]/5 transition-colors">ลบ</button>
                                </div>
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
          ) : (
            <div className="space-y-3">
              {/* สรุปออเดอร์ */}
              {preorderProducts.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-[#374151] mb-2">สรุปออเดอร์รวม</p>
                  <div className="space-y-1">
                    {preorderProducts.map((p) => {
                      const qty = preorderOrders.filter((o) => o.product_id === p.id && o.status !== 'cancelled').reduce((s, o) => s + o.quantity, 0)
                      if (qty === 0) return null
                      return (
                        <div key={p.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">{p.name}</span>
                          <span className="font-bold text-[#1E3A5F]">{qty} ชิ้น</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Filter */}
              <select value={preorderFilterPid} onChange={(e) => setPreorderFilterPid(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-[#1E3A5F]">
                <option value="">ทุกสินค้า</option>
                {preorderProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              {preorderOrders.filter((o) => !preorderFilterPid || o.product_id === preorderFilterPid).length === 0 ? (
                <div className="bg-white rounded-2xl py-12 text-center text-gray-400 shadow-sm">
                  <p className="text-3xl mb-2">📋</p><p className="text-sm">ยังไม่มีออเดอร์</p>
                </div>
              ) : (
                preorderOrders
                  .filter((o) => !preorderFilterPid || o.product_id === preorderFilterPid)
                  .map((o) => (
                    <div key={o.id} className={`bg-white rounded-2xl p-4 shadow-sm ${o.status === 'cancelled' ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-[#1E3A5F]">{o.nickname}</p>
                          <p className="text-xs text-gray-400">{preorderProducts.find((p) => p.id === o.product_id)?.name || o.product_id}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-[#1E3A5F]">{o.quantity} ชิ้น</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${o.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : o.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            {o.status === 'cancelled' ? 'ยกเลิก' : o.status === 'confirmed' ? 'ยืนยัน' : 'รอดำเนินการ'}
                          </span>
                        </div>
                      </div>
                      {(o.phone || o.note) && (
                        <div className="mt-2 pt-2 border-t border-[#E2E8F0] text-xs text-gray-500 space-y-0.5">
                          {o.phone && <p>📞 {o.phone}</p>}
                          {o.note && <p>📝 {o.note}</p>}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(o.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))
              )}
            </div>
          )}

          {/* Modal เพิ่ม/แก้ไขสินค้า */}
          {preorderForm !== null && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
                  <p className="font-bold text-[#1E3A5F]">{preorderForm.id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</p>
                  <button onClick={() => setPreorderForm(null)} className="text-gray-400 hover:text-gray-600 p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {preorderSaveError && <div className="bg-[#DC2626]/10 text-[#DC2626] text-sm px-3 py-2 rounded-xl">{preorderSaveError}</div>}

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">ชื่อสินค้า <span className="text-[#DC2626]">*</span></label>
                    <input type="text" value={preorderForm.name}
                      onChange={(e) => { setPreorderForm((p) => p && ({ ...p, name: e.target.value })); setPreorderFormErrors((p) => ({ ...p, name: '' })) }}
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] ${preorderFormErrors.name ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`}
                      placeholder="ชื่อสินค้า" />
                    {preorderFormErrors.name && <p className="text-xs text-[#DC2626] mt-1">{preorderFormErrors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">รายละเอียด</label>
                    <textarea value={preorderForm.description} rows={2}
                      onChange={(e) => setPreorderForm((p) => p && ({ ...p, description: e.target.value }))}
                      className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] resize-none"
                      placeholder="รายละเอียดเพิ่มเติม" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1.5">ราคา (บาท) <span className="text-[#DC2626]">*</span></label>
                      <input type="number" min="0" value={preorderForm.price}
                        onChange={(e) => { setPreorderForm((p) => p && ({ ...p, price: e.target.value })); setPreorderFormErrors((p) => ({ ...p, price: '' })) }}
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] ${preorderFormErrors.price ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`}
                        placeholder="0" />
                      {preorderFormErrors.price && <p className="text-xs text-[#DC2626] mt-1">{preorderFormErrors.price}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1.5">จำกัดจำนวน (0=ไม่จำกัด)</label>
                      <input type="number" min="0" value={preorderForm.max_qty}
                        onChange={(e) => setPreorderForm((p) => p && ({ ...p, max_qty: e.target.value }))}
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F]"
                        placeholder="0" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">วันปิดรับออเดอร์ <span className="text-[#DC2626]">*</span></label>
                    <input type="date" value={preorderForm.close_date}
                      onChange={(e) => { setPreorderForm((p) => p && ({ ...p, close_date: e.target.value })); setPreorderFormErrors((p) => ({ ...p, close_date: '' })) }}
                      className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F] ${preorderFormErrors.close_date ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`} />
                    {preorderFormErrors.close_date && <p className="text-xs text-[#DC2626] mt-1">{preorderFormErrors.close_date}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">วันวางจำหน่าย</label>
                    <input type="date" value={preorderForm.release_date}
                      onChange={(e) => setPreorderForm((p) => p && ({ ...p, release_date: e.target.value }))}
                      className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F]" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">รหัส SKU <span className="text-gray-400 font-normal">(สำหรับตัด stock)</span></label>
                    <input type="text" value={preorderForm.sku}
                      onChange={(e) => setPreorderForm((p) => p && ({ ...p, sku: e.target.value }))}
                      className="w-full border border-[#E2E8F0] bg-white rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1E3A5F]"
                      placeholder="เช่น SKU-001, BK-XL-RED" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#374151]">รูปสินค้า</label>
                      <span className="text-[10px] text-gray-400">{preorderImages.length}/10 รูป</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {preorderImages.map((pair, i) => (
                        <div key={i} className="relative aspect-square">
                          <img src={pair.f} alt={`รูป ${i + 1}`} className="w-full h-full object-cover rounded-xl" />
                          <button type="button"
                            onClick={() => setPreorderImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 w-5 h-5 bg-white/90 text-[#DC2626] text-xs font-bold rounded-full shadow flex items-center justify-center">✕</button>
                        </div>
                      ))}
                      {preorderImages.length < 10 && (
                        <label className={`aspect-square border-2 border-dashed border-[#E2E8F0] rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${preorderCompressing ? 'opacity-50' : 'text-gray-400 hover:border-[#1E3A5F]/30'}`}>
                          <input key={preorderFileKey} type="file" accept="image/*" onChange={handleAddPreorderImage} className="hidden" disabled={preorderCompressing} />
                          <span className="text-xl leading-none">{preorderCompressing ? '⏳' : '+'}</span>
                          <span className="text-[10px]">{preorderCompressing ? 'กำลังบีบ...' : 'เพิ่มรูป'}</span>
                        </label>
                      )}
                    </div>
                  </div>

                  <button disabled={preorderSaving} onClick={async () => {
                    const e: Partial<PreorderFormData> = {}
                    if (!preorderForm.name.trim()) e.name = 'กรุณากรอกชื่อสินค้า'
                    if (!preorderForm.close_date.trim()) e.close_date = 'กรุณาระบุวันปิดรับ'
                    if (!preorderForm.price.trim() || isNaN(Number(preorderForm.price))) e.price = 'กรุณากรอกราคา'
                    setPreorderFormErrors(e)
                    if (Object.keys(e).length > 0) return
                    setPreorderSaving(true)
                    setPreorderSaveError('')
                    try {
                      const body = { name: preorderForm.name.trim(), description: preorderForm.description.trim(), price: Number(preorderForm.price), close_date: preorderForm.close_date, release_date: preorderForm.release_date.trim(), sku: preorderForm.sku.trim(), max_qty: Number(preorderForm.max_qty) || 0, image_data: preorderImages.length > 0 ? JSON.stringify(preorderImages) : '' }
                      const url = preorderForm.id ? `/api/preorder-products/${preorderForm.id}?key=${ADMIN_KEY}` : `/api/preorder-products?key=${ADMIN_KEY}`
                      const res = await fetch(url, { method: preorderForm.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                      const data = await res.json()
                      if (!res.ok) { setPreorderSaveError(data.error || 'เกิดข้อผิดพลาด'); return }
                      setPreorderForm(null)
                      loadPreorderData()
                    } catch { setPreorderSaveError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
                    finally { setPreorderSaving(false) }
                  }} className="w-full bg-[#1E3A5F] text-white font-bold py-3 rounded-xl disabled:opacity-60 hover:opacity-90 transition-opacity">
                    {preorderSaving ? 'กำลังบันทึก...' : preorderForm.id ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab รหัสจัดงานแข่ง */}
      {activeTab === 'tournament-creds' && (() => {
        const STORES = [
          { id: 'gap7card', label: 'gap7card' },
          { id: 'catramen', label: 'catramen card&boardgame cafe' },
          { id: 'ninjabear', label: 'ninjabear card shop' },
        ]

        const addGame = async (storeId: string) => {
          const name = (newGameName[storeId] || '').trim()
          if (!name) return
          setAddingGame((p) => ({ ...p, [storeId]: true }))
          try {
            const res = await fetch(`/api/tournament-games?key=${ADMIN_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ store_id: storeId, game_name: name }),
            })
            const data = await res.json()
            if (res.ok) {
              setTournamentGames((prev) => [...prev, data.game])
              setNewGameName((p) => ({ ...p, [storeId]: '' }))
            } else {
              alert(data.error || 'เพิ่มไม่สำเร็จ')
            }
          } catch { alert('เกิดข้อผิดพลาด') }
          finally { setAddingGame((p) => ({ ...p, [storeId]: false })) }
        }

        const removeGame = async (id: string) => {
          setDeletingGameId(id)
          try {
            await fetch(`/api/tournament-games?key=${ADMIN_KEY}&id=${id}`, { method: 'DELETE' })
            setTournamentGames((prev) => prev.filter((g) => g.id !== id))
          } catch { alert('เกิดข้อผิดพลาด') }
          finally { setDeletingGameId(null) }
        }

        const BUILTIN_SYSTEMS = ['bandai', 'pokemon', 'liftbound']

        const addSystem = async () => {
          const label = newSysLabel.trim()
          if (!label) return
          setAddingSystem(true)
          try {
            const res = await fetch(`/api/tournament-systems?key=${ADMIN_KEY}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ label, url: newSysUrl.trim(), emoji: newSysEmoji.trim() || '🎮' }),
            })
            const data = await res.json()
            if (res.ok) {
              setNewSysLabel(''); setNewSysUrl(''); setNewSysEmoji('🎮')
              await fetchTournamentSystems()
              await fetchTournamentCreds()
            } else { alert(data.error || 'เพิ่มไม่สำเร็จ') }
          } catch { alert('เกิดข้อผิดพลาด') }
          finally { setAddingSystem(false) }
        }

        const deleteSystem = async (id: string) => {
          if (!confirm(`ยืนยันลบระบบ "${id}"? จะลบรหัส ID/Password ของทุกร้านด้วย`)) return
          setDeletingSystemId(id)
          try {
            const res = await fetch(`/api/tournament-systems?key=${ADMIN_KEY}&id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (res.ok) { await fetchTournamentSystems(); await fetchTournamentCreds() }
            else { alert(data.error || 'ลบไม่สำเร็จ') }
          } catch { alert('เกิดข้อผิดพลาด') }
          finally { setDeletingSystemId(null) }
        }

        const saveCred = (store: string, system: string, field: 'system_id' | 'system_password', value: string) =>
          fetch(`/api/tournament-creds?key=${ADMIN_KEY}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store, system, [field]: value }),
          })
            .then(async (r) => {
              const text = await r.text().catch(() => '')
              let d: { ok?: boolean; error?: string } = {}
              try { d = JSON.parse(text) } catch {}
              if (d.ok) {
                setTournamentCreds((prev) => ({
                  ...prev,
                  [`${store}_${system}`]: {
                    system_id: field === 'system_id' ? value : (prev[`${store}_${system}`]?.system_id ?? ''),
                    system_password: field === 'system_password' ? value : (prev[`${store}_${system}`]?.system_password ?? ''),
                  },
                }))
                alert('บันทึกแล้ว')
              } else {
                alert(d.error || text.slice(0, 300) || `เกิดข้อผิดพลาด (HTTP ${r.status})`)
              }
            })
            .catch((e: unknown) => alert(`เกิดข้อผิดพลาด: ${e}`))
        return (
          <div className="max-w-2xl mx-auto px-4 pb-10 flex flex-col gap-6">
            {/* ระบบจัดแข่ง (dynamic) */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">🖥️ ระบบจัดแข่ง</h2>
                <p className="text-xs text-gray-400 mt-0.5">เพิ่ม/ลบระบบที่ใช้จัดแข่ง — แต่ละระบบจะมีช่อง ID/Password แยกตามร้าน</p>
              </div>
              <div className="px-5 py-4 flex flex-col gap-4">
                {/* รายการ systems ปัจจุบัน */}
                <div className="flex flex-wrap gap-2">
                  {tournamentSystems.length === 0 && <span className="text-xs text-gray-300">กำลังโหลด...</span>}
                  {tournamentSystems.map((sys) => (
                    <span key={sys.id} className="flex items-center gap-1.5 text-xs font-semibold bg-[#1E3A5F]/10 text-[#1E3A5F] px-3 py-1.5 rounded-full">
                      {sys.emoji} {sys.label}
                      {!BUILTIN_SYSTEMS.includes(sys.id) && (
                        <button
                          disabled={deletingSystemId === sys.id}
                          onClick={() => deleteSystem(sys.id)}
                          className="ml-1 text-[#DC2626] opacity-60 hover:opacity-100 disabled:opacity-20 text-xs leading-none"
                        >✕</button>
                      )}
                    </span>
                  ))}
                </div>
                {/* form เพิ่มระบบใหม่ */}
                <div className="border border-dashed border-[#E2E8F0] rounded-xl p-3 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-500">+ เพิ่มระบบใหม่</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="emoji (เช่น 🎯)"
                      value={newSysEmoji}
                      onChange={(e) => setNewSysEmoji(e.target.value)}
                      className="w-16 border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[#1E3A5F]"
                    />
                    <input
                      type="text"
                      placeholder="ชื่อระบบ (เช่น One Piece TCG) *"
                      value={newSysLabel}
                      onChange={(e) => setNewSysLabel(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addSystem()}
                      className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="URL เว็บไซต์ (ไม่บังคับ)"
                    value={newSysUrl}
                    onChange={(e) => setNewSysUrl(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
                  />
                  <button
                    disabled={addingSystem || !newSysLabel.trim()}
                    onClick={addSystem}
                    className="self-end px-4 py-1.5 bg-[#1E3A5F] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                  >
                    {addingSystem ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
                  </button>
                </div>
              </div>
            </div>

            {/* การ์ดเกมที่ต้องจัดแข่ง */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">🃏 การ์ดเกมที่ต้องจัดแข่ง</h2>
                <p className="text-xs text-gray-400 mt-0.5">กำหนดรายชื่อเกมที่แต่ละร้านต้องจัดในสัปดาห์นี้ — แสดงในหน้าระบบจัดการหน้าร้าน</p>
              </div>
              <div className="divide-y divide-[#E2E8F0]">
                {STORES.map((store) => {
                  const storeGames = tournamentGames.filter((g) => g.store_id === store.id)
                  return (
                    <div key={store.id} className="px-5 py-4">
                      <p className="text-sm font-semibold text-[#374151] mb-2">🏪 {store.label}</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {storeGames.length === 0 && (
                          <span className="text-xs text-gray-300">ยังไม่มีเกม</span>
                        )}
                        {storeGames.map((g) => (
                          <span key={g.id} className="flex items-center gap-1 text-xs font-semibold bg-[#1E3A5F]/10 text-[#1E3A5F] px-2.5 py-1 rounded-full">
                            🃏 {g.game_name}
                            <button
                              disabled={deletingGameId === g.id}
                              onClick={() => removeGame(g.id)}
                              className="ml-1 text-[#DC2626] opacity-60 hover:opacity-100 disabled:opacity-20 text-xs leading-none"
                            >✕</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="ชื่อเกม เช่น Pokemon"
                          value={newGameName[store.id] || ''}
                          onChange={(e) => setNewGameName((p) => ({ ...p, [store.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addGame(store.id)}
                          className="flex-1 border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-[#1E3A5F]"
                        />
                        <button
                          disabled={addingGame[store.id] || !newGameName[store.id]?.trim()}
                          onClick={() => addGame(store.id)}
                          className="px-3 py-1.5 bg-[#1E3A5F] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                        >
                          {addingGame[store.id] ? '...' : '+ เพิ่ม'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* รหัสระบบ */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="font-bold text-[#1E3A5F] text-base">รหัสจัดงานแข่ง</h2>
                <p className="text-xs text-gray-400 mt-0.5">รหัส ID และ Password แยกตามร้านค้าและระบบ</p>
              </div>
              <div className="px-5 py-4 flex flex-col gap-5">
                {STORES.map((store) => (
                  <div key={store.id} className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <div className="bg-[#F5F6F8] px-4 py-2.5 border-b border-[#E2E8F0]">
                      <p className="text-sm font-bold text-[#1E3A5F]">🏪 {store.label}</p>
                    </div>
                    <div className="divide-y divide-[#E2E8F0]">
                      {tournamentSystems.map((sys) => {
                        const k = `${store.id}_${sys.id}`
                        return (
                          <div key={sys.id} className="px-4 py-3">
                            <p className="text-xs font-semibold text-[#374151] mb-2">{sys.emoji} {sys.label}</p>
                            {(['system_id', 'system_password'] as const).map((field) => (
                              <div key={field} className="flex items-center gap-2 mb-1.5">
                                <span className="text-[11px] text-gray-400 w-16 shrink-0">{field === 'system_id' ? 'ID' : 'Password'}</span>
                                <input
                                  type="text"
                                  value={tournamentCredsEdit[`${k}_${field}`] ?? ''}
                                  onChange={(e) => setTournamentCredsEdit((prev) => ({ ...prev, [`${k}_${field}`]: e.target.value }))}
                                  className="flex-1 text-xs border border-[#E2E8F0] rounded-lg px-2 py-1.5 focus:border-[#1E3A5F] outline-none min-w-0 font-mono"
                                  placeholder={field === 'system_id' ? 'กรอก ID' : 'กรอก Password'}
                                />
                                <button
                                  type="button"
                                  onClick={() => saveCred(store.id, sys.id, field, tournamentCredsEdit[`${k}_${field}`] ?? '')}
                                  className="px-2.5 py-1.5 bg-[#1E3A5F] text-white text-[11px] rounded-lg shrink-0 font-semibold hover:opacity-90"
                                >
                                  บันทึก
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tournament Schedule Tab */}
      {activeTab === 'tournament-schedule' && (() => {
        const today = new Date().toLocaleDateString('sv-SE')
        const storeLabel: Record<string, string> = { catramen: 'catramen card&boardgame cafe', ninjabear: 'ninjabear card shop', gap7card: 'gap7card' }
        return (
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#1E3A5F]">ปฏิทินงานแข่งขัน</h2>
              <button onClick={fetchTournamentEvents} disabled={loadingTournamentEvents} className="text-xs bg-[#1E3A5F] text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-60">
                {loadingTournamentEvents ? 'กำลังโหลด...' : 'รีเฟรช'}
              </button>
            </div>
            {loadingTournamentEvents ? (
              <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : tournamentEvents.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีข้อมูลปฏิทินงานแข่ง</div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                        <th className="text-left px-4 py-3">วันที่จัด</th>
                        <th className="text-left px-4 py-3">เวลา</th>
                        <th className="text-left px-4 py-3">ร้าน</th>
                        <th className="text-left px-4 py-3">โดย</th>
                        <th className="text-left px-4 py-3">ลิ้ง Facebook</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournamentEvents.map((ev) => (
                        <tr key={ev.id} className={`border-t border-[#E2E8F0] ${ev.event_date === today ? 'bg-[#1E3A5F]/5' : 'bg-white'}`}>
                          <td className="px-4 py-3 font-semibold text-[#1E3A5F] whitespace-nowrap">
                            {ev.event_date === today && <span className="mr-1.5 text-[10px] bg-[#1E3A5F] text-white px-1.5 py-0.5 rounded-full">วันนี้</span>}
                            {ev.event_date}
                          </td>
                          <td className="px-4 py-3 text-[#374151]">{ev.start_time || '—'}</td>
                          <td className="px-4 py-3 text-[#374151]">{storeLabel[ev.store_id] || ev.store_id}</td>
                          <td className="px-4 py-3 text-gray-500">{ev.nickname}</td>
                          <td className="px-4 py-3">
                            {ev.facebook_url ? (
                              <a href={ev.facebook_url} target="_blank" rel="noopener noreferrer" className="text-[#1E3A5F] text-xs underline truncate block max-w-[180px]">
                                ดูโพส
                              </a>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-[#E2E8F0] text-xs text-gray-400">
                  {tournamentEvents.length} รายการ
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
          {/* Sub-tab bar */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-[#E2E8F0]">
              {([
                { key: 'general',  label: '📢 ประกาศสำคัญ' },
                { key: 'company',  label: '📜 กฎบริษัท' },
                { key: 'dept',     label: '📣 ประกาศแผนก' },
                { key: 'rules',    label: '📋 กฎแผนก' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setAnnSubTab(tab.key)
                    if (tab.key === 'company' && companyRules.length === 0) {
                      setLoadingCompanyRules(true)
                      fetch(`/api/dept-rules?dept=${encodeURIComponent('ทั้งบริษัท')}`).then((r) => r.json()).then((d) => { if (Array.isArray(d.rules)) setCompanyRules(d.rules) }).catch(() => {}).finally(() => setLoadingCompanyRules(false))
                    }
                    if (tab.key === 'dept' && deptAnns.length === 0) {
                      setLoadingDeptAnns(true)
                      fetch(`/api/dept-announcements?key=${ADMIN_KEY}`).then((r) => r.json()).then((d) => { if (Array.isArray(d.announcements)) setDeptAnns(d.announcements) }).catch(() => {}).finally(() => setLoadingDeptAnns(false))
                    }
                    if (tab.key === 'rules' && deptRules.length === 0) {
                      setLoadingDeptRules(true)
                      fetch(`/api/dept-rules?key=${ADMIN_KEY}`).then((r) => r.json()).then((d) => { if (Array.isArray(d.rules)) setDeptRules(d.rules) }).catch(() => {}).finally(() => setLoadingDeptRules(false))
                    }
                  }}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors relative ${annSubTab === tab.key ? 'text-[#1E3A5F]' : 'text-gray-400 hover:text-[#374151]'}`}
                >
                  {tab.label}
                  {annSubTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1E3A5F]" />}
                </button>
              ))}
            </div>

            {/* Sub-tab: ประกาศสำคัญ */}
            {annSubTab === 'general' && (
              <div className="p-5 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-[#1E3A5F] mb-4">📢 สร้างประกาศใหม่</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">หัวข้อประกาศ *</label>
                      <input
                        type="text"
                        value={annForm.title}
                        onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="หัวข้อ..."
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">เนื้อหา</label>
                      <textarea
                        value={annForm.content}
                        onChange={(e) => setAnnForm((f) => ({ ...f, content: e.target.value }))}
                        placeholder="รายละเอียดประกาศ..."
                        rows={4}
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">ผู้โพสต์ *</label>
                      <input
                        type="text"
                        value={annForm.created_by}
                        onChange={(e) => setAnnForm((f) => ({ ...f, created_by: e.target.value }))}
                        placeholder="ชื่อ/แผนก HR..."
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">แนบรูปภาพ (PNG/JPG ไม่บังคับ)</label>
                      <input
                        type="file" accept="image/*"
                        onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; compressImage(file).then((data) => setAnnForm((f) => ({ ...f, image_data: data, file_name: file.name }))) }}
                        className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1E3A5F]/10 file:text-[#1E3A5F]"
                      />
                      {annForm.image_data && (
                        <div className="mt-2 relative inline-block">
                          <img src={annForm.image_data} alt="preview" className="h-20 w-auto rounded-lg border border-[#E2E8F0] object-cover" />
                          <button onClick={() => setAnnForm((f) => ({ ...f, image_data: '', file_name: '' }))} className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">แนบไฟล์ PDF / เอกสาร (ไม่บังคับ)</label>
                      <input
                        type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = (ev) => setAnnForm((f) => ({ ...f, file_data: ev.target?.result as string || '', attached_file_name: file.name }))
                          reader.readAsDataURL(file)
                        }}
                        className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#16A34A]/10 file:text-[#16A34A]"
                      />
                      {annForm.file_data && (
                        <div className="mt-2 flex items-center gap-2 bg-[#F5F6F8] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151]">
                          <span className="truncate flex-1">📎 {annForm.attached_file_name}</span>
                          <button onClick={() => setAnnForm((f) => ({ ...f, file_data: '', attached_file_name: '' }))} className="bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shrink-0">×</button>
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={annForm.is_pinned}
                        onChange={(e) => setAnnForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                        className="w-4 h-4 accent-[#1E3A5F]"
                      />
                      <span className="text-sm text-[#374151]">📌 ปักหมุด (แสดงด้านบนสุด)</span>
                    </label>
                    <button
                      onClick={async () => {
                        if (!annForm.title.trim() || !annForm.created_by.trim()) return
                        setSubmittingAnn(true)
                        try {
                          const res = await fetch('/api/announcements', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...annForm, key: ADMIN_KEY }),
                          })
                          if (res.ok) {
                            const newItem = await res.json()
                            const now = new Date().toISOString()
                            setAnnouncements((prev) => [{
                              id: newItem.id, title: annForm.title, content: annForm.content,
                              image_data: annForm.image_data, file_name: annForm.file_name, is_pinned: annForm.is_pinned ? 1 : 0,
                              is_active: 1, created_by: annForm.created_by, created_at: now,
                            }, ...prev])
                            setAnnForm({ title: '', content: '', created_by: '', is_pinned: false, image_data: '', file_name: '', file_data: '', attached_file_name: '' })
                          }
                        } catch { /* silent */ } finally {
                          setSubmittingAnn(false)
                        }
                      }}
                      disabled={submittingAnn || !annForm.title.trim() || !annForm.created_by.trim()}
                      className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
                    >
                      {submittingAnn ? 'กำลังสร้าง...' : 'สร้างประกาศ'}
                    </button>
                  </div>
                </div>
                <div className="border-t border-[#E2E8F0] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-[#1E3A5F]">รายการประกาศทั้งหมด</h2>
                    <span className="text-xs text-gray-400">{announcements.length} รายการ</span>
                  </div>
                  {loadingAnnouncements ? (
                    <div className="py-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
                  ) : announcements.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">ยังไม่มีประกาศ</div>
                  ) : (
                    <div className="divide-y divide-[#E2E8F0]">
                      {announcements.map((ann) => (
                        <div key={ann.id} className="py-3">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              {ann.is_pinned ? <span className="text-xs text-[#1E3A5F] shrink-0">📌</span> : null}
                              <p className="text-sm font-semibold text-[#374151] truncate">{ann.title}</p>
                              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${ann.is_active ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-gray-100 text-gray-400'}`}>
                                {ann.is_active ? 'แสดงอยู่' : 'ซ่อน'}
                              </span>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={async () => {
                                  const res = await fetch(`/api/announcements?admin_id=${ann.id}&key=${ADMIN_KEY}`)
                                  if (!res.ok) return
                                  const data = await res.json()
                                  setEditingAnn({ id: data.id, title: data.title, content: data.content, image_data: data.image_data || '', file_name: data.file_name || '', file_data: data.file_data || '', attached_file_name: data.attached_file_name || '', is_pinned: data.is_pinned === 1 })
                                }}
                                className="text-xs px-2.5 py-1 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] hover:bg-[#1E3A5F]/20 whitespace-nowrap"
                              >
                                แก้ไข
                              </button>
                              <button
                                onClick={async () => {
                                  setTogglingAnnId(ann.id)
                                  try {
                                    const res = await fetch('/api/announcements', {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: ann.id, action: 'toggle_active', key: ADMIN_KEY }),
                                    })
                                    if (res.ok) setAnnouncements((prev) => prev.map((a) => a.id === ann.id ? { ...a, is_active: a.is_active ? 0 : 1 } : a))
                                  } catch { /* silent */ } finally { setTogglingAnnId(null) }
                                }}
                                disabled={togglingAnnId === ann.id}
                                className="text-xs px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-[#374151] hover:bg-[#F5F6F8] disabled:opacity-50 whitespace-nowrap"
                              >
                                {togglingAnnId === ann.id ? '...' : ann.is_active ? 'ซ่อน' : 'แสดง'}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm('ลบประกาศนี้?')) return
                                  setDeletingAnnId(ann.id)
                                  try {
                                    const res = await fetch('/api/announcements', {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: ann.id, key: ADMIN_KEY }),
                                    })
                                    if (res.ok) setAnnouncements((prev) => prev.filter((a) => a.id !== ann.id))
                                  } catch { /* silent */ } finally { setDeletingAnnId(null) }
                                }}
                                disabled={deletingAnnId === ann.id}
                                className="text-xs px-2.5 py-1 rounded-lg bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 disabled:opacity-50 whitespace-nowrap"
                              >
                                {deletingAnnId === ann.id ? '...' : 'ลบ'}
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{ann.content}</p>
                          {(ann.has_image || ann.has_file) && (
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              {ann.has_image ? <a href={`/api/announcements?image_id=${ann.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F]">🖼️ ดูรูป</a> : null}
                              {ann.has_file ? <a href={`/api/announcements?file_id=${ann.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A]">📎 {ann.attached_file_name || ann.file_name || 'ดาวน์โหลด'}</a> : null}
                            </div>
                          )}
                          <p className="text-[10px] text-gray-300 mt-1">โดย {ann.created_by} · {new Date(ann.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-tab: กฎบริษัท */}
            {annSubTab === 'company' && (
              <div className="p-5 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-[#1E3A5F] mb-4">📜 เพิ่มกฎบริษัท</h2>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-[#374151] mb-1">หัวข้อกฎ *</label>
                        <input
                          type="text"
                          value={companyRuleForm.title}
                          onChange={(e) => setCompanyRuleForm((f) => ({ ...f, title: e.target.value }))}
                          placeholder="หัวข้อกฎ..."
                          className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#374151] mb-1">ลำดับที่</label>
                        <input
                          type="number"
                          value={companyRuleForm.sort_order}
                          onChange={(e) => setCompanyRuleForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                          min={0}
                          className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">เนื้อหากฎ</label>
                      <textarea
                        value={companyRuleForm.content}
                        onChange={(e) => setCompanyRuleForm((f) => ({ ...f, content: e.target.value }))}
                        placeholder="รายละเอียดกฎ..."
                        rows={3}
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">ผู้บันทึก</label>
                      <input
                        type="text"
                        value={companyRuleForm.created_by}
                        onChange={(e) => setCompanyRuleForm((f) => ({ ...f, created_by: e.target.value }))}
                        placeholder="HR..."
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">แนบรูปภาพ (ไม่บังคับ)</label>
                      <input type="file" accept="image/*"
                        onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; compressImage(f).then((data) => setCompanyRuleForm((s) => ({ ...s, image_data: data, image_name: f.name }))) }}
                        className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1E3A5F]/10 file:text-[#1E3A5F]"
                      />
                      {companyRuleForm.image_data && (
                        <div className="mt-2 relative inline-block">
                          <img src={companyRuleForm.image_data} alt="preview" className="h-16 w-auto rounded-lg border border-[#E2E8F0] object-cover" />
                          <button onClick={() => setCompanyRuleForm((f) => ({ ...f, image_data: '', image_name: '' }))} className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">แนบไฟล์ PDF / เอกสาร (ไม่บังคับ)</label>
                      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setCompanyRuleForm((s) => ({ ...s, file_data: ev.target?.result as string || '', file_name: f.name })); r.readAsDataURL(f) }}
                        className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#16A34A]/10 file:text-[#16A34A]"
                      />
                      {companyRuleForm.file_data && (
                        <div className="mt-2 flex items-center gap-2 bg-[#F5F6F8] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151]">
                          <span className="truncate flex-1">📎 {companyRuleForm.file_name}</span>
                          <button onClick={() => setCompanyRuleForm((f) => ({ ...f, file_data: '', file_name: '' }))} className="bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shrink-0">×</button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (!companyRuleForm.title.trim()) return
                        setSubmittingCompanyRule(true)
                        try {
                          const res = await fetch(`/api/dept-rules?key=${ADMIN_KEY}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...companyRuleForm, department: 'ทั้งบริษัท' }),
                          })
                          if (res.ok) {
                            const data = await res.json()
                            const now = new Date().toISOString()
                            setCompanyRules((prev) => [...prev, { id: data.id, ...companyRuleForm, is_active: 1, created_at: now }].sort((a, b) => a.sort_order - b.sort_order))
                            setCompanyRuleForm({ title: '', content: '', sort_order: 0, created_by: 'HR', image_data: '', image_name: '', file_data: '', file_name: '' })
                          }
                        } catch { /* silent */ } finally { setSubmittingCompanyRule(false) }
                      }}
                      disabled={submittingCompanyRule || !companyRuleForm.title.trim()}
                      className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
                    >
                      {submittingCompanyRule ? 'กำลังบันทึก...' : 'เพิ่มกฎบริษัท'}
                    </button>
                  </div>
                </div>
                <div className="border-t border-[#E2E8F0] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-[#1E3A5F]">กฎบริษัททั้งหมด</h2>
                    <span className="text-xs text-gray-400">{companyRules.length} ข้อ</span>
                  </div>
                  {loadingCompanyRules ? (
                    <div className="py-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
                  ) : companyRules.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">ยังไม่มีกฎ</div>
                  ) : (
                    <div className="space-y-1">
                      {companyRules.map((rule, idx) => (
                        <div key={rule.id} className="rounded-xl border border-[#E2E8F0] p-3 flex items-start gap-3">
                          <div className="shrink-0 w-5 h-5 rounded-full bg-[#1E3A5F] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#374151]">{rule.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{rule.content}</p>
                            {(rule.has_image || rule.has_file) && (
                              <div className="flex gap-2 mt-1.5 flex-wrap">
                                {rule.has_image ? <a href={`/api/dept-rules?image_id=${rule.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F]">🖼️ ดูรูป</a> : null}
                                {rule.has_file ? <a href={`/api/dept-rules?file_id=${rule.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A]">📎 {rule.file_name || 'ดาวน์โหลด'}</a> : null}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/dept-rules?admin_id=${rule.id}&key=${ADMIN_KEY}`)
                                if (!res.ok) return
                                const data = await res.json()
                                setEditingCompanyRule({ id: data.id, title: data.title, content: data.content, sort_order: data.sort_order, created_by: data.created_by, image_data: data.image_data || '', image_name: data.image_name || '', file_data: data.file_data || '', file_name: data.file_name || '' })
                              }}
                              className="text-xs px-2 py-1 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] hover:bg-[#1E3A5F]/20"
                            >
                              แก้ไข
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('ลบกฎนี้?')) return
                                setDeletingCompanyRuleId(rule.id)
                                try {
                                  const res = await fetch(`/api/dept-rules?key=${ADMIN_KEY}&id=${rule.id}`, { method: 'DELETE' })
                                  if (res.ok) setCompanyRules((prev) => prev.filter((r) => r.id !== rule.id))
                                } catch { /* silent */ } finally { setDeletingCompanyRuleId(null) }
                              }}
                              disabled={deletingCompanyRuleId === rule.id}
                              className="text-xs px-2 py-1 rounded-lg bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 disabled:opacity-50"
                            >
                              {deletingCompanyRuleId === rule.id ? '...' : 'ลบ'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-tab: ประกาศแผนก */}
            {annSubTab === 'dept' && (
              <div className="p-5 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-[#1E3A5F] mb-4">📣 เพิ่มประกาศแผนก</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">แผนก *</label>
                      <select
                        value={deptAnnForm.department}
                        onChange={(e) => setDeptAnnForm((f) => ({ ...f, department: e.target.value }))}
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      >
                        <option value="">-- เลือกแผนก --</option>
                        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">หัวข้อ *</label>
                      <input
                        type="text"
                        value={deptAnnForm.title}
                        onChange={(e) => setDeptAnnForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="หัวข้อประกาศ..."
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">เนื้อหา</label>
                      <textarea
                        value={deptAnnForm.content}
                        onChange={(e) => setDeptAnnForm((f) => ({ ...f, content: e.target.value }))}
                        placeholder="รายละเอียดประกาศ..."
                        rows={4}
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">ผู้โพสต์</label>
                      <input
                        type="text"
                        value={deptAnnForm.created_by}
                        onChange={(e) => setDeptAnnForm((f) => ({ ...f, created_by: e.target.value }))}
                        placeholder="HR..."
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">แนบรูปภาพ (ไม่บังคับ)</label>
                      <input type="file" accept="image/*"
                        onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; compressImage(f).then((data) => setDeptAnnForm((s) => ({ ...s, image_data: data, image_name: f.name }))) }}
                        className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1E3A5F]/10 file:text-[#1E3A5F]"
                      />
                      {deptAnnForm.image_data && (
                        <div className="mt-2 relative inline-block">
                          <img src={deptAnnForm.image_data} alt="preview" className="h-16 w-auto rounded-lg border border-[#E2E8F0] object-cover" />
                          <button onClick={() => setDeptAnnForm((f) => ({ ...f, image_data: '', image_name: '' }))} className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">แนบไฟล์ PDF / เอกสาร (ไม่บังคับ)</label>
                      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setDeptAnnForm((s) => ({ ...s, file_data: ev.target?.result as string || '', file_name: f.name })); r.readAsDataURL(f) }}
                        className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#16A34A]/10 file:text-[#16A34A]"
                      />
                      {deptAnnForm.file_data && (
                        <div className="mt-2 flex items-center gap-2 bg-[#F5F6F8] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151]">
                          <span className="truncate flex-1">📎 {deptAnnForm.file_name}</span>
                          <button onClick={() => setDeptAnnForm((f) => ({ ...f, file_data: '', file_name: '' }))} className="bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shrink-0">×</button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (!deptAnnForm.department.trim() || !deptAnnForm.title.trim()) return
                        setSubmittingDeptAnn(true)
                        try {
                          const res = await fetch(`/api/dept-announcements?key=${ADMIN_KEY}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(deptAnnForm),
                          })
                          if (res.ok) {
                            const data = await res.json()
                            const now = new Date().toISOString()
                            setDeptAnns((prev) => [{ id: data.id, ...deptAnnForm, is_active: 1, created_at: now }, ...prev])
                            setDeptAnnForm({ department: '', title: '', content: '', created_by: 'HR', image_data: '', image_name: '', file_data: '', file_name: '' })
                          }
                        } catch { /* silent */ } finally { setSubmittingDeptAnn(false) }
                      }}
                      disabled={submittingDeptAnn || !deptAnnForm.department.trim() || !deptAnnForm.title.trim()}
                      className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
                    >
                      {submittingDeptAnn ? 'กำลังสร้าง...' : 'เพิ่มประกาศแผนก'}
                    </button>
                  </div>
                </div>
                <div className="border-t border-[#E2E8F0] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-[#1E3A5F]">ประกาศแผนกทั้งหมด</h2>
                    <span className="text-xs text-gray-400">{deptAnns.length} รายการ</span>
                  </div>
                  {loadingDeptAnns ? (
                    <div className="py-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
                  ) : deptAnns.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">ยังไม่มีประกาศแผนก</div>
                  ) : (
                    <div className="divide-y divide-[#E2E8F0]">
                      {deptAnns.map((ann) => (
                        <div key={ann.id} className="py-3">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] shrink-0">{ann.department}</span>
                              <p className="text-sm font-semibold text-[#374151] truncate">{ann.title}</p>
                              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${ann.is_active ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-gray-100 text-gray-400'}`}>
                                {ann.is_active ? 'แสดงอยู่' : 'ซ่อน'}
                              </span>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={async () => {
                                  const res = await fetch(`/api/dept-announcements?admin_id=${ann.id}&key=${ADMIN_KEY}`)
                                  if (!res.ok) return
                                  const data = await res.json()
                                  setEditingDeptAnn({ id: data.id, department: data.department, title: data.title, content: data.content, created_by: data.created_by, image_data: data.image_data || '', image_name: data.image_name || '', file_data: data.file_data || '', file_name: data.file_name || '' })
                                }}
                                className="text-xs px-2.5 py-1 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] hover:bg-[#1E3A5F]/20 whitespace-nowrap"
                              >
                                แก้ไข
                              </button>
                              <button
                                onClick={async () => {
                                  setTogglingDeptAnnId(ann.id)
                                  try {
                                    const res = await fetch(`/api/dept-announcements?key=${ADMIN_KEY}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: ann.id, action: 'toggle_active' }),
                                    })
                                    if (res.ok) setDeptAnns((prev) => prev.map((a) => a.id === ann.id ? { ...a, is_active: a.is_active ? 0 : 1 } : a))
                                  } catch { /* silent */ } finally { setTogglingDeptAnnId(null) }
                                }}
                                disabled={togglingDeptAnnId === ann.id}
                                className="text-xs px-2.5 py-1 rounded-lg border border-[#E2E8F0] text-[#374151] hover:bg-[#F5F6F8] disabled:opacity-50 whitespace-nowrap"
                              >
                                {togglingDeptAnnId === ann.id ? '...' : ann.is_active ? 'ซ่อน' : 'แสดง'}
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm('ลบประกาศนี้?')) return
                                  setDeletingDeptAnnId(ann.id)
                                  try {
                                    const res = await fetch(`/api/dept-announcements?key=${ADMIN_KEY}&id=${ann.id}`, { method: 'DELETE' })
                                    if (res.ok) setDeptAnns((prev) => prev.filter((a) => a.id !== ann.id))
                                  } catch { /* silent */ } finally { setDeletingDeptAnnId(null) }
                                }}
                                disabled={deletingDeptAnnId === ann.id}
                                className="text-xs px-2.5 py-1 rounded-lg bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 disabled:opacity-50 whitespace-nowrap"
                              >
                                {deletingDeptAnnId === ann.id ? '...' : 'ลบ'}
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{ann.content}</p>
                          {(ann.has_image || ann.has_file) && (
                            <div className="flex gap-2 mt-1.5 flex-wrap">
                              {ann.has_image ? <a href={`/api/dept-announcements?image_id=${ann.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F]">🖼️ ดูรูป</a> : null}
                              {ann.has_file ? <a href={`/api/dept-announcements?file_id=${ann.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A]">📎 {ann.file_name || 'ดาวน์โหลด'}</a> : null}
                            </div>
                          )}
                          <p className="text-[10px] text-gray-300 mt-1">โดย {ann.created_by} · {new Date(ann.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub-tab: กฎแผนก */}
            {annSubTab === 'rules' && (
              <div className="p-5 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-[#1E3A5F] mb-4">📋 เพิ่มกฎแผนก</h2>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#374151] mb-1">แผนก *</label>
                        <select
                          value={deptRuleForm.department}
                          onChange={(e) => setDeptRuleForm((f) => ({ ...f, department: e.target.value }))}
                          className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                        >
                          <option value="">-- เลือกแผนก --</option>
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#374151] mb-1">ลำดับที่</label>
                        <input
                          type="number"
                          value={deptRuleForm.sort_order}
                          onChange={(e) => setDeptRuleForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                          min={0}
                          className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">หัวข้อกฎ *</label>
                      <input
                        type="text"
                        value={deptRuleForm.title}
                        onChange={(e) => setDeptRuleForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="หัวข้อกฎ..."
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">เนื้อหากฎ</label>
                      <textarea
                        value={deptRuleForm.content}
                        onChange={(e) => setDeptRuleForm((f) => ({ ...f, content: e.target.value }))}
                        placeholder="รายละเอียดกฎ..."
                        rows={3}
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">ผู้บันทึก</label>
                      <input
                        type="text"
                        value={deptRuleForm.created_by}
                        onChange={(e) => setDeptRuleForm((f) => ({ ...f, created_by: e.target.value }))}
                        placeholder="HR..."
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">แนบรูปภาพ (ไม่บังคับ)</label>
                      <input type="file" accept="image/*"
                        onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; compressImage(f).then((data) => setDeptRuleForm((s) => ({ ...s, image_data: data, image_name: f.name }))) }}
                        className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1E3A5F]/10 file:text-[#1E3A5F]"
                      />
                      {deptRuleForm.image_data && (
                        <div className="mt-2 relative inline-block">
                          <img src={deptRuleForm.image_data} alt="preview" className="h-16 w-auto rounded-lg border border-[#E2E8F0] object-cover" />
                          <button onClick={() => setDeptRuleForm((f) => ({ ...f, image_data: '', image_name: '' }))} className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#374151] mb-1">แนบไฟล์ PDF / เอกสาร (ไม่บังคับ)</label>
                      <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setDeptRuleForm((s) => ({ ...s, file_data: ev.target?.result as string || '', file_name: f.name })); r.readAsDataURL(f) }}
                        className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#16A34A]/10 file:text-[#16A34A]"
                      />
                      {deptRuleForm.file_data && (
                        <div className="mt-2 flex items-center gap-2 bg-[#F5F6F8] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151]">
                          <span className="truncate flex-1">📎 {deptRuleForm.file_name}</span>
                          <button onClick={() => setDeptRuleForm((f) => ({ ...f, file_data: '', file_name: '' }))} className="bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shrink-0">×</button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (!deptRuleForm.department.trim() || !deptRuleForm.title.trim()) return
                        setSubmittingDeptRule(true)
                        try {
                          const res = await fetch(`/api/dept-rules?key=${ADMIN_KEY}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(deptRuleForm),
                          })
                          if (res.ok) {
                            const data = await res.json()
                            const now = new Date().toISOString()
                            setDeptRules((prev) => [...prev, { id: data.id, ...deptRuleForm, is_active: 1, created_at: now }].sort((a, b) => a.department.localeCompare(b.department, 'th') || a.sort_order - b.sort_order))
                            setDeptRuleForm({ department: '', title: '', content: '', sort_order: 0, created_by: 'HR', image_data: '', image_name: '', file_data: '', file_name: '' })
                          }
                        } catch { /* silent */ } finally { setSubmittingDeptRule(false) }
                      }}
                      disabled={submittingDeptRule || !deptRuleForm.department.trim() || !deptRuleForm.title.trim()}
                      className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
                    >
                      {submittingDeptRule ? 'กำลังบันทึก...' : 'เพิ่มกฎ'}
                    </button>
                  </div>
                </div>
                <div className="border-t border-[#E2E8F0] pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-[#1E3A5F]">กฎทั้งหมด</h2>
                    <span className="text-xs text-gray-400">{deptRules.length} ข้อ</span>
                  </div>
                  {loadingDeptRules ? (
                    <div className="py-8 text-center text-gray-400 text-sm">กำลังโหลด...</div>
                  ) : deptRules.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-sm">ยังไม่มีกฎ</div>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(
                        deptRules.reduce<Record<string, typeof deptRules>>((acc, r) => {
                          if (!acc[r.department]) acc[r.department] = []
                          acc[r.department].push(r)
                          return acc
                        }, {})
                      ).map(([dept, rules]) => (
                        <div key={dept} className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                          <div className="px-3 py-2 bg-[#F5F6F8] flex items-center justify-between">
                            <p className="text-xs font-bold text-[#1E3A5F]">{dept}</p>
                            <span className="text-[10px] text-gray-400">{rules.length} ข้อ</span>
                          </div>
                          <div className="divide-y divide-[#E2E8F0]">
                            {rules.map((rule, idx) => (
                              <div key={rule.id} className="p-3 flex items-start gap-3">
                                <div className="shrink-0 w-5 h-5 rounded-full bg-[#1E3A5F] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-[#374151]">{rule.title}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{rule.content}</p>
                                  {(rule.has_image || rule.has_file) && (
                                    <div className="flex gap-2 mt-1.5 flex-wrap">
                                      {rule.has_image ? <a href={`/api/dept-rules?image_id=${rule.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F]">🖼️ ดูรูป</a> : null}
                                      {rule.has_file ? <a href={`/api/dept-rules?file_id=${rule.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#16A34A]/10 text-[#16A34A]">📎 {rule.file_name || 'ดาวน์โหลด'}</a> : null}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={async () => {
                                      const res = await fetch(`/api/dept-rules?admin_id=${rule.id}&key=${ADMIN_KEY}`)
                                      if (!res.ok) return
                                      const data = await res.json()
                                      setEditingDeptRule({ id: data.id, department: data.department, title: data.title, content: data.content, sort_order: data.sort_order, created_by: data.created_by, image_data: data.image_data || '', image_name: data.image_name || '', file_data: data.file_data || '', file_name: data.file_name || '' })
                                    }}
                                    className="text-xs px-2 py-1 rounded-lg bg-[#1E3A5F]/10 text-[#1E3A5F] hover:bg-[#1E3A5F]/20"
                                  >
                                    แก้ไข
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (!confirm('ลบกฎนี้?')) return
                                      setDeletingDeptRuleId(rule.id)
                                      try {
                                        const res = await fetch(`/api/dept-rules?key=${ADMIN_KEY}&id=${rule.id}`, { method: 'DELETE' })
                                        if (res.ok) setDeptRules((prev) => prev.filter((r) => r.id !== rule.id))
                                      } catch { /* silent */ } finally { setDeletingDeptRuleId(null) }
                                    }}
                                    disabled={deletingDeptRuleId === rule.id}
                                    className="text-xs px-2 py-1 rounded-lg bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20 disabled:opacity-50"
                                  >
                                    {deletingDeptRuleId === rule.id ? '...' : 'ลบ'}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal — ประกาศสำคัญ */}
      {editingAnn && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingAnn(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="font-bold text-[#1E3A5F] text-base">แก้ไขประกาศ</h2>
              <button onClick={() => setEditingAnn(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">หัวข้อประกาศ *</label>
                <input type="text" value={editingAnn.title} onChange={(e) => setEditingAnn((f) => f ? { ...f, title: e.target.value } : f)} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">เนื้อหา</label>
                <textarea value={editingAnn.content} onChange={(e) => setEditingAnn((f) => f ? { ...f, content: e.target.value } : f)} rows={4} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แนบรูปภาพ (ไม่บังคับ)</label>
                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; compressImage(file).then((data) => setEditingAnn((f) => f ? { ...f, image_data: data, file_name: file.name } : f)) }} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1E3A5F]/10 file:text-[#1E3A5F]" />
                {editingAnn.image_data && (
                  <div className="mt-2 relative inline-block">
                    <img src={editingAnn.image_data} alt="preview" className="h-20 w-auto rounded-lg border border-[#E2E8F0] object-cover" />
                    <button onClick={() => setEditingAnn((f) => f ? { ...f, image_data: '', file_name: '' } : f)} className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แนบไฟล์ PDF / เอกสาร (ไม่บังคับ)</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = (ev) => setEditingAnn((f) => f ? { ...f, file_data: ev.target?.result as string || '', attached_file_name: file.name } : f); r.readAsDataURL(file) }} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#16A34A]/10 file:text-[#16A34A]" />
                {editingAnn.attached_file_name && (
                  <div className="mt-2 flex items-center gap-2 bg-[#F5F6F8] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151]">
                    <span className="truncate flex-1">📎 {editingAnn.attached_file_name}</span>
                    <button onClick={() => setEditingAnn((f) => f ? { ...f, file_data: '', attached_file_name: '' } : f)} className="bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shrink-0">×</button>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingAnn.is_pinned} onChange={(e) => setEditingAnn((f) => f ? { ...f, is_pinned: e.target.checked } : f)} className="w-4 h-4 accent-[#1E3A5F]" />
                <span className="text-sm text-[#374151]">📌 ปักหมุด</span>
              </label>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setEditingAnn(null)} disabled={savingEditAnn} className="flex-1 border border-[#E2E8F0] text-[#374151] py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">ยกเลิก</button>
              <button onClick={handleSaveEditAnn} disabled={savingEditAnn || !editingAnn.title.trim()} className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">{savingEditAnn ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — กฎบริษัท */}
      {editingCompanyRule && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingCompanyRule(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="font-bold text-[#1E3A5F] text-base">แก้ไขกฎบริษัท</h2>
              <button onClick={() => setEditingCompanyRule(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">หัวข้อกฎ *</label>
                <input type="text" value={editingCompanyRule.title} onChange={(e) => setEditingCompanyRule((f) => f ? { ...f, title: e.target.value } : f)} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">เนื้อหากฎ</label>
                <textarea value={editingCompanyRule.content} onChange={(e) => setEditingCompanyRule((f) => f ? { ...f, content: e.target.value } : f)} rows={3} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">ลำดับที่</label>
                <input type="number" value={editingCompanyRule.sort_order} onChange={(e) => setEditingCompanyRule((f) => f ? { ...f, sort_order: Number(e.target.value) } : f)} min={0} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แนบรูปภาพใหม่ (ไม่บังคับ)</label>
                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; compressImage(file).then((data) => setEditingCompanyRule((f) => f ? { ...f, image_data: data, image_name: file.name } : f)) }} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1E3A5F]/10 file:text-[#1E3A5F]" />
                {editingCompanyRule.image_data && (
                  <div className="mt-2 relative inline-block">
                    <img src={editingCompanyRule.image_data} alt="preview" className="h-16 w-auto rounded-lg border border-[#E2E8F0] object-cover" />
                    <button onClick={() => setEditingCompanyRule((f) => f ? { ...f, image_data: '', image_name: '' } : f)} className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แนบไฟล์ PDF / เอกสาร (ไม่บังคับ)</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = (ev) => setEditingCompanyRule((f) => f ? { ...f, file_data: ev.target?.result as string || '', file_name: file.name } : f); r.readAsDataURL(file) }} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#16A34A]/10 file:text-[#16A34A]" />
                {editingCompanyRule.file_name && editingCompanyRule.file_data && (
                  <div className="mt-2 flex items-center gap-2 bg-[#F5F6F8] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151]">
                    <span className="truncate flex-1">📎 {editingCompanyRule.file_name}</span>
                    <button onClick={() => setEditingCompanyRule((f) => f ? { ...f, file_data: '', file_name: '' } : f)} className="bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shrink-0">×</button>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setEditingCompanyRule(null)} disabled={savingEditCompanyRule} className="flex-1 border border-[#E2E8F0] text-[#374151] py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">ยกเลิก</button>
              <button onClick={handleSaveEditCompanyRule} disabled={savingEditCompanyRule || !editingCompanyRule.title.trim()} className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">{savingEditCompanyRule ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — ประกาศแผนก */}
      {editingDeptAnn && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingDeptAnn(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="font-bold text-[#1E3A5F] text-base">แก้ไขประกาศแผนก</h2>
              <button onClick={() => setEditingDeptAnn(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แผนก</label>
                <p className="text-sm text-[#374151] font-semibold px-3 py-2 bg-[#F5F6F8] rounded-xl">{editingDeptAnn.department}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">หัวข้อ *</label>
                <input type="text" value={editingDeptAnn.title} onChange={(e) => setEditingDeptAnn((f) => f ? { ...f, title: e.target.value } : f)} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">เนื้อหา</label>
                <textarea value={editingDeptAnn.content} onChange={(e) => setEditingDeptAnn((f) => f ? { ...f, content: e.target.value } : f)} rows={4} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แนบรูปภาพใหม่ (ไม่บังคับ)</label>
                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; compressImage(file).then((data) => setEditingDeptAnn((f) => f ? { ...f, image_data: data, image_name: file.name } : f)) }} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1E3A5F]/10 file:text-[#1E3A5F]" />
                {editingDeptAnn.image_data && (
                  <div className="mt-2 relative inline-block">
                    <img src={editingDeptAnn.image_data} alt="preview" className="h-16 w-auto rounded-lg border border-[#E2E8F0] object-cover" />
                    <button onClick={() => setEditingDeptAnn((f) => f ? { ...f, image_data: '', image_name: '' } : f)} className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แนบไฟล์ PDF / เอกสาร (ไม่บังคับ)</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = (ev) => setEditingDeptAnn((f) => f ? { ...f, file_data: ev.target?.result as string || '', file_name: file.name } : f); r.readAsDataURL(file) }} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#16A34A]/10 file:text-[#16A34A]" />
                {editingDeptAnn.file_name && editingDeptAnn.file_data && (
                  <div className="mt-2 flex items-center gap-2 bg-[#F5F6F8] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151]">
                    <span className="truncate flex-1">📎 {editingDeptAnn.file_name}</span>
                    <button onClick={() => setEditingDeptAnn((f) => f ? { ...f, file_data: '', file_name: '' } : f)} className="bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shrink-0">×</button>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setEditingDeptAnn(null)} disabled={savingEditDeptAnn} className="flex-1 border border-[#E2E8F0] text-[#374151] py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">ยกเลิก</button>
              <button onClick={handleSaveEditDeptAnn} disabled={savingEditDeptAnn || !editingDeptAnn.title.trim()} className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">{savingEditDeptAnn ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — กฎแผนก */}
      {editingDeptRule && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditingDeptRule(null) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="font-bold text-[#1E3A5F] text-base">แก้ไขกฎแผนก</h2>
              <button onClick={() => setEditingDeptRule(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แผนก</label>
                <p className="text-sm text-[#374151] font-semibold px-3 py-2 bg-[#F5F6F8] rounded-xl">{editingDeptRule.department}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">หัวข้อกฎ *</label>
                <input type="text" value={editingDeptRule.title} onChange={(e) => setEditingDeptRule((f) => f ? { ...f, title: e.target.value } : f)} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">เนื้อหากฎ</label>
                <textarea value={editingDeptRule.content} onChange={(e) => setEditingDeptRule((f) => f ? { ...f, content: e.target.value } : f)} rows={3} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">ลำดับที่</label>
                <input type="number" value={editingDeptRule.sort_order} onChange={(e) => setEditingDeptRule((f) => f ? { ...f, sort_order: Number(e.target.value) } : f)} min={0} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แนบรูปภาพใหม่ (ไม่บังคับ)</label>
                <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; compressImage(file).then((data) => setEditingDeptRule((f) => f ? { ...f, image_data: data, image_name: file.name } : f)) }} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#1E3A5F]/10 file:text-[#1E3A5F]" />
                {editingDeptRule.image_data && (
                  <div className="mt-2 relative inline-block">
                    <img src={editingDeptRule.image_data} alt="preview" className="h-16 w-auto rounded-lg border border-[#E2E8F0] object-cover" />
                    <button onClick={() => setEditingDeptRule((f) => f ? { ...f, image_data: '', image_name: '' } : f)} className="absolute -top-1.5 -right-1.5 bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">×</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แนบไฟล์ PDF / เอกสาร (ไม่บังคับ)</label>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = (ev) => setEditingDeptRule((f) => f ? { ...f, file_data: ev.target?.result as string || '', file_name: file.name } : f); r.readAsDataURL(file) }} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#16A34A]/10 file:text-[#16A34A]" />
                {editingDeptRule.file_name && editingDeptRule.file_data && (
                  <div className="mt-2 flex items-center gap-2 bg-[#F5F6F8] border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#374151]">
                    <span className="truncate flex-1">📎 {editingDeptRule.file_name}</span>
                    <button onClick={() => setEditingDeptRule((f) => f ? { ...f, file_data: '', file_name: '' } : f)} className="bg-[#DC2626] text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shrink-0">×</button>
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setEditingDeptRule(null)} disabled={savingEditDeptRule} className="flex-1 border border-[#E2E8F0] text-[#374151] py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">ยกเลิก</button>
              <button onClick={handleSaveEditDeptRule} disabled={savingEditDeptRule || !editingDeptRule.title.trim()} className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">{savingEditDeptRule ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tcg-rewards' && (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-base font-bold text-[#1E3A5F] mb-4">🎁 ตั้งค่ารางวัล TCG ประจำเดือน</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">เลือกเกม</label>
                <select
                  value={tcgRewardGame}
                  onChange={(e) => {
                    setTcgRewardGame(e.target.value)
                    setTcgRewardInputs({})
                    setTcgRewardImages({})
                    setTcgRewardMsg('')
                    if (e.target.value) {
                      fetch(`/api/tcg/game-rewards?game_id=${e.target.value}&month=${tcgRewardMonth}`)
                        .then((r) => r.json())
                        .then((rows) => {
                          if (Array.isArray(rows)) {
                            const m: Record<string, string> = {}
                            const imgs: Record<string, string> = {}
                            rows.forEach((row: { tier: string; reward_text: string; image_url?: string }) => {
                              m[row.tier] = row.reward_text
                              if (row.image_url) imgs[row.tier] = row.image_url
                            })
                            setTcgRewardInputs(m)
                            setTcgRewardImages(imgs)
                          }
                        }).catch(() => {})
                    }
                  }}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
                >
                  <option value="">— เลือกเกม —</option>
                  {tcgGames.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">เดือน</label>
                <input
                  type="month"
                  value={tcgRewardMonth}
                  onChange={(e) => {
                    setTcgRewardMonth(e.target.value)
                    setTcgRewardInputs({})
                    setTcgRewardImages({})
                    setTcgRewardMsg('')
                    if (tcgRewardGame && e.target.value) {
                      fetch(`/api/tcg/game-rewards?game_id=${tcgRewardGame}&month=${e.target.value}`)
                        .then((r) => r.json())
                        .then((rows) => {
                          if (Array.isArray(rows)) {
                            const m: Record<string, string> = {}
                            const imgs: Record<string, string> = {}
                            rows.forEach((row: { tier: string; reward_text: string; image_url?: string }) => {
                              m[row.tier] = row.reward_text
                              if (row.image_url) imgs[row.tier] = row.image_url
                            })
                            setTcgRewardInputs(m)
                            setTcgRewardImages(imgs)
                          }
                        }).catch(() => {})
                    }
                  }}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
            </div>
            {tcgRewardGame && (
              <div className="mt-4 space-y-3">
                <p className="text-xs font-semibold text-[#374151]">กรอกรางวัลแต่ละ Tier</p>
                {['Special', 'S', 'A', 'B', 'C', 'D', 'E'].map((tier) => (
                  <div key={tier} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`w-16 text-center text-xs font-bold py-1 rounded-lg shrink-0 ${
                        tier === 'Special' ? 'bg-yellow-400 text-white' :
                        tier === 'S' ? 'bg-[#1E3A5F] text-white' :
                        tier === 'A' ? 'bg-purple-600 text-white' :
                        tier === 'B' ? 'bg-[#16A34A] text-white' :
                        tier === 'C' ? 'bg-blue-500 text-white' :
                        tier === 'D' ? 'bg-gray-500 text-white' :
                        'bg-gray-200 text-gray-600'
                      }`}>{tier}</span>
                      <input
                        value={tcgRewardInputs[tier] || ''}
                        onChange={(e) => setTcgRewardInputs((prev) => ({ ...prev, [tier]: e.target.value }))}
                        placeholder={tier === 'Special' ? 'รางวัลพิเศษ อันดับ 1...' : `รางวัล Tier ${tier}...`}
                        className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1E3A5F]"
                      />
                    </div>
                    <div className="flex items-center gap-2 pl-[76px]">
                      {tcgRewardImages[tier] && (
                        <div className="relative shrink-0">
                          <img src={tcgRewardImages[tier]} alt={`รูป ${tier}`} className="w-16 h-16 object-cover rounded-lg border border-[#E2E8F0]" />
                          <button
                            type="button"
                            onClick={() => setTcgRewardImages((prev) => { const n = { ...prev }; delete n[tier]; return n })}
                            className="absolute -top-1 -right-1 w-5 h-5 bg-[#DC2626] text-white rounded-full text-[10px] flex items-center justify-center leading-none"
                          >✕</button>
                        </div>
                      )}
                      <label className="cursor-pointer text-xs text-[#1E3A5F] border border-[#E2E8F0] rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors">
                        📷 {tcgRewardImages[tier] ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const reader = new FileReader()
                            reader.onload = (ev) => {
                              setTcgRewardImages((prev) => ({ ...prev, [tier]: ev.target?.result as string }))
                            }
                            reader.readAsDataURL(file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
                {tcgRewardMsg && (
                  <p className={`text-sm font-medium ${tcgRewardMsg.includes('สำเร็จ') ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{tcgRewardMsg}</p>
                )}
                <button
                  disabled={tcgRewardSaving}
                  onClick={async () => {
                    setTcgRewardSaving(true)
                    setTcgRewardMsg('')
                    try {
                      for (const tier of ['Special', 'S', 'A', 'B', 'C', 'D', 'E']) {
                        await fetch('/api/tcg/game-rewards', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ game_id: tcgRewardGame, month: tcgRewardMonth, tier, reward_text: tcgRewardInputs[tier] || '', image_url: tcgRewardImages[tier] || '' }),
                        })
                      }
                      setTcgRewardMsg('บันทึกรางวัลสำเร็จ!')
                    } catch { setTcgRewardMsg('เกิดข้อผิดพลาด กรุณาลองใหม่') }
                    finally { setTcgRewardSaving(false) }
                  }}
                  className="w-full py-3 bg-[#1E3A5F] text-white text-sm font-bold rounded-2xl disabled:opacity-50"
                >
                  {tcgRewardSaving ? 'กำลังบันทึก...' : 'บันทึกรางวัล'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TCG Members Tab */}
      {activeTab === 'tcg-members' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1E3A5F]">👥 รายชื่อสมาชิก TCG</h2>
                <p className="text-sm text-[#374151] mt-1">สมาชิกทั้งหมด {tcgMembers.length} คน</p>
              </div>
              <button
                onClick={() => {
                  setTcgMembersLoading(true)
                  fetch('/api/tcg/members?branch=gap7card')
                    .then(r => r.json())
                    .then(data => { if (Array.isArray(data)) setTcgMembers(data) })
                    .catch(() => {})
                    .finally(() => setTcgMembersLoading(false))
                }}
                className="px-4 py-2 bg-[#1E3A5F] text-white text-sm font-semibold rounded-xl"
              >
                🔄 รีเฟรช
              </button>
            </div>
            <input
              type="text"
              placeholder="ค้นหาชื่อ ฉายา หรือเบอร์โทร..."
              value={tcgMembersSearch}
              onChange={e => setTcgMembersSearch(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
            />
            {tcgMembersLoading ? (
              <p className="text-center text-sm text-[#374151] py-8">กำลังโหลด...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] text-[#374151]">
                      <th className="text-left py-2 px-3 font-semibold">#</th>
                      <th className="text-left py-2 px-3 font-semibold">ชื่อ-นามสกุล</th>
                      <th className="text-left py-2 px-3 font-semibold">ฉายา</th>
                      <th className="text-left py-2 px-3 font-semibold">เบอร์โทร</th>
                      <th className="text-left py-2 px-3 font-semibold">วันเกิด</th>
                      <th className="text-left py-2 px-3 font-semibold">วันสมัคร</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tcgMembers
                      .filter(m => {
                        const q = tcgMembersSearch.toLowerCase()
                        return !q || m.full_name.toLowerCase().includes(q) || m.nickname.toLowerCase().includes(q) || m.phone.includes(q)
                      })
                      .map((m, i) => (
                        <tr key={m.id} className="border-b border-[#E2E8F0] hover:bg-[#F5F6F8]">
                          <td className="py-2 px-3 text-[#374151]">{i + 1}</td>
                          <td className="py-2 px-3 font-medium text-[#1E3A5F]">{m.full_name}</td>
                          <td className="py-2 px-3 text-[#374151]">{m.nickname}</td>
                          <td className="py-2 px-3 text-[#374151]">{m.phone}</td>
                          <td className="py-2 px-3 text-[#374151]">{m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td className="py-2 px-3 text-[#374151]">{new Date(m.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        </tr>
                      ))}
                    {tcgMembers.length === 0 && !tcgMembersLoading && (
                      <tr><td colSpan={6} className="text-center py-8 text-[#374151]">ยังไม่มีสมาชิก</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TCG Bookings Tab */}
      {activeTab === 'tcg-bookings' && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#1E3A5F]">คำขอจองเวลาเล่น TCG</h2>
              <p className="text-sm text-gray-400 mt-0.5">{tcgBookings.length} รายการ</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => shiftTcgMonth(-1)} className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-[#374151] font-bold flex items-center justify-center text-sm">‹</button>
              <span className="text-sm font-semibold text-[#1E3A5F] min-w-[120px] text-center">{formatTcgMonth(tcgBookingsMonth)}</span>
              <button onClick={() => shiftTcgMonth(1)} className="w-8 h-8 rounded-lg border border-[#E2E8F0] text-[#374151] font-bold flex items-center justify-center text-sm">›</button>
            </div>
          </div>

          {tcgBookingsLoading ? (
            <div className="bg-white rounded-2xl py-16 text-center text-gray-400 text-sm shadow-sm">กำลังโหลด...</div>
          ) : tcgBookings.length === 0 ? (
            <div className="bg-white rounded-2xl py-16 text-center text-gray-400 text-sm shadow-sm">ไม่มีคำขอจองในเดือนนี้</div>
          ) : (() => {
            const grouped: Record<string, typeof tcgBookings> = {}
            for (const b of tcgBookings) {
              if (!grouped[b.date]) grouped[b.date] = []
              grouped[b.date].push(b)
            }
            return (
              <div className="space-y-6">
                {Object.entries(grouped).map(([date, items]) => (
                  <div key={date} className="space-y-3">
                    <p className="text-xs font-bold text-[#374151] uppercase tracking-wide">{formatThaiDateAdmin(date)}</p>
                    {items.map((b) => {
                      const statusBadge =
                        b.status === 'confirmed' ? { label: 'อนุมัติแล้ว', cls: 'bg-green-50 border-green-200 text-[#16A34A]' } :
                        b.status === 'cancelled' ? { label: 'ปฏิเสธแล้ว', cls: 'bg-red-50 border-red-200 text-[#DC2626]' } :
                        { label: 'รอยืนยัน', cls: 'bg-yellow-50 border-yellow-200 text-yellow-700' }

                      async function updateStatus(status: string) {
                        await fetch('/api/tcg/bookings', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: b.id, status }),
                        })
                        setTcgBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, status } : x))
                      }

                      return (
                        <div key={b.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-[#1E3A5F]">{b.name}</p>
                              <p className="text-sm text-gray-500">{b.phone}</p>
                            </div>
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusBadge.cls}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-gray-400">เวลา</p>
                              <p className="font-semibold text-[#374151]">{String(b.start_hour).padStart(2,'0')}:00 – {String(b.start_hour + b.duration).padStart(2,'0')}:00 น.</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-400">จำนวน</p>
                              <p className="font-semibold text-[#374151]">{b.people} คน</p>
                            </div>
                          </div>
                          {b.note && (
                            <p className="text-sm text-gray-500 bg-[#F5F6F8] rounded-xl px-3 py-2">💬 {b.note}</p>
                          )}
                          {b.status === 'pending' && (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => updateStatus('confirmed')}
                                className="flex-1 py-2.5 bg-[#16A34A] text-white text-sm font-bold rounded-xl"
                              >
                                ✅ อนุมัติ
                              </button>
                              <button
                                onClick={() => updateStatus('cancelled')}
                                className="flex-1 py-2.5 bg-[#DC2626] text-white text-sm font-bold rounded-xl"
                              >
                                ❌ ปฏิเสธ
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}
      {extendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-[#1E3A5F] text-lg">ต่อโปรโมชัน</h3>
            <p className="text-sm text-gray-500">{extendModal.promo.product_name}</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-[#374151]">เดือนเริ่มต้น</label>
                <input
                  type="month"
                  value={extendModal.startMonth}
                  onChange={(e) => setExtendModal((prev) => prev ? { ...prev, startMonth: e.target.value } : null)}
                  className="mt-1 w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#374151]">เดือนสิ้นสุด</label>
                <input
                  type="month"
                  value={extendModal.endMonth}
                  onChange={(e) => setExtendModal((prev) => prev ? { ...prev, endMonth: e.target.value } : null)}
                  className="mt-1 w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setExtendModal(null)}
                className="flex-1 py-2 rounded-xl border border-[#E2E8F0] text-sm text-gray-500"
              >ยกเลิก</button>
              <button
                disabled={extendingPromoId === extendModal.promo.id}
                onClick={async () => {
                  const { promo, startMonth, endMonth } = extendModal
                  setExtendingPromoId(promo.id)
                  try {
                    const res = await fetch('/api/promo-threshold', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        nickname: promo.nickname,
                        product_name: promo.product_name,
                        threshold_amount: promo.threshold_amount,
                        start_month: startMonth,
                        end_month: endMonth,
                        note: promo.note || '',
                        copy_from: promo.id,
                      }),
                    })
                    if (res.ok) {
                      const data = await res.json()
                      const now = new Date().toISOString()
                      setPromoThresholds((prev) => [{
                        id: data.id, nickname: promo.nickname, product_name: promo.product_name,
                        threshold_amount: promo.threshold_amount, start_month: startMonth,
                        end_month: endMonth, note: promo.note, has_image: promo.has_image,
                        status: 'pending', created_at: now, acknowledged_at: null,
                      }, ...prev])
                      setExtendModal(null)
                    }
                  } catch { /* silent */ } finally { setExtendingPromoId(null) }
                }}
                className="flex-1 py-2 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-60"
              >
                {extendingPromoId === extendModal.promo.id ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
