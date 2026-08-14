'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DEPARTMENTS } from '@/types/kpi'

function getTodayDate() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function getCurrentTime() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000

function isCodeVerifiedLocally(department: string): boolean {
  try {
    const raw = localStorage.getItem(`code_verified_${department}`)
    if (!raw) return false
    return Date.now() - Number(raw) < TEN_DAYS_MS
  } catch { return false }
}

function saveCodeVerified(department: string) {
  try { localStorage.setItem(`code_verified_${department}`, String(Date.now())) } catch { /* */ }
}

const DRAFT_KEY = 'kpi_draft'
const DEPT_KEY = 'kpi_dept'
function saveDraft(data: FormData) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)) } catch { /* */ }
}
function loadDraft(): FormData | null {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* */ }
}

interface ExtraData {
  // ไลฟ์สด
  liveHours: string
  salesAmount: string
  // Creative
  clipLinks: string[]
  // การตลาด — เดิม (backward compat)
  adsShopee: string
  adsLazada: string
  adsTiktok: string
  adsFacebook: string
  // แพค
  packCount: string
}

const defaultExtraData: ExtraData = {
  liveHours: '',
  salesAmount: '',
  clipLinks: [''],
  adsShopee: '',
  adsLazada: '',
  adsTiktok: '',
  adsFacebook: '',
  packCount: '',
}

interface FormData {
  department: string
  date: string
  time: string
  nickname: string
  channelName: string[]
  bestRoiChannel: string
  tasks: string[]
  obstacles: string
  extraData: ExtraData
}

type PageState = 'form' | 'confirm' | 'submitting' | 'success'

interface LiveStaffMember {
  id: string
  name: string
  rank_name: string
  rank_emoji: string
  rank_order: number
  department?: string
  is_head?: number
  badge_emoji?: string
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#374151]">{value}</p>
    </div>
  )
}

function InputField({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#374151] mb-2">
        {label} {required && <span className="text-[#DC2626]">*</span>}
      </label>
      {children}
      {error && <p className="text-[#DC2626] text-xs mt-1">{error}</p>}
    </div>
  )
}

const inputClass =
  'w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]'

const CHANNEL_DEPTS = ['ไลฟ์สด', 'Sales Admin', 'การตลาด', 'Creative']
const CHANNEL_LIST = [
  'gap7cardbreak', 'pokedex', 'nanatoshop', 'jokercardshop',
  'ninjabearcardshop', 'rabbitcardshop', 'littleponycardshop', 'stadiumbreaks',
  'crazycardshop', 'catramencardshop', 'dekocardshop', 'phoenixcardshop',
  'pandacollectorshop', 'huskkycardshop', 'kingdomcardshop',
  'corgi card TCG', 'mojiko card TCG',
]
const LIVE_DEPTS = ['ไลฟ์สด', 'Sales Admin']
const ALL_RANKS = [
  { rank_order: 1, rank_name: 'Junior Live Sales', rank_emoji: '🥉' },
  { rank_order: 2, rank_name: 'Live Sales', rank_emoji: '🥈' },
  { rank_order: 3, rank_name: 'Senior Live Sales', rank_emoji: '🥇' },
  { rank_order: 4, rank_name: 'Expert Live Sales', rank_emoji: '🏅' },
  { rank_order: 5, rank_name: 'Master Live Sales', rank_emoji: '🏆' },
  { rank_order: 6, rank_name: 'Elite Live Sales', rank_emoji: '💠' },
  { rank_order: 7, rank_name: 'Legend Live Sales', rank_emoji: '💎' },
  { rank_order: 8, rank_name: 'Grandmaster Live Sales', rank_emoji: '👑' },
]
const CREATIVE_RANKS = [
  { rank_order: 1, rank_name: 'Junior Creative', rank_emoji: '🥉' },
  { rank_order: 2, rank_name: 'Creative', rank_emoji: '🥈' },
  { rank_order: 3, rank_name: 'Senior Creative', rank_emoji: '🥇' },
  { rank_order: 4, rank_name: 'Expert Creative', rank_emoji: '🏅' },
  { rank_order: 5, rank_name: 'Master Creative', rank_emoji: '🏆' },
  { rank_order: 6, rank_name: 'Elite Creative', rank_emoji: '💠' },
  { rank_order: 7, rank_name: 'Legend Creative', rank_emoji: '💎' },
  { rank_order: 8, rank_name: 'Grandmaster Creative', rank_emoji: '👑' },
]
const MARKETING_RANKS = [
  { rank_order: 1, rank_name: 'Junior Marketing', rank_emoji: '🥉' },
  { rank_order: 2, rank_name: 'Marketing', rank_emoji: '🥈' },
  { rank_order: 3, rank_name: 'Senior Marketing', rank_emoji: '🥇' },
  { rank_order: 4, rank_name: 'Expert Marketing', rank_emoji: '🏅' },
  { rank_order: 5, rank_name: 'Master Marketing', rank_emoji: '🏆' },
  { rank_order: 6, rank_name: 'Elite Marketing', rank_emoji: '💠' },
  { rank_order: 7, rank_name: 'Legend Marketing', rank_emoji: '💎' },
  { rank_order: 8, rank_name: 'Grandmaster Marketing', rank_emoji: '👑' },
]
const SALE_ADMIN_RANKS = [
  { rank_order: 1, rank_name: 'Junior Sales Admin', rank_emoji: '🥉' },
  { rank_order: 2, rank_name: 'Sales Admin', rank_emoji: '🥈' },
  { rank_order: 3, rank_name: 'Senior Sales Admin', rank_emoji: '🥇' },
  { rank_order: 4, rank_name: 'Expert Sales Admin', rank_emoji: '🏅' },
  { rank_order: 5, rank_name: 'Master Sales Admin', rank_emoji: '🏆' },
  { rank_order: 6, rank_name: 'Elite Sales Admin', rank_emoji: '💠' },
  { rank_order: 7, rank_name: 'Legend Sales Admin', rank_emoji: '💎' },
  { rank_order: 8, rank_name: 'Grandmaster Sales Admin', rank_emoji: '👑' },
]
const STORE_RETAIL_RANKS = [
  { rank_order: 1, rank_name: 'Junior Store Retail', rank_emoji: '🥉' },
  { rank_order: 2, rank_name: 'Store Retail', rank_emoji: '🥈' },
  { rank_order: 3, rank_name: 'Senior Store Retail', rank_emoji: '🥇' },
  { rank_order: 4, rank_name: 'Expert Store Retail', rank_emoji: '🏅' },
  { rank_order: 5, rank_name: 'Master Store Retail', rank_emoji: '🏆' },
  { rank_order: 6, rank_name: 'Elite Store Retail', rank_emoji: '💠' },
  { rank_order: 7, rank_name: 'Legend Store Retail', rank_emoji: '💎' },
  { rank_order: 8, rank_name: 'Grandmaster Store Retail', rank_emoji: '👑' },
]
const STORE_MANAGER_RANKS = [
  { rank_order: 1, rank_name: 'Junior Store Manager', rank_emoji: '🥉' },
  { rank_order: 2, rank_name: 'Store Manager', rank_emoji: '🥈' },
  { rank_order: 3, rank_name: 'Senior Store Manager', rank_emoji: '🥇' },
  { rank_order: 4, rank_name: 'Expert Store Manager', rank_emoji: '🏅' },
  { rank_order: 5, rank_name: 'Master Store Manager', rank_emoji: '🏆' },
  { rank_order: 6, rank_name: 'Elite Store Manager', rank_emoji: '💠' },
  { rank_order: 7, rank_name: 'Legend Store Manager', rank_emoji: '💎' },
  { rank_order: 8, rank_name: 'Grandmaster Store Manager', rank_emoji: '👑' },
]
const STOCK_PURCHASING_RANKS = [
  { rank_order: 1, rank_name: 'Junior Stock & Purchasing', rank_emoji: '🥉' },
  { rank_order: 2, rank_name: 'Stock & Purchasing', rank_emoji: '🥈' },
  { rank_order: 3, rank_name: 'Senior Stock & Purchasing', rank_emoji: '🥇' },
  { rank_order: 4, rank_name: 'Expert Stock & Purchasing', rank_emoji: '🏅' },
  { rank_order: 5, rank_name: 'Master Stock & Purchasing', rank_emoji: '🏆' },
  { rank_order: 6, rank_name: 'Elite Stock & Purchasing', rank_emoji: '💠' },
  { rank_order: 7, rank_name: 'Legend Stock & Purchasing', rank_emoji: '💎' },
  { rank_order: 8, rank_name: 'Grandmaster Stock & Purchasing', rank_emoji: '👑' },
]
const FULFILLMENT_RANKS = [
  { rank_order: 1, rank_name: 'Junior Fulfillment', rank_emoji: '🥉' },
  { rank_order: 2, rank_name: 'Fulfillment', rank_emoji: '🥈' },
  { rank_order: 3, rank_name: 'Senior Fulfillment', rank_emoji: '🥇' },
  { rank_order: 4, rank_name: 'Expert Fulfillment', rank_emoji: '🏅' },
  { rank_order: 5, rank_name: 'Master Fulfillment', rank_emoji: '🏆' },
  { rank_order: 6, rank_name: 'Elite Fulfillment', rank_emoji: '💠' },
  { rank_order: 7, rank_name: 'Legend Fulfillment', rank_emoji: '💎' },
  { rank_order: 8, rank_name: 'Grandmaster Fulfillment', rank_emoji: '👑' },
]
const ACCOUNTING_RANKS = [
  { rank_order: 1, rank_name: 'Accounting Lead', rank_emoji: '🗂️' },
  { rank_order: 2, rank_name: 'Accounting Supervisor', rank_emoji: '📋' },
  { rank_order: 3, rank_name: 'Accounting Manager', rank_emoji: '📊' },
  { rank_order: 4, rank_name: 'Finance Manager', rank_emoji: '🏢' },
  { rank_order: 5, rank_name: 'Finance Director', rank_emoji: '🌐' },
]
const ADMINISTRATION_RANKS = [
  { rank_order: 1, rank_name: 'Administration Officer', rank_emoji: '🗂️' },
  { rank_order: 2, rank_name: 'Senior Administration Officer', rank_emoji: '📋' },
  { rank_order: 3, rank_name: 'Administration Supervisor', rank_emoji: '📊' },
  { rank_order: 4, rank_name: 'Administration Manager', rank_emoji: '🏢' },
  { rank_order: 5, rank_name: 'Senior Administration Manager', rank_emoji: '🌐' },
  { rank_order: 6, rank_name: 'Administration Director', rank_emoji: '🏛️' },
]
const HR_RANKS = [
  { rank_order: 1, rank_name: 'HR Lead', rank_emoji: '👔' },
  { rank_order: 2, rank_name: 'HR Supervisor', rank_emoji: '🧑‍💼' },
  { rank_order: 3, rank_name: 'HR Manager', rank_emoji: '👨‍💼' },
  { rank_order: 4, rank_name: 'Senior HR Manager', rank_emoji: '💼' },
  { rank_order: 5, rank_name: 'HR Director', rank_emoji: '👑' },
]
const LIVE_MANAGER_RANKS = [
  { rank_order: 1, rank_name: 'Live Team Leader', rank_emoji: '👥' },
  { rank_order: 2, rank_name: 'Live Supervisor', rank_emoji: '🗂️' },
  { rank_order: 3, rank_name: 'Assistant Live Manager', rank_emoji: '📋' },
  { rank_order: 4, rank_name: 'Live Manager', rank_emoji: '📊' },
  { rank_order: 5, rank_name: 'Senior Live Manager', rank_emoji: '🏢' },
  { rank_order: 6, rank_name: 'Head of Live', rank_emoji: '🌐' },
  { rank_order: 7, rank_name: 'Director of Live Commerce', rank_emoji: '🏛️' },
]
const TAX_INVOICE_DEPTS = ['บัญชี&การเงิน', 'สต๊อค&จัดซื้อ', 'ธุรการ']
const VIP_BIRTHDAY_DEPTS = ['ไลฟ์สด', 'การตลาด', 'ผู้จัดการไลฟ์สด', 'ผู้จัดการหน้าร้าน']
const TCG_DEPTS = ['ผู้จัดการหน้าร้าน', 'ธุรการ']
const PROMO_THRESHOLD_DEPTS = ['การตลาด']
const PROMO_LIST_DEPTS = ['ไลฟ์สด', 'การตลาด']
const ANNOUNCE_DEPTS = ['ไลฟ์สด', 'สต๊อค&จัดซื้อ', 'Creative', 'การตลาด', 'ผู้จัดการไลฟ์สด', 'บุคคล', 'ผู้จัดการหน้าร้าน']

