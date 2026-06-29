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
  // การตลาด
  adsShopee: string
  adsLazada: string
  adsTiktok: string
  adsFacebook: string
  // แพค
  packCount: string
  // Upselling
  upsellingOrders: { initial: string; freebie: string; final: string }[]
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
  upsellingOrders: [{ initial: '', freebie: '', final: '' }],
}

interface FormData {
  department: string
  date: string
  time: string
  nickname: string
  channelName: string[]
  tasks: string[]
  obstacles: string
  extraData: ExtraData
}

type PageState = 'form' | 'confirm' | 'submitting' | 'success'

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

const CHANNEL_DEPTS = ['ไลฟ์สด', 'sale admin', 'การตลาด', 'Creative']
const CHANNEL_LIST = [
  'gap7cardbreak', 'pokedex', 'nanatoshop', 'jokercardshop',
  'ninjabearcardshop', 'rabbitcardshop', 'littleponycardshop', 'stadiumbreaks',
  'crazycardshop', 'catramencardshop', 'dekocardshop', 'phoenixcardshop',
  'pandacollectorshop', 'huskkycardshop', 'kingdomcardshop',
  'corgi card TCG', 'mojiko card TCG',
]
const LIVE_DEPTS = ['ไลฟ์สด', 'sale admin']
const TAX_INVOICE_DEPTS = ['บัญชี', 'สต๊อค&จัดซื้อ', 'ธุรการ']
const UPSELLING_DEPTS = ['ไลฟ์สด', 'sale admin']
const VIP_BIRTHDAY_DEPTS = ['ไลฟ์สด', 'การตลาด', 'ผู้จัดการ']