interface ChannelRow {
  id: string
  channel: string
  shift: 'เช้า' | 'บ่าย'
  liveStaffName: string
  liveHours: string
  adsCost: string
  grossRevenue: string
  roi: string
  costPerOrder: string
  costPer10SecView: string
  avgViewDuration: string
  newFollowers: string
}

interface BestRoiEntry {
  shift: '' | 'เช้า' | 'บ่าย'
  liveStaffName: string
  liveHours: string
  adsCost: string
  grossRevenue: string
  roi: string
  costPerOrder: string
  costPer10SecView: string
  avgViewDuration: string
  newFollowers: string
}

const emptyBestRoiEntry: BestRoiEntry = {
  shift: '',
  liveStaffName: '',
  liveHours: '',
  adsCost: '',
  grossRevenue: '',
  roi: '',
  costPerOrder: '',
  costPer10SecView: '',
  avgViewDuration: '',
  newFollowers: '',
}

function buildExtraDataPayload(dept: string, extra: ExtraData, channelRows: ChannelRow[] = []): Record<string, unknown> | undefined {
  if (dept === 'ไลฟ์สด') {
    const payload: Record<string, unknown> = {}
    if (extra.liveHours.trim()) payload.live_hours = extra.liveHours.trim()
    if (extra.salesAmount.trim()) payload.sales_amount = extra.salesAmount.trim()
    return Object.keys(payload).length > 0 ? payload : undefined
  }
  if (dept === 'Sales Admin') {
    const payload: Record<string, unknown> = {}
    if (extra.salesAmount.trim()) payload.sales_amount = extra.salesAmount.trim()
    return Object.keys(payload).length > 0 ? payload : undefined
  }
  if (dept === 'แพค') {
    if (extra.packCount.trim()) return { pack_count: extra.packCount.trim() }
    return undefined
  }
  if (dept === 'Creative') {
    const validLinks = extra.clipLinks.filter((l) => l.trim())
    return validLinks.length > 0 ? { clip_links: validLinks } : undefined
  }
  if (dept === 'การตลาด') {
    const channels = channelRows.map((row) => ({
      channel: row.channel,
      shift: row.shift,
      ...(row.liveStaffName && { live_staff_name: row.liveStaffName }),
      ...(row.adsCost && { ads_cost: row.adsCost }),
      ...(row.grossRevenue && { gross_revenue: row.grossRevenue }),
      ...(row.roi && { roi: row.roi }),
      ...(row.costPerOrder && { cost_per_order: row.costPerOrder }),
      ...(row.costPer10SecView && { cost_per_10sec_view: row.costPer10SecView }),
      ...(row.avgViewDuration && { avg_view_duration: row.avgViewDuration }),
      ...(row.newFollowers && { new_followers: row.newFollowers }),
      ...(row.liveHours && { live_hours: row.liveHours }),
    }))
    return channels.length > 0 ? { channels } : undefined
  }
  return undefined
}

export default function Home() {
  const [formData, setFormData] = useState<FormData>({
    department: '',
    date: getTodayDate(),
    time: getCurrentTime(),
    nickname: '',
    channelName: [],
    bestRoiChannel: '',
    tasks: [''],
    obstacles: '',
    extraData: { ...defaultExtraData, clipLinks: [''] },
  })
  const [pageState, setPageState] = useState<PageState>('form')
  const [submittedId, setSubmittedId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [channelRows, setChannelRows] = useState<ChannelRow[]>([])
  const [pendingChannel, setPendingChannel] = useState('')
  const [bestRoiEntry, setBestRoiEntry] = useState<BestRoiEntry>({ ...emptyBestRoiEntry })

  const [hasDraft, setHasDraft] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [liveStaff, setLiveStaff] = useState<LiveStaffMember[]>([])
  const [pickerOpen, setPickerOpen] = useState(true)
  const [creativeStaff, setCreativeStaff] = useState<LiveStaffMember[]>([])
  const [creativePickerOpen, setCreativePickerOpen] = useState(true)
  const [loadingCreative, setLoadingCreative] = useState(false)
  const [marketingStaff, setMarketingStaff] = useState<LiveStaffMember[]>([])
  const [marketingPickerOpen, setMarketingPickerOpen] = useState(true)
  const [loadingMarketing, setLoadingMarketing] = useState(false)
  const [marketingChecklist, setMarketingChecklist] = useState({ newProductDiscount: false, tiktokAiPromo: false, topFiveProducts: false })
  const [storeManagerChecklist, setStoreManagerChecklist] = useState({ postNewProduct: false, postTournament: false, genAiUsed: false })
  const [saleAdminStaff, setSaleAdminStaff] = useState<LiveStaffMember[]>([])
  const [saleAdminPickerOpen, setSaleAdminPickerOpen] = useState(true)
  const [loadingSaleAdmin, setLoadingSaleAdmin] = useState(false)
  const [storeRetailStaff, setStoreRetailStaff] = useState<LiveStaffMember[]>([])
  const [storeRetailPickerOpen, setStoreRetailPickerOpen] = useState(true)
  const [loadingStoreRetail, setLoadingStoreRetail] = useState(false)
  const [stockPurchasingStaff, setStockPurchasingStaff] = useState<LiveStaffMember[]>([])
  const [stockPurchasingPickerOpen, setStockPurchasingPickerOpen] = useState(true)
  const [loadingStockPurchasing, setLoadingStockPurchasing] = useState(false)
  const [packStaff, setPackStaff] = useState<LiveStaffMember[]>([])
  const [packPickerOpen, setPackPickerOpen] = useState(true)
  const [loadingPack, setLoadingPack] = useState(false)
  const [accountingStaff, setAccountingStaff] = useState<LiveStaffMember[]>([])
  const [accountingPickerOpen, setAccountingPickerOpen] = useState(true)
  const [loadingAccounting, setLoadingAccounting] = useState(false)
  const [administrationStaff, setAdministrationStaff] = useState<LiveStaffMember[]>([])
  const [administrationPickerOpen, setAdministrationPickerOpen] = useState(true)
  const [loadingAdministration, setLoadingAdministration] = useState(false)
  const [hrStaff, setHrStaff] = useState<LiveStaffMember[]>([])
  const [hrPickerOpen, setHrPickerOpen] = useState(true)
  const [loadingHr, setLoadingHr] = useState(false)
  const [liveManagerStaff, setLiveManagerStaff] = useState<LiveStaffMember[]>([])
  const [liveManagerPickerOpen, setLiveManagerPickerOpen] = useState(true)
  const [loadingLiveManager, setLoadingLiveManager] = useState(false)
  const [storeManagerStaff, setStoreManagerStaff] = useState<LiveStaffMember[]>([])
  const [storeManagerPickerOpen, setStoreManagerPickerOpen] = useState(true)
  const [loadingStoreManager, setLoadingStoreManager] = useState(false)
  const [smActivities, setSmActivities] = useState([{ activityName: '', eventDate: '', startTime: '', facebookUrl: '' }])
  const addSmActivity = () => { if (smActivities.length < 10) setSmActivities(prev => [...prev, { activityName: '', eventDate: '', startTime: '', facebookUrl: '' }]) }
  const removeSmActivity = (i: number) => setSmActivities(prev => prev.filter((_, idx) => idx !== i))
  const updateSmActivity = (i: number, field: 'activityName' | 'eventDate' | 'startTime' | 'facebookUrl', value: string) => setSmActivities(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  useEffect(() => {
    setLoadingCreative(true)
    setLoadingMarketing(true)
    setLoadingSaleAdmin(true)
    setLoadingStoreRetail(true)
    setLoadingStockPurchasing(true)
    setLoadingPack(true)
    setLoadingAccounting(true)
    setLoadingAdministration(true)
    setLoadingHr(true)
    setLoadingLiveManager(true)
    setLoadingStoreManager(true)
    fetch('/api/live-staff')
      .then((r) => r.json())
      .then((d) => {
        const all: LiveStaffMember[] = d.staff || []
        setLiveStaff(all.filter((s) => s.department === 'ไลฟ์สด'))
        setCreativeStaff(all.filter((s) => s.department === 'Creative'))
        setMarketingStaff(all.filter((s) => s.department === 'การตลาด'))
        setSaleAdminStaff(all.filter((s) => s.department === 'Sales Admin'))
        setStoreRetailStaff(all.filter((s) => s.department === 'Store Retail'))
        setStockPurchasingStaff(all.filter((s) => s.department === 'สต๊อค&จัดซื้อ'))
        setPackStaff(all.filter((s) => s.department === 'แพค'))
        setAccountingStaff(all.filter((s) => s.department === 'บัญชี&การเงิน'))
        setAdministrationStaff(all.filter((s) => s.department === 'ธุรการ'))
        setHrStaff(all.filter((s) => s.department === 'บุคคล'))
        setLiveManagerStaff(all.filter((s) => s.department === 'ผู้จัดการไลฟ์สด'))
        setStoreManagerStaff(all.filter((s) => s.department === 'ผู้จัดการหน้าร้าน'))
      })
      .catch(() => {})
      .finally(() => {
        setLoadingCreative(false)
        setLoadingMarketing(false)
        setLoadingSaleAdmin(false)
        setLoadingStoreRetail(false)
        setLoadingStockPurchasing(false)
        setLoadingPack(false)
        setLoadingAccounting(false)
        setLoadingAdministration(false)
        setLoadingHr(false)
        setLoadingLiveManager(false)
        setLoadingStoreManager(false)
      })
  }, [])

  useEffect(() => {
    if (!formData.department) return
    const open = !formData.nickname
    setPickerOpen(open)
    setCreativePickerOpen(open)
    setMarketingPickerOpen(open)
    setSaleAdminPickerOpen(open)
    setStoreRetailPickerOpen(open)
    setStockPurchasingPickerOpen(open)
    setPackPickerOpen(open)
    setAccountingPickerOpen(open)
    setAdministrationPickerOpen(open)
    setHrPickerOpen(open)
    setLiveManagerPickerOpen(open)
    setStoreManagerPickerOpen(open)
  }, [formData.department])

  useEffect(() => {
    if (loadDraft()) setHasDraft(true)
    try {
      const saved = localStorage.getItem(DEPT_KEY)
      if (saved) {
        setFormData(prev => ({ ...prev, department: saved }))
        if (isCodeVerifiedLocally(saved)) setCodeVerified(true)
      }
    } catch { /* */ }
  }, [])

  useEffect(() => {
    if (formData.department) {
      try { localStorage.setItem(DEPT_KEY, formData.department) } catch { /* */ }
    }
  }, [formData.department])

  function handleSaveDraft() {
    saveDraft(formData)
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2000)
  }
  function handleRestoreDraft() {
    const draft = loadDraft()
    if (draft) { setFormData(draft); setHasDraft(false) }
  }
  function handleDiscardDraft() {
    clearDraft(); setHasDraft(false)
  }

  // Department access code
  const [codeVerified, setCodeVerified] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [verifying, setVerifying] = useState(false)

  async function handleVerifyCode() {
    if (codeInput.length !== 4) { setCodeError('กรุณากรอกรหัส 4 หลัก'); return }
    setVerifying(true)
    setCodeError('')
    try {
      const res = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: formData.department, code: codeInput }),
      })
      const data = await res.json()
      if (data.valid) { saveCodeVerified(formData.department); setCodeVerified(true); setCodeInput(''); setCodeError('') }
      else setCodeError('รหัสไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
    } catch { setCodeError('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setVerifying(false) }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!formData.department) e.department = 'กรุณาเลือกแผนก'
    if (!formData.date) e.date = 'กรุณาเลือกวันที่'
    if (!formData.nickname.trim()) e.nickname = (formData.department === 'ไลฟ์สด' || formData.department === 'Creative') ? 'กรุณาเลือกชื่อ' : 'กรุณากรอกชื่อเล่น'
    if (CHANNEL_DEPTS.includes(formData.department) && (formData.department === 'การตลาด' ? channelRows.length === 0 : formData.channelName.length === 0)) e.channelName = 'กรุณาเลือกช่องที่ดูแลอย่างน้อย 1 ช่อง'
    if (formData.department === 'การตลาด' && !formData.bestRoiChannel) e.bestRoiChannel = 'กรุณาเลือกช่องที่ ROI สูงสุด 1 ช่อง'
    if (formData.department === 'การตลาด' && (!marketingChecklist.newProductDiscount || !marketingChecklist.tiktokAiPromo || !marketingChecklist.topFiveProducts)) e.marketingChecklist = 'กรุณาติ๊ก checklist ให้ครบก่อนส่ง'
    if (formData.department === 'ผู้จัดการหน้าร้าน' && (!storeManagerChecklist.postNewProduct || !storeManagerChecklist.postTournament || !storeManagerChecklist.genAiUsed)) e.storeManagerChecklist = 'กรุณาติ๊ก checklist ให้ครบก่อนส่ง'
    if (!formData.tasks.some((t) => t.trim())) e.tasks = 'กรุณากรอกสิ่งที่ทำอย่างน้อย 1 รายการ'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmitClick() {
    if (validate()) setPageState('confirm')
  }

  async function handleConfirm() {
    setPageState('submitting')
    const validTasks = formData.tasks.filter((t) => t.trim())
    let extra_data = buildExtraDataPayload(formData.department, formData.extraData, channelRows)
    if (formData.department === 'ผู้จัดการหน้าร้าน') {
      const filledActivities = smActivities.filter(a => a.eventDate || a.activityName)
      if (filledActivities.length > 0) {
        extra_data = { activities: filledActivities }
      }
    }
    if (formData.department === 'การตลาด' && formData.bestRoiChannel && extra_data) {
      extra_data.best_roi = {
        channel: formData.bestRoiChannel,
        ...(bestRoiEntry.shift && { shift: bestRoiEntry.shift }),
        ...(bestRoiEntry.liveStaffName && { live_staff_name: bestRoiEntry.liveStaffName }),
        ...(bestRoiEntry.adsCost && { ads_cost: bestRoiEntry.adsCost }),
        ...(bestRoiEntry.grossRevenue && { gross_revenue: bestRoiEntry.grossRevenue }),
        ...(bestRoiEntry.roi && { roi: bestRoiEntry.roi }),
        ...(bestRoiEntry.costPerOrder && { cost_per_order: bestRoiEntry.costPerOrder }),
        ...(bestRoiEntry.costPer10SecView && { cost_per_10sec_view: bestRoiEntry.costPer10SecView }),
        ...(bestRoiEntry.avgViewDuration && { avg_view_duration: bestRoiEntry.avgViewDuration }),
        ...(bestRoiEntry.newFollowers && { new_followers: bestRoiEntry.newFollowers }),
        ...(bestRoiEntry.liveHours && { live_hours: bestRoiEntry.liveHours }),
      }
    }
    if (formData.department === 'การตลาด' && extra_data) {
      extra_data.checklist = marketingChecklist
    }
    if (formData.department === 'ผู้จัดการหน้าร้าน' && extra_data) {
      extra_data.checklist = storeManagerChecklist
    }
    try {
      const res = await fetch('/api/kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: formData.department,
          date: formData.date,
          time: formData.time,
          nickname: formData.nickname.trim(),
          channel_name: formData.department === 'การตลาด'
            ? channelRows.map(r => `${r.channel}(${r.shift})`).join(', ')
            : formData.channelName.join(', '),
          tasks: validTasks,
          obstacles: formData.obstacles.trim(),
          extra_data,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmittedId(data.id)
        clearDraft()
        setHasDraft(false)
        setPageState('success')
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
        setPageState('confirm')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต')
      setPageState('confirm')
    }
  }

  function handleAddTask() {
    if (formData.tasks.length < 10) {
      setFormData((prev) => ({ ...prev, tasks: [...prev.tasks, ''] }))
    }
  }

  function handleRemoveTask(index: number) {
    if (formData.tasks.length > 1) {
      setFormData((prev) => ({ ...prev, tasks: prev.tasks.filter((_, i) => i !== index) }))
    }
  }

  function handleTaskChange(index: number, value: string) {
    setFormData((prev) => {
      const tasks = [...prev.tasks]
      tasks[index] = value
      return { ...prev, tasks }
    })
  }

  function setExtra(patch: Partial<ExtraData>) {
    setFormData((prev) => ({ ...prev, extraData: { ...prev.extraData, ...patch } }))
  }

  function handleAddClipLink() {
    if (formData.extraData.clipLinks.length < 10) {
      setExtra({ clipLinks: [...formData.extraData.clipLinks, ''] })
    }
  }

  function handleRemoveClipLink(index: number) {
    if (formData.extraData.clipLinks.length > 1) {
      setExtra({ clipLinks: formData.extraData.clipLinks.filter((_, i) => i !== index) })
    }
  }

  function handleClipLinkChange(index: number, value: string) {
    const links = [...formData.extraData.clipLinks]
    links[index] = value
    setExtra({ clipLinks: links })
  }


  function resetForm() {
    setFormData({
      department: '',
      date: getTodayDate(),
      time: getCurrentTime(),
      nickname: '',
      channelName: [],
      bestRoiChannel: '',
      tasks: [''],
      obstacles: '',
      extraData: { ...defaultExtraData, clipLinks: [''] },
    })
    setChannelRows([])
    setPendingChannel('')
    setBestRoiEntry({ ...emptyBestRoiEntry })
    setSmActivities([{ activityName: '', eventDate: '', startTime: '', facebookUrl: '' }])
    setMarketingChecklist({ newProductDiscount: false, tiktokAiPromo: false, topFiveProducts: false })
    setStoreManagerChecklist({ postNewProduct: false, postTournament: false, genAiUsed: false })
    setErrors({})
    setPageState('form')
    setSubmittedId('')
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">บันทึกข้อมูลสำเร็จ</h2>
          <p className="text-gray-500 text-sm mb-1">เลขอ้างอิง</p>
          <p className="text-xl font-bold text-[#16A34A] mb-8">#{submittedId}</p>
          <button
            onClick={resetForm}
            className="w-full bg-[#1E3A5F] text-white py-3.5 rounded-xl font-semibold text-base"
          >
            กรอกข้อมูลอีกครั้ง
          </button>
        </div>
      </div>
    )
  }

  const validTaskCount = formData.tasks.filter((t) => t.trim()).length
  const extra = formData.extraData
  const extraPayload = buildExtraDataPayload(formData.department, extra, channelRows)

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 text-center shadow-md relative">
        <h1 className="text-xl font-bold tracking-wide">GAP TRADING & NAKAMA</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.75 }}>
          Every Pack Every Box Every Smile
        </p>
        <p className="text-xs mt-0.5" style={{ opacity: 0.55 }}>
          ทุกซอง ทุกกล่อง ทุกความสุข
        </p>
        <button
          onClick={() => window.location.reload()}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors opacity-70"
          title="รีเฟรชหน้า"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-10">
        {/* Draft banner */}
        {hasDraft && pageState === 'form' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-xl">📝</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-700">มีข้อมูลที่บันทึกไว้</p>
              <p className="text-xs text-amber-500 mt-0.5">กู้คืนต่อจากที่ค้างไว้</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={handleRestoreDraft}
                className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-semibold">
                กู้คืน
              </button>
              <button onClick={handleDiscardDraft}
                className="text-xs border border-amber-200 text-amber-600 px-3 py-1.5 rounded-lg">
                ล้าง
              </button>
            </div>
          </div>
        )}

        {/* Department */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-[#374151] mb-3">
            แผนก <span className="text-[#DC2626]">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => {
                  setFormData((prev) => ({
                    ...prev,
                    department: dept,
                    nickname: '',
                    channelName: [],
                    bestRoiChannel: '',
                    extraData: { ...defaultExtraData, clipLinks: [''] },
                  }))
                  setChannelRows([])
                  setPendingChannel('')
                  setBestRoiEntry({ ...emptyBestRoiEntry })
                  setPickerOpen(true)
                  setCreativePickerOpen(true)
                  setSmActivities([{ activityName: '', eventDate: '', startTime: '', facebookUrl: '' }])
                  setErrors((prev) => ({ ...prev, department: '', nickname: '' }))
                  setCodeVerified(isCodeVerifiedLocally(dept))
                  setCodeInput('')
                  setCodeError('')
                }}
                className={`py-2.5 px-1 text-xs rounded-xl border-2 font-semibold transition-all ${
                  formData.department === dept
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
          {errors.department && (
            <p className="text-[#DC2626] text-xs mt-2">{errors.department}</p>
          )}
        </div>

        {/* สต๊อค&จัดซื้อ — quick links */}
        {formData.department === 'สต๊อค&จัดซื้อ' && (
          <div className="space-y-2">
            <Link
              href="/disbursement"
              className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-4 hover:bg-orange-100 transition-colors"
            >
              <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
                💸
              </div>
              <div>
                <p className="text-sm font-bold text-orange-800">ระบบเบิกจ่าย</p>
                <p className="text-xs text-gray-400 mt-0.5">ยืนยันสั่งซื้อ · รายการที่บัญชีอนุมัติแล้ว</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-orange-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/restock"
              className="flex items-center gap-3 bg-[#DC2626]/5 border border-[#DC2626]/20 rounded-2xl p-4 hover:bg-[#DC2626]/10 transition-colors"
            >
              <div className="w-10 h-10 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
                ⚠️
              </div>
              <div>
                <p className="text-sm font-bold text-[#DC2626]">แจ้งสินค้าต้อง Restock (เฉพาะบอสที่สั่งได้)</p>
                <p className="text-xs text-gray-400 mt-0.5">แนบรูปสินค้า → Admin รับทราบและสั่งซื้อด่วน</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#DC2626] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/stock-arrival"
              className="flex items-center gap-3 bg-[#16A34A]/5 border border-[#16A34A]/20 rounded-2xl p-4 hover:bg-[#16A34A]/10 transition-colors"
            >
              <div className="w-10 h-10 bg-[#16A34A] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
                📦
              </div>
              <div>
                <p className="text-sm font-bold text-[#16A34A]">แจ้งสินค้าเข้า</p>
                <p className="text-xs text-gray-400 mt-0.5">บันทึกสินค้าที่รับเข้าสต๊อควันนี้</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#16A34A] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/stock-prices"
              className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
            >
              <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
                📋
              </div>
              <div>
                <p className="text-sm font-bold text-[#1E3A5F]">ดูราคาขายสินค้า</p>
                <p className="text-xs text-gray-400 mt-0.5">ราคาขายที่ Admin กำหนดแล้ว</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/preorder"
              className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
            >
              <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
                🛍️
              </div>
              <div>
                <p className="text-sm font-bold text-[#1E3A5F]">Pre-Order 📈</p>
                <p className="text-xs text-gray-400 mt-0.5">สั่งจองสินค้าล่วงหน้าก่อนปิดรับออเดอร์</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        {/* Date + Time */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="วันที่" required error={errors.date}>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                  setErrors((prev) => ({ ...prev, date: '' }))
                }}
                className={inputClass}
              />
            </InputField>
            <InputField label="เวลา">
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData((prev) => ({ ...prev, time: e.target.value }))}
                className={inputClass}
              />
            </InputField>
          </div>
        </div>

        {/* Nickname + Channel */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <InputField label={(formData.department === 'ไลฟ์สด' || formData.department === 'Creative' || formData.department === 'การตลาด' || formData.department === 'Sales Admin' || formData.department === 'Store Retail' || formData.department === 'สต๊อค&จัดซื้อ' || formData.department === 'แพค' || formData.department === 'บัญชี&การเงิน' || formData.department === 'ธุรการ' || formData.department === 'บุคคล' || formData.department === 'ผู้จัดการไลฟ์สด' || formData.department === 'ผู้จัดการหน้าร้าน') ? 'เลือกชื่อ (สิทธิพิเศษเริ่มใช้ 2570)' : 'ชื่อเล่น'} required error={errors.nickname}>
            {formData.department === 'ไลฟ์สด' ? (
              !pickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {liveStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : ALL_RANKS.map((rank) => {
                    const members = liveStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'Creative' ? (
              !creativePickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreativePickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingCreative ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : creativeStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : CREATIVE_RANKS.map((rank) => {
                    const members = creativeStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setCreativePickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'การตลาด' ? (
              !marketingPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMarketingPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingMarketing ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : marketingStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : MARKETING_RANKS.map((rank) => {
                    const members = marketingStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setMarketingPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'Sales Admin' ? (
              !saleAdminPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSaleAdminPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingSaleAdmin ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : saleAdminStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อ���ูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : SALE_ADMIN_RANKS.map((rank) => {
                    const members = saleAdminStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setSaleAdminPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'Store Retail' ? (
              !storeRetailPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStoreRetailPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingStoreRetail ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : storeRetailStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : STORE_RETAIL_RANKS.map((rank) => {
                    const members = storeRetailStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setStoreRetailPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'สต๊อค&จัดซื้อ' ? (
              !stockPurchasingPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStockPurchasingPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingStockPurchasing ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : stockPurchasingStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : STOCK_PURCHASING_RANKS.map((rank) => {
                    const members = stockPurchasingStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setStockPurchasingPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'แพค' ? (
              !packPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPackPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingPack ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : packStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : FULFILLMENT_RANKS.map((rank) => {
                    const members = packStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setPackPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'บัญชี&การเงิน' ? (
              !accountingPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAccountingPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingAccounting ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : accountingStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : ACCOUNTING_RANKS.map((rank) => {
                    const members = accountingStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setAccountingPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'ธุรการ' ? (
              !administrationPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdministrationPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingAdministration ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : administrationStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : ADMINISTRATION_RANKS.map((rank) => {
                    const members = administrationStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setAdministrationPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'บุคคล' ? (
              !hrPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHrPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingHr ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : hrStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : HR_RANKS.map((rank) => {
                    const members = hrStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setHrPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'ผู้จัดการไลฟ์สด' ? (
              !liveManagerPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLiveManagerPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingLiveManager ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : liveManagerStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : LIVE_MANAGER_RANKS.map((rank) => {
                    const members = liveManagerStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setLiveManagerPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : formData.department === 'ผู้จัดการหน้าร้าน' ? (
              !storeManagerPickerOpen && formData.nickname ? (
                <div className="flex items-center gap-3 pt-0.5">
                  <span className="px-4 py-2 rounded-full bg-[#1E3A5F] text-white text-sm font-semibold">
                    ✓ {formData.nickname}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStoreManagerPickerOpen(true)}
                    className="text-xs text-[#1E3A5F] underline underline-offset-2"
                  >
                    เปลี่ยน
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingStoreManager ? (
                    <div className="py-4 text-center text-xs text-gray-400">กำลังโหลด...</div>
                  ) : storeManagerStaff.length === 0 ? (
                    <div className="py-4 text-center text-xs text-gray-400">ไม่พบข้อมูลพนักงาน — กรุณาแจ้ง Admin</div>
                  ) : STORE_MANAGER_RANKS.map((rank) => {
                    const members = storeManagerStaff.filter((s) => s.rank_order === rank.rank_order)
                    const isEmpty = members.length === 0
                    return (
                      <div key={rank.rank_order} className={isEmpty ? 'opacity-40' : ''}>
                        <p className="text-xs font-semibold text-gray-400 mb-1.5">
                          {rank.rank_emoji} {rank.rank_name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {isEmpty ? (
                            <span className="text-xs text-gray-300 italic">— ยังไม่มีสมาชิก</span>
                          ) : members.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, nickname: m.name }))
                                setErrors((prev) => ({ ...prev, nickname: '' }))
                                setStoreManagerPickerOpen(false)
                              }}
                              className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                                formData.nickname === m.name
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] font-semibold'
                                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                              }`}
                            >
                              {`${formData.nickname === m.name ? '✓ ' : ''}${m.is_head ? '⚜️ ' : ''}${m.name}${m.badge_emoji ? ' ' + m.badge_emoji : ''}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, nickname: e.target.value }))
                  setErrors((prev) => ({ ...prev, nickname: '' }))
                }}
                placeholder="ชื่อเล่นของคุณ"
                className={inputClass}
              />
            )}
          </InputField>
          {formData.department === 'การตลาด' && (
            <InputField label="ช่องที่ ROI ต่ำกว่า 15" required error={errors.channelName}>
              {/* Selected rows — compact tags */}
              {channelRows.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {channelRows.map(row => (
                    <span
                      key={row.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        row.shift === 'เช้า' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {row.channel} {row.shift === 'เช้า' ? '🌅' : '🌙'} {row.shift}
                      <button
                        type="button"
                        onClick={() => setChannelRows(prev => prev.filter(r => r.id !== row.id))}
                        className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-500 leading-none"
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
              {/* Channel pills */}
              <div className="flex flex-wrap gap-2 mb-2">
                {CHANNEL_LIST.map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setPendingChannel(ch === pendingChannel ? '' : ch)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      pendingChannel === ch
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
              {/* Shift selector */}
              {pendingChannel && (
                <div className="flex items-center gap-2 bg-[#1E3A5F]/5 rounded-xl px-3 py-2">
                  <span className="text-xs text-[#374151] font-semibold flex-1 min-w-0 truncate">
                    กะของ {pendingChannel}:
                  </span>
                  {(['เช้า', 'บ่าย'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setChannelRows(prev => [...prev, {
                          id: `${pendingChannel}_${s}_${Date.now()}`,
                          channel: pendingChannel, shift: s,
                          liveStaffName: '', liveHours: '', adsCost: '', grossRevenue: '',
                          roi: '', costPerOrder: '', costPer10SecView: '', avgViewDuration: '', newFollowers: '',
                        }])
                        setErrors(prev => ({ ...prev, channelName: '' }))
                        setPendingChannel('')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${
                        s === 'เช้า'
                          ? 'bg-amber-400 hover:bg-amber-500 text-white'
                          : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                      }`}
                    >
                      {s === 'เช้า' ? '🌅 เช้า' : '🌙 บ่าย'}
                    </button>
                  ))}
                </div>
              )}
            </InputField>
          )}
          {formData.department === 'การตลาด' && (
            <InputField label="ช่องที่ ROI สูงสุดวันนี้" required error={errors.bestRoiChannel}>
              <p className="text-xs text-gray-400 mb-2">เลือกได้ 1 ช่องเท่านั้น</p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                {CHANNEL_LIST.map((ch) => {
                  const selected = formData.bestRoiChannel === ch
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, bestRoiChannel: selected ? '' : ch }))
                        if (selected) setBestRoiEntry((prev) => ({ ...prev, shift: '' }))
                        setErrors((prev) => ({ ...prev, bestRoiChannel: '' }))
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        selected
                          ? 'bg-[#16A34A] text-white border-[#16A34A]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#16A34A]'
                      }`}
                    >
                      {ch}
                    </button>
                  )
                })}
              </div>
              {formData.bestRoiChannel && (
                <div className="flex items-center gap-2 mt-2.5 pl-1">
                  <span className="text-xs text-gray-500 shrink-0">กะของ {formData.bestRoiChannel}:</span>
                  {(['เช้า', 'บ่าย'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setBestRoiEntry((prev) => ({ ...prev, shift: s }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        bestRoiEntry.shift === s
                          ? s === 'เช้า' ? 'bg-amber-400 text-white' : 'bg-indigo-500 text-white'
                          : 'bg-white border border-[#E2E8F0] text-gray-400'
                      }`}
                    >
                      {s === 'เช้า' ? '🌅 เช้า' : '🌙 บ่าย'}
                    </button>
                  ))}
                </div>
              )}
            </InputField>
          )}
          {['ไลฟ์สด', 'Sales Admin', 'Creative'].includes(formData.department) && (
            <InputField label="ช่องที่ดูแล" required error={errors.channelName}>
              <div className="flex gap-2 pt-0.5 overflow-x-auto pb-2">
                {CHANNEL_LIST.map((ch) => {
                  const selected = formData.channelName.includes(ch)
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          channelName: selected
                            ? prev.channelName.filter((c) => c !== ch)
                            : [...prev.channelName, ch],
                        }))
                        setErrors((prev) => ({ ...prev, channelName: '' }))
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        selected
                          ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                          : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                      }`}
                    >
                      {ch}
                    </button>
                  )
                })}
              </div>
            </InputField>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-[#374151] mb-3">
            สิ่งที่ทำวันนี้ <span className="text-[#DC2626]">*</span>
            <span className="text-xs font-normal text-gray-400 ml-2">
              ({validTaskCount}/{formData.tasks.length} รายการ)
            </span>
          </label>
          <div className="space-y-2">
            {formData.tasks.map((task, index) => (
              <div key={index} className="flex gap-2 items-center">
                <span className="text-xs text-gray-400 w-5 text-right shrink-0">{index + 1}.</span>
                <input
                  type="text"
                  value={task}
                  onChange={(e) => {
                    handleTaskChange(index, e.target.value)
                    if (errors.tasks) setErrors((prev) => ({ ...prev, tasks: '' }))
                  }}
                  placeholder={`รายการที่ ${index + 1}`}
                  className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                />
                {formData.tasks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTask(index)}
                    className="text-[#DC2626] text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 shrink-0"
                    aria-label="ลบรายการ"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.tasks && <p className="text-[#DC2626] text-xs mt-2">{errors.tasks}</p>}
          {formData.tasks.length < 10 && (
            <button
              type="button"
              onClick={handleAddTask}
              className="mt-3 text-sm text-[#1E3A5F] font-semibold flex items-center gap-1 hover:underline"
            >
              + เพิ่มรายการ
            </button>
          )}
        </div>

        {/* การตลาด — checklist */}
        {formData.department === 'การตลาด' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#374151] mb-3">Checklist <span className="text-[#DC2626]">*</span></p>
            <div className="space-y-2.5">
              {([
                { key: 'newProductDiscount', label: 'สินค้าเข้าใหม่ทำส่วนลด 10%' },
                { key: 'tiktokAiPromo', label: 'กดโปรโมชั่น AI ใน TikTok Seller' },
                { key: 'topFiveProducts', label: 'จัดอันดับสินค้าขายดี 5 ชิ้น ในวันนี้ลงไลน์ 15.00 น.' },
              ] as { key: keyof typeof marketingChecklist; label: string }[]).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingChecklist[key]}
                    onChange={(e) => setMarketingChecklist(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-5 h-5 rounded border-[#E2E8F0] accent-[#1E3A5F] cursor-pointer"
                  />
                  <span className="text-sm text-[#374151]">{label}</span>
                </label>
              ))}
            </div>
            {errors.marketingChecklist && (
              <p className="text-[#DC2626] text-xs mt-2">{errors.marketingChecklist}</p>
            )}
          </div>
        )}

        {formData.department === 'ผู้จัดการหน้าร้าน' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#374151] mb-3">Checklist <span className="text-[#DC2626]">*</span></p>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeManagerChecklist.postNewProduct}
                  onChange={(e) => setStoreManagerChecklist(prev => ({ ...prev, postNewProduct: e.target.checked }))}
                  className="w-5 h-5 rounded border-[#E2E8F0] accent-[#1E3A5F] cursor-pointer"
                />
                <span className="text-sm text-[#374151]">โพสสินค้าเข้าร้านในเพจหน้าร้าน ทั้ง 3 เพจ วันละ 1 โพส</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeManagerChecklist.postTournament}
                  onChange={(e) => setStoreManagerChecklist(prev => ({ ...prev, postTournament: e.target.checked }))}
                  className="w-5 h-5 rounded border-[#E2E8F0] accent-[#1E3A5F] cursor-pointer"
                />
                <span className="text-sm text-[#374151]">โพสจัดงานแข่งอย่างน้อยวันละ 1-2 งาน</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storeManagerChecklist.genAiUsed}
                  onChange={(e) => setStoreManagerChecklist(prev => ({ ...prev, genAiUsed: e.target.checked }))}
                  className="w-5 h-5 rounded border-[#E2E8F0] accent-[#1E3A5F] cursor-pointer"
                />
                <span className="text-sm text-[#374151]">
                  ยืนยันว่าได้ใช้ Gen AI
                  <span className="block text-xs text-gray-400 mt-0.5">ห้ามให้ AI จับได้ว่าใช้ AI ในแพลทฟอร์มต่างๆ</span>
                </span>
              </label>
            </div>
            {errors.storeManagerChecklist && (
              <p className="text-[#DC2626] text-xs mt-2">{errors.storeManagerChecklist}</p>
            )}
          </div>
        )}

        {/* ── Department-specific fields ── */}

        {/* ผู้จัดการหน้าร้าน — โพสงานแข่ง Facebook */}
        {formData.department === 'ผู้จัดการหน้าร้าน' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#374151] mb-3">
              📢 โพสงานแข่ง Facebook
              <span className="ml-2 text-xs font-normal text-gray-400">(ถ้ามี — ไม่บังคับ)</span>
            </p>
            <div className="flex flex-col gap-3">
              <div className="space-y-2">
                {smActivities.map((act, i) => (
                  <div key={i} className="bg-[#F5F6F8] rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#374151]">กิจกรรมที่ {i + 1}</span>
                      {smActivities.length > 1 && (
                        <button type="button" onClick={() => removeSmActivity(i)}
                          className="text-xs text-[#DC2626] font-semibold">ลบ</button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={act.activityName}
                      onChange={(e) => updateSmActivity(i, 'activityName', e.target.value)}
                      placeholder="ชื่อกิจกรรม"
                      className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                    />
                    <input
                      type="url"
                      value={act.facebookUrl}
                      onChange={(e) => updateSmActivity(i, 'facebookUrl', e.target.value)}
                      placeholder="ลิ้งโพส Facebook (ถ้ามี)"
                      className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={act.eventDate}
                        onChange={(e) => updateSmActivity(i, 'eventDate', e.target.value)}
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                      <input
                        type="time"
                        value={act.startTime}
                        onChange={(e) => updateSmActivity(i, 'startTime', e.target.value)}
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {smActivities.length < 10 && (
                <button type="button" onClick={addSmActivity}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-[#E2E8F0] text-sm font-semibold text-[#1E3A5F] hover:border-[#1E3A5F] transition-colors">
                  + เพิ่มกิจกรรม ({smActivities.length}/10)
                </button>
              )}
              {smActivities.some(a => a.eventDate) && (
                <p className="text-[11px] text-[#1E3A5F] bg-[#1E3A5F]/5 rounded-lg px-3 py-1.5">
                  ✓ ข้อมูลนี้จะบันทึกเป็นปฏิทินงานแข่งในระบบ Admin
                </p>
              )}
            </div>
          </div>
        )}

        {/* ระบบเบิกจ่าย — บัญชี / ธุรการ / บุคคล / การตลาด / Creative */}
        {['บัญชี&การเงิน', 'ธุรการ', 'บุคคล', 'การตลาด', 'Creative'].includes(formData.department) && (
          <Link
            href="/disbursement"
            className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-4 hover:bg-orange-100 transition-colors"
          >
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              💸
            </div>
            <div>
              <p className="text-sm font-bold text-orange-800">ระบบเบิกจ่าย</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formData.department === 'สต๊อค&จัดซื้อ'
                  ? 'ยืนยันสั่งซื้อ · รายการที่บัญชีอนุมัติแล้ว'
                  : 'ติดตามการเบิกจ่าย · ดำเนินการแต่ละขั้นตอน'}
              </p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-orange-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* บัญชี — ลิงก์ใบกำกับภาษี */}
        {formData.department === 'บัญชี&การเงิน' && (
          <Link
            href="/tax-invoice"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              🧾
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">รวมใบกำกับภาษีซื้อ (เฉพาะของบอส)</p>
              <p className="text-xs text-gray-400 mt-0.5">อัปโหลดใบกำกับ → สรุป VAT ซื้อรายเดือน</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {formData.department === 'บัญชี&การเงิน' && (
          <Link
            href="/workflow"
            className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 hover:bg-emerald-100 transition-colors"
          >
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              📋
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Workflow รายวัน</p>
              <p className="text-xs text-gray-400 mt-0.5">บันทึกการขาย · บันทึกการซื้อ · ค้นเอกสาร</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {formData.department === 'บัญชี&การเงิน' && (
          <Link
            href="/workflow-monthly"
            className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 hover:bg-indigo-100 transition-colors"
          >
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              📅
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-800">Workflow รายเดือน</p>
              <p className="text-xs text-gray-400 mt-0.5">เงินเดือน · VAT · ประกันสังคม · ปิดงบ</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {formData.department === 'บัญชี&การเงิน' && (
          <Link
            href="/workflow-yearly"
            className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-2xl p-4 hover:bg-purple-100 transition-colors"
          >
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              🗓️
            </div>
            <div>
              <p className="text-sm font-bold text-purple-800">Workflow รายปี</p>
              <p className="text-xs text-gray-400 mt-0.5">ภาษีนิติบุคคล · งบการเงิน · ประกันสังคม</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-600 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {VIP_BIRTHDAY_DEPTS.includes(formData.department) && (
          <Link
            href="/vip-birthday/index.html"
            className="flex items-center gap-3 bg-[#534AB7]/5 border border-[#534AB7]/20 rounded-2xl p-4 hover:bg-[#534AB7]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#534AB7] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              🎂
            </div>
            <div>
              <p className="text-sm font-bold text-[#534AB7]">VIP Birthday 📈</p>
              <p className="text-xs text-gray-400 mt-0.5">จัดการข้อมูลวันเกิดลูกค้า VIP</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#534AB7] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {formData.department === 'ผู้จัดการไลฟ์สด' && (
          <Link
            href="/manager"
            target="_blank"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              📊
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">ดูรายงานการตลาดวันนี้</p>
              <p className="text-xs text-gray-400 mt-0.5">ข้อมูล ROI, ยอดขาย และช่องไลฟ์สดทั้งหมด</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}



        {formData.department === 'บุคคล' && (
          <Link
            href="/hr-system"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              👥
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">ระบบทรัพยากรบุคคล</p>
              <p className="text-xs text-gray-400 mt-0.5">จัดการเอกสาร HR, อบรม, นโยบาย</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {formData.department === 'บุคคล' && (
          <Link
            href="/leave"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              🏖️
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">ระบบขอแจ้งลา</p>
              <p className="text-xs text-gray-400 mt-0.5">ยื่นคำขอลา, ดูสิทธิ์, ติดตามสถานะ</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {(formData.department === 'บุคคล' || formData.department === 'ผู้จัดการไลฟ์สด') && (
          <Link
            href="/evidence"
            target="_blank"
            className="flex items-center gap-3 bg-[#DC2626]/5 border border-[#DC2626]/20 rounded-2xl p-4 hover:bg-[#DC2626]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              📋
            </div>
            <div>
              <p className="text-sm font-bold text-[#DC2626]">หลักฐานรอลงทัณฑ์</p>
              <p className="text-xs text-gray-400 mt-0.5">บันทึกและดาวน์โหลดหลักฐาน</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#DC2626] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {PROMO_THRESHOLD_DEPTS.includes(formData.department) && (
          <Link
            href="/promo-threshold"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              🎁
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">โปรซื้อครบ</p>
              <p className="text-xs text-gray-400 mt-0.5">แจ้งโปรซื้อครบสินค้า พร้อมรูปและช่วงเดือน</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {PROMO_LIST_DEPTS.includes(formData.department) && (
          <Link
            href="/promo-list"
            className="flex items-center gap-3 bg-[#16A34A]/5 border border-[#16A34A]/20 rounded-2xl p-4 hover:bg-[#16A34A]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#16A34A] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              📋
            </div>
            <div>
              <p className="text-sm font-bold text-[#16A34A]">รายการโปรซื้อครบ 📈</p>
              <p className="text-xs text-gray-400 mt-0.5">ดูโปรที่ Admin อนุมัติแล้ว</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#16A34A] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* ผู้จัดการหน้าร้าน — Match Making TCG */}
        {TCG_DEPTS.includes(formData.department) && (
          <Link
            href="/tcg"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl shrink-0 overflow-hidden">
              <img src="/IMG_3291.JPG" alt="GAP7 Card Shop" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">Match Making TCG</p>
              <p className="text-xs text-gray-400 mt-0.5">จับคู่เกมการ์ด — gap7card 9 โต๊ะ</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* ผู้จัดการหน้าร้าน — Swiss Round */}
        {TCG_DEPTS.includes(formData.department) && (
          <Link
            href="/swiss"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              🏆
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">Swiss Round</p>
              <p className="text-xs text-gray-400 mt-0.5">ทัวร์นาเมนต์แบบสากล — gap7card</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* ผู้จัดการหน้าร้าน — ระบบจัดการหน้าร้าน */}
        {TCG_DEPTS.includes(formData.department) && (
          <Link
            href="/store-management"
            className="flex items-center gap-3 bg-[#16A34A]/5 border border-[#16A34A]/20 rounded-2xl p-4 hover:bg-[#16A34A]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#16A34A] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">🏪</div>
            <div>
              <p className="text-sm font-bold text-[#16A34A]">ระบบจัดการหน้าร้าน</p>
              <p className="text-xs text-gray-400 mt-0.5">เลือกร้าน แล้วเข้าระบบทัวร์นาเมนต์</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#16A34A] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* ไลฟ์สด / sale admin — ลิงก์ขอสินค้า */}
        {LIVE_DEPTS.includes(formData.department) && (
          <Link
            href="/request"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              📦
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">ขอสินค้าสำหรับไลฟ์ 📈</p>
              <p className="text-xs text-gray-400 mt-0.5">แนบรูปสินค้าและรายละเอียด → Admin อนุมัติ</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* เว็บไซต์ประกาศ */}
        {ANNOUNCE_DEPTS.includes(formData.department) && (
          <Link
            href={process.env.NEXT_PUBLIC_ANNOUNCEMENTS_URL || '/announcements'}
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              📢
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">เว็บไซต์ประกาศ</p>
              <p className="text-xs text-gray-400 mt-0.5">ประกาศสำคัญ + สินค้าเข้า</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* ไลฟ์สด / ธุรการ — Pre-Order */}
        {['ไลฟ์สด', 'ธุรการ'].includes(formData.department) && (
          <Link
            href="/preorder"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              🛍️
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">Pre-Order 📈</p>
              <p className="text-xs text-gray-400 mt-0.5">สั่งจองสินค้าล่วงหน้าก่อนปิดรับออเดอร์</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* ไลฟ์สด / sale admin */}
        {LIVE_DEPTS.includes(formData.department) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <p className="text-sm font-bold text-[#1E3A5F]">ข้อมูลการขาย</p>
            <div className={formData.department === 'ไลฟ์สด' ? 'grid grid-cols-2 gap-3' : ''}>
              {formData.department === 'ไลฟ์สด' && (
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-2">
                    ชั่วโมงไลฟ์วันนี้
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={extra.liveHours}
                      onChange={(e) => setExtra({ liveHours: e.target.value })}
                      placeholder="0"
                      className={inputClass + ' pr-16'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      ชั่วโมง
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-2">
                  ยอดขายวันนี้
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={extra.salesAmount}
                    onChange={(e) => setExtra({ salesAmount: e.target.value })}
                    placeholder="0"
                    className={inputClass + ' pr-10'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    บาท
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Creative */}
        {formData.department === 'Creative' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-[#1E3A5F] mb-3">
              ลิ้งคลิปที่ทำเสร็จวันนี้
              <span className="text-xs font-normal text-gray-400 ml-2">
                ({extra.clipLinks.filter((l) => l.trim()).length}/{extra.clipLinks.length} คลิป)
              </span>
            </p>
            <div className="space-y-2">
              {extra.clipLinks.map((link, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => handleClipLinkChange(i, e.target.value)}
                    placeholder="https://..."
                    className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                  />
                  {extra.clipLinks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveClipLink(i)}
                      className="text-[#DC2626] text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 shrink-0"
                      aria-label="ลบลิ้งค์"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {extra.clipLinks.length < 10 && (
              <button
                type="button"
                onClick={handleAddClipLink}
                className="mt-3 text-sm text-[#1E3A5F] font-semibold hover:underline"
              >
                + เพิ่มลิ้งคลิป
              </button>
            )}
          </div>
        )}

        {/* การตลาด — ตาราง metrics (แถว=ช่อง, คอลัมน์=metrics) */}
        {formData.department === 'การตลาด' && (formData.bestRoiChannel || channelRows.length > 0) && (() => {
          type MetricKey = 'liveStaffName' | 'adsCost' | 'grossRevenue' | 'roi' | 'costPerOrder' | 'costPer10SecView' | 'avgViewDuration' | 'newFollowers' | 'liveHours'
          const COLS: { key: MetricKey; label: string; unit: string; type: string }[] = [
            { key: 'liveStaffName',    label: 'พนักงาน', unit: '',     type: 'text'   },
            { key: 'adsCost',          label: 'ads',      unit: 'บาท',  type: 'number' },
            { key: 'grossRevenue',     label: 'รายได้',   unit: 'บาท',  type: 'number' },
            { key: 'roi',              label: 'ROI',      unit: 'บาท',  type: 'number' },
            { key: 'costPerOrder',     label: '/order',   unit: 'บาท',  type: 'number' },
            { key: 'costPer10SecView', label: '/10วิ',   unit: 'บาท',  type: 'number' },
            { key: 'avgViewDuration',  label: 'ดูเฉลี่ย', unit: 'วิ',   type: 'number' },
            { key: 'newFollowers',     label: 'ติดตาม',  unit: 'user', type: 'number' },
            { key: 'liveHours',        label: 'ชม.',      unit: 'ชม.',  type: 'number' },
          ]
          const renderCell = (value: string, onChange: (v: string) => void, type: string) => (
            <input
              type={type}
              min={type === 'number' ? '0' : undefined}
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-full text-xs text-center bg-transparent outline-none border-b border-gray-200 focus:border-[#1E3A5F] py-1.5 placeholder-gray-300"
              placeholder={type === 'number' ? '0' : '-'}
            />
          )
          return (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <p className="text-sm font-bold text-[#1E3A5F] px-4 pt-4 pb-2">📊 ข้อมูล metrics แต่ละช่อง</p>
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse" style={{ width: 'max-content', minWidth: '100%' }}>
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F5F6F8]">
                      <th className="sticky left-0 z-10 bg-[#F5F6F8] px-3 py-2 text-left font-semibold text-[#374151] whitespace-nowrap" style={{ minWidth: 88 }}>ช่อง</th>
                      {COLS.map(c => (
                        <th key={c.key} className="px-2 py-2 text-center font-semibold text-[#374151] whitespace-nowrap" style={{ minWidth: c.key === 'liveStaffName' ? 72 : 60 }}>
                          {c.label}
                          {c.unit && <span className="block text-[10px] font-normal text-gray-400">{c.unit}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.bestRoiChannel && (
                      <tr className="bg-green-50 border-b border-green-100">
                        <td className="sticky left-0 z-10 bg-green-50 px-3 py-2 font-semibold text-green-700 whitespace-nowrap" style={{ minWidth: 88 }}>
                          <span className="block leading-tight">⭐ {formData.bestRoiChannel}</span>
                          {bestRoiEntry.shift && (
                            <span className={`block text-[10px] font-semibold mt-0.5 ${bestRoiEntry.shift === 'เช้า' ? 'text-amber-500' : 'text-indigo-500'}`}>
                              {bestRoiEntry.shift === 'เช้า' ? '🌅 เช้า' : '🌙 บ่าย'}
                            </span>
                          )}
                        </td>
                        {COLS.map(c => (
                          <td key={c.key} className="px-1 py-1">
                            {renderCell(
                              bestRoiEntry[c.key],
                              v => setBestRoiEntry(prev => ({ ...prev, [c.key]: v })),
                              c.type
                            )}
                          </td>
                        ))}
                      </tr>
                    )}
                    {channelRows.map((row, idx) => {
                      const bg = idx % 2 === 0 ? 'bg-white' : 'bg-[#F5F6F8]/60'
                      return (
                        <tr key={row.id} className={`${bg} border-b border-[#E2E8F0]`}>
                          <td className={`sticky left-0 z-10 ${bg} px-3 py-2 font-medium text-[#374151] whitespace-nowrap`} style={{ minWidth: 88 }}>
                            <span className="block leading-tight">{row.channel}</span>
                            <span className={`block text-[10px] font-semibold mt-0.5 ${row.shift === 'เช้า' ? 'text-amber-500' : 'text-indigo-500'}`}>
                              {row.shift === 'เช้า' ? '🌅 เช้า' : '🌙 บ่าย'}
                            </span>
                          </td>
                          {COLS.map(c => (
                            <td key={c.key} className="px-1 py-1">
                              {renderCell(
                                row[c.key],
                                v => setChannelRows(prev => prev.map(r => r.id === row.id ? { ...r, [c.key]: v } : r)),
                                c.type
                              )}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* แพค */}
        {formData.department === 'แพค' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-bold text-[#1E3A5F] mb-3">ยอดการแพควันนี้</p>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-2">
                จำนวนชิ้นที่แพคได้
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={extra.packCount}
                  onChange={(e) => setExtra({ packCount: e.target.value })}
                  placeholder="0"
                  className={inputClass + ' pr-10'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  ชิ้น
                </span>
              </div>
            </div>
          </div>
        )}


        <Link
          href="/meeting-report"
          target="_blank"
          className="flex items-center gap-2.5 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-xl px-3 py-2.5 hover:bg-[#1E3A5F]/10 transition-colors"
        >
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center shrink-0 text-white text-sm">
            📝
          </div>
          <div>
            <p className="text-xs font-bold text-[#1E3A5F]">รายงานการประชุม</p>
            <p className="text-[10px] text-gray-400 mt-0.5">บันทึกและส่งรายงานให้ทีมงาน</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Obstacles */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-[#374151] mb-2">
            อุปสรรคที่เจอวันนี้
            <span className="text-xs font-normal text-gray-400 ml-2">(ไม่บังคับ)</span>
          </label>
          <textarea
            value={formData.obstacles}
            onChange={(e) => setFormData((prev) => ({ ...prev, obstacles: e.target.value }))}
            placeholder="อธิบายอุปสรรคที่พบ หากมี"
            rows={3}
            className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
          />
        </div>


        <Link
          href="/equipment"
          target="_blank"
          className="flex items-center gap-2 border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs text-gray-500 hover:border-[#1E3A5F] hover:text-[#1E3A5F] transition-colors"
        >
          <span>🔧</span>
          <span>แจ้งเบิกทุกอย่าง (ลัง/สินค้า/ค่าads/เสีย/เบิก/ซ่อม และอื่นๆ)</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSaveDraft}
          className="w-full border-2 border-[#1E3A5F] text-[#1E3A5F] py-3.5 rounded-xl font-bold text-base active:opacity-80"
        >
          บันทึกชั่วคราว
        </button>
        <button
          type="button"
          onClick={handleSubmitClick}
          className="w-full bg-[#1E3A5F] text-white py-4 rounded-xl font-bold text-base shadow-md active:opacity-90"
        >
          ตรวจสอบและส่งข้อมูล
        </button>

        <div className="text-center">
          <Link href="/complaint" className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
            ร้องเรียนด้านการทำงานร่วมกัน
          </Link>
        </div>
      </div>

      {/* Draft saved toast */}
      {draftSaved && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#1E3A5F] text-white text-sm font-semibold px-5 py-3 rounded-full shadow-lg z-50">
          บันทึกแบบร่างแล้ว ✓
        </div>
      )}

      {/* Code Verification Modal */}
      {formData.department && !codeVerified && pageState === 'form' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="bg-[#1E3A5F] text-white px-5 py-4 text-center">
              <div className="text-2xl mb-1">🔒</div>
              <h3 className="font-bold text-base">ยืนยันตัวตน</h3>
              <p className="text-xs opacity-70 mt-0.5">แผนก {formData.department}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#374151] mb-2 text-center">
                  กรอกรหัสผ่านแผนก (4 หลัก)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  maxLength={4}
                  value={codeInput}
                  onChange={(e) => {
                    const v = e.target.value.slice(0, 4)
                    setCodeInput(v)
                    setCodeError('')
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyCode() }}
                  placeholder="● ● ● ●"
                  className="w-full border-2 border-[#E2E8F0] rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-[#1E3A5F] text-[#1E3A5F]"
                  autoFocus
                />
                {codeError && (
                  <p className="text-[#DC2626] text-xs mt-2 text-center">{codeError}</p>
                )}
              </div>
              <button
                onClick={handleVerifyCode}
                disabled={verifying || codeInput.length < 4}
                className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                {verifying ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
              </button>
              <button
                onClick={() => {
                  setFormData((prev) => ({ ...prev, department: '' }))
                  setCodeInput('')
                  setCodeError('')
                }}
                className="w-full text-gray-400 text-xs py-1 hover:text-gray-600"
              >
                เปลี่ยนแผนก
              </button>

              {/* Quick links สำหรับ สต๊อค&จัดซื้อ */}
              {formData.department === 'สต๊อค&จัดซื้อ' && (
                <div className="pt-1 border-t border-[#E2E8F0] space-y-2">
                  <p className="text-xs text-gray-400 text-center">หรือไปที่</p>
                  <Link
                    href="/restock"
                    className="flex items-center gap-2 bg-[#DC2626]/5 border border-[#DC2626]/20 rounded-xl px-3 py-2.5 hover:bg-[#DC2626]/10 transition-colors"
                  >
                    <span className="text-base">⚠️</span>
                    <p className="text-xs font-bold text-[#DC2626]">แจ้งสินค้าต้อง Restock (เฉพาะบอสที่สั่งได้)</p>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#DC2626] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    href="/stock-arrival"
                    className="flex items-center gap-2 bg-[#16A34A]/5 border border-[#16A34A]/20 rounded-xl px-3 py-2.5 hover:bg-[#16A34A]/10 transition-colors"
                  >
                    <span className="text-base">📦</span>
                    <p className="text-xs font-bold text-[#16A34A]">แจ้งสินค้าเข้า</p>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#16A34A] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <Link
                    href="/stock-prices"
                    className="flex items-center gap-2 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-xl px-3 py-2.5 hover:bg-[#1E3A5F]/10 transition-colors"
                  >
                    <span className="text-base">📋</span>
                    <p className="text-xs font-bold text-[#1E3A5F]">ดูราคาขายสินค้า</p>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {(pageState === 'confirm' || pageState === 'submitting') && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-bold text-[#1E3A5F]">ตรวจสอบข้อมูลก่อนส่ง</h3>
              <p className="text-xs text-gray-400 mt-0.5">กรุณาตรวจสอบความถูกต้องก่อนยืนยัน</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ConfirmRow label="แผนก" value={formData.department} />
                <ConfirmRow label="วันที่ / เวลา" value={`${formData.date}  ${formData.time} น.`} />
                <ConfirmRow label="ชื่อเล่น" value={formData.nickname} />
                {(formData.department === 'การตลาด' ? channelRows.length > 0 : formData.channelName.length > 0) && (
                  <ConfirmRow
                    label={formData.department === 'การตลาด' ? 'ช่องที่ ROI ต่ำกว่า 15' : 'ช่องที่ดูแล'}
                    value={formData.department === 'การตลาด'
                      ? channelRows.map(r => `${r.channel}(${r.shift})`).join(', ')
                      : formData.channelName.join(', ')}
                  />
                )}
                {formData.department === 'การตลาด' && formData.bestRoiChannel && (
                  <ConfirmRow label="ช่องที่ ROI สูงสุด" value={formData.bestRoiChannel} />
                )}
              </div>

              {/* Extra fields in confirm — ไลฟ์สด / sale admin */}
              {LIVE_DEPTS.includes(formData.department) && extraPayload && (
                <div className="grid grid-cols-2 gap-4 pt-1 border-t border-[#E2E8F0]">
                  {formData.department === 'ไลฟ์สด' && extra.liveHours && (
                    <ConfirmRow label="ชั่วโมงไลฟ์" value={`${extra.liveHours} ชั่วโมง`} />
                  )}
                  {extra.salesAmount && (
                    <ConfirmRow
                      label="ยอดขาย"
                      value={`${Number(extra.salesAmount).toLocaleString()} บาท`}
                    />
                  )}
                </div>
              )}

              {/* Extra fields in confirm — แพค */}
              {formData.department === 'แพค' && extra.packCount && (
                <div className="grid grid-cols-2 gap-4 pt-1 border-t border-[#E2E8F0]">
                  <ConfirmRow label="จำนวนชิ้นที่แพคได้" value={`${Number(extra.packCount).toLocaleString()} ชิ้น`} />
                </div>
              )}


              {/* Extra fields in confirm — Creative */}
              {formData.department === 'Creative' &&
                extra.clipLinks.some((l) => l.trim()) && (
                  <div className="pt-1 border-t border-[#E2E8F0]">
                    <p className="text-xs text-gray-500 mb-2">ลิ้งคลิปที่ทำเสร็จ</p>
                    <ul className="space-y-1">
                      {extra.clipLinks
                        .filter((l) => l.trim())
                        .map((link, i) => (
                          <li key={i} className="text-xs text-[#1E3A5F] truncate">
                            {i + 1}. {link}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

              {/* Extra fields in confirm — การตลาด */}
              {formData.department === 'การตลาด' && channelRows.length > 0 && (
                <div className="pt-1 border-t border-[#E2E8F0]">
                  <p className="text-xs text-gray-500 mb-2">ข้อมูลช่อง ({channelRows.length} แถว)</p>
                  <div className="space-y-2">
                    {channelRows.map((row) => (
                      <div key={row.id} className="bg-[#F5F6F8] rounded-xl p-2.5">
                        <p className="text-xs font-bold text-[#1E3A5F]">
                          {row.channel}
                          <span className={`ml-1.5 text-[10px] font-semibold ${row.shift === 'เช้า' ? 'text-amber-500' : 'text-indigo-500'}`}>
                            {row.shift === 'เช้า' ? '🌅 เช้า' : '🌙 บ่าย'}
                          </span>
                        </p>
                        {row.liveStaffName && (
                          <p className="text-xs text-gray-500 mt-0.5">พนักงานไลฟ์: {row.liveStaffName}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 mb-2">สิ่งที่ทำวันนี้</p>
                <ul className="space-y-1.5">
                  {formData.tasks
                    .filter((t) => t.trim())
                    .map((task, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-gray-400 shrink-0">{i + 1}.</span>
                        <span className="text-[#374151]">{task}</span>
                      </li>
                    ))}
                </ul>
              </div>
              {formData.obstacles.trim() && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">อุปสรรคที่เจอ</p>
                  <p className="text-sm text-[#374151] bg-[#F5F6F8] rounded-xl p-3">
                    {formData.obstacles}
                  </p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-3">
              <button
                type="button"
                onClick={() => setPageState('form')}
                disabled={pageState === 'submitting'}
                className="flex-1 py-3 rounded-xl border-2 border-[#E2E8F0] text-[#374151] font-semibold text-sm disabled:opacity-50"
              >
                แก้ไข
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pageState === 'submitting'}
                className="flex-1 py-3 rounded-xl bg-[#16A34A] text-white font-bold text-sm disabled:opacity-70"
              >
                {pageState === 'submitting' ? 'กำลังส่งข้อมูล...' : 'ยืนยันส่งข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