function buildExtraDataPayload(dept: string, extra: ExtraData): Record<string, unknown> | undefined {
  if (dept === 'ไลฟ์สด') {
    const payload: Record<string, unknown> = {}
    if (extra.liveHours.trim()) payload.live_hours = extra.liveHours.trim()
    if (extra.salesAmount.trim()) payload.sales_amount = extra.salesAmount.trim()
    const validOrders = extra.upsellingOrders.filter(o => o.initial.trim() || o.final.trim())
    if (validOrders.length > 0) payload.upselling_orders = validOrders
    return Object.keys(payload).length > 0 ? payload : undefined
  }
  if (dept === 'sale admin') {
    const payload: Record<string, unknown> = {}
    if (extra.salesAmount.trim()) payload.sales_amount = extra.salesAmount.trim()
    const validOrders = extra.upsellingOrders.filter(o => o.initial.trim() || o.final.trim())
    if (validOrders.length > 0) payload.upselling_orders = validOrders
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
    const payload: Record<string, unknown> = {}
    if (extra.adsShopee.trim()) payload.ads_shopee = extra.adsShopee.trim()
    if (extra.adsLazada.trim()) payload.ads_lazada = extra.adsLazada.trim()
    if (extra.adsTiktok.trim()) payload.ads_tiktok = extra.adsTiktok.trim()
    if (extra.adsFacebook.trim()) payload.ads_facebook = extra.adsFacebook.trim()
    return Object.keys(payload).length > 0 ? payload : undefined
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
    tasks: [''],
    obstacles: '',
    extraData: { ...defaultExtraData, clipLinks: [''] },
  })
  const [pageState, setPageState] = useState<PageState>('form')
  const [submittedId, setSubmittedId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [hasDraft, setHasDraft] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)

  useEffect(() => {
    if (loadDraft()) setHasDraft(true)
  }, [])

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
    if (!formData.nickname.trim()) e.nickname = 'กรุณากรอกชื่อเล่น'
    if (CHANNEL_DEPTS.includes(formData.department) && formData.channelName.length === 0) e.channelName = 'กรุณาเลือกช่องที่ดูแลอย่างน้อย 1 ช่อง'
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
    const extra_data = buildExtraDataPayload(formData.department, formData.extraData)
    try {
      const res = await fetch('/api/kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: formData.department,
          date: formData.date,
          time: formData.time,
          nickname: formData.nickname.trim(),
          channel_name: formData.channelName.join(', '),
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
      tasks: [''],
      obstacles: '',
      extraData: { ...defaultExtraData, clipLinks: [''] },
    })
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
  const extraPayload = buildExtraDataPayload(formData.department, extra)

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 text-center shadow-md">
        <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
        <p className="text-sm mt-1" style={{ opacity: 0.75 }}>
          บันทึก KPI รายวัน
        </p>
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
                    extraData: { ...defaultExtraData, clipLinks: [''] },
                  }))
                  setErrors((prev) => ({ ...prev, department: '' }))
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
              href="/restock"
              className="flex items-center gap-3 bg-[#DC2626]/5 border border-[#DC2626]/20 rounded-2xl p-4 hover:bg-[#DC2626]/10 transition-colors"
            >
              <div className="w-10 h-10 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
                ⚠️
              </div>
              <div>
                <p className="text-sm font-bold text-[#DC2626]">แจ้งสินค้าต้อง Restock</p>
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
          <InputField label="ชื่อเล่น" required error={errors.nickname}>
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
          </InputField>
          {CHANNEL_DEPTS.includes(formData.department) && (
            <InputField label="ช่องที่ดูแล" required error={errors.channelName}>
              <div className="flex flex-wrap gap-2 pt-0.5">
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

        {/* ── Department-specific fields ── */}

        {/* บัญชี / สต๊อค&จัดซื้อ — ลิงก์ใบกำกับภาษี */}
        {TAX_INVOICE_DEPTS.includes(formData.department) && (
          <Link
            href="/tax-invoice"
            className="flex items-center gap-3 bg-[#1E3A5F]/5 border border-[#1E3A5F]/20 rounded-2xl p-4 hover:bg-[#1E3A5F]/10 transition-colors"
          >
            <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-lg">
              🧾
            </div>
            <div>
              <p className="text-sm font-bold text-[#1E3A5F]">รวมใบกำกับภาษีซื้อ</p>
              <p className="text-xs text-gray-400 mt-0.5">อัปโหลดใบกำกับ → สรุป VAT ซื้อรายเดือน</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#1E3A5F] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <p className="text-sm font-bold text-[#534AB7]">VIP Birthday</p>
              <p className="text-xs text-gray-400 mt-0.5">จัดการข้อมูลวันเกิดลูกค้า VIP</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#534AB7] ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <p className="text-sm font-bold text-[#1E3A5F]">ขอสินค้าสำหรับไลฟ์</p>
              <p className="text-xs text-gray-400 mt-0.5">แนบรูปสินค้าและรายละเอียด → Admin อนุมัติ</p>
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

        {/* Upselling */}
        {UPSELLING_DEPTS.includes(formData.department) && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#1E3A5F]">อัพเซลล์วันนี้</p>
              <span className="text-xs text-gray-400">{extra.upsellingOrders.length}/15 order</span>
            </div>
            {extra.upsellingOrders.map((order, i) => {
              const diff = order.initial && order.final ? Number(order.final) - Number(order.initial) : null
              return (
                <div key={i} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#1E3A5F]">Order #{i + 1}</span>
                    {extra.upsellingOrders.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setExtra({ upsellingOrders: extra.upsellingOrders.filter((_, idx) => idx !== i) })}
                        className="text-gray-300 hover:text-[#DC2626] text-lg leading-none w-6 h-6 flex items-center justify-center"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">ยอดแรก (บาท)</label>
                      <input
                        type="number" min="0"
                        value={order.initial}
                        onChange={(e) => {
                          const orders = [...extra.upsellingOrders]
                          orders[i] = { ...orders[i], initial: e.target.value }
                          setExtra({ upsellingOrders: orders })
                        }}
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">ยอดสุดท้าย (บาท)</label>
                      <input
                        type="number" min="0"
                        value={order.final}
                        onChange={(e) => {
                          const orders = [...extra.upsellingOrders]
                          orders[i] = { ...orders[i], final: e.target.value }
                          setExtra({ upsellingOrders: orders })
                        }}
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">ของแถมที่เสนอ</label>
                    <input
                      type="text"
                      value={order.freebie}
                      onChange={(e) => {
                        const orders = [...extra.upsellingOrders]
                        orders[i] = { ...orders[i], freebie: e.target.value }
                        setExtra({ upsellingOrders: orders })
                      }}
                      placeholder="เช่น แฟ้ม A4, กระเป๋า"
                      className={inputClass}
                    />
                  </div>
                  {diff !== null && diff > 0 && (
                    <div className="bg-[#16A34A]/10 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                      <span className="text-xs">📈</span>
                      <span className="text-xs font-bold text-[#16A34A]">+{diff.toLocaleString()} บาท</span>
                    </div>
                  )}
                </div>
              )
            })}
            {extra.upsellingOrders.length < 15 && (
              <button
                type="button"
                onClick={() => setExtra({ upsellingOrders: [...extra.upsellingOrders, { initial: '', freebie: '', final: '' }] })}
                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-2.5 text-sm text-gray-400 hover:border-[#1E3A5F] hover:text-[#1E3A5F] transition-colors"
              >
                + เพิ่ม Order
              </button>
            )}
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

        {/* การตลาด */}
        {formData.department === 'การตลาด' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-bold text-[#1E3A5F]">ค่า Ads วันนี้ (บาท)</p>
            {(
              [
                { key: 'adsShopee', label: 'Shopee' },
                { key: 'adsLazada', label: 'Lazada' },
                { key: 'adsTiktok', label: 'TikTok' },
                { key: 'adsFacebook', label: 'Facebook' },
              ] as { key: keyof ExtraData; label: string }[]
            ).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-sm text-[#374151] font-medium w-20 shrink-0">{label}</span>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    value={extra[key] as string}
                    onChange={(e) => setExtra({ [key]: e.target.value } as Partial<ExtraData>)}
                    placeholder="0"
                    className={inputClass + ' pr-10'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    บาท
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden">
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
                    <p className="text-xs font-bold text-[#DC2626]">แจ้งสินค้าต้อง Restock</p>
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
                {formData.channelName.length > 0 && (
                  <ConfirmRow label="ช่องที่ดูแล" value={formData.channelName.join(', ')} />
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
              {formData.department === 'การตลาด' && extraPayload && (
                <div className="pt-1 border-t border-[#E2E8F0]">
                  <p className="text-xs text-gray-500 mb-2">ค่า Ads วันนี้</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { k: 'adsShopee', l: 'Shopee' },
                      { k: 'adsLazada', l: 'Lazada' },
                      { k: 'adsTiktok', l: 'TikTok' },
                      { k: 'adsFacebook', l: 'Facebook' },
                    ]
                      .filter(({ k }) => extra[k as keyof ExtraData])
                      .map(({ k, l }) => (
                        <ConfirmRow
                          key={k}
                          label={l}
                          value={`${Number(extra[k as keyof ExtraData]).toLocaleString()} บาท`}
                        />
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
