'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const NICKNAME_KEY = 'gap_kpi_nickname'
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

function buddhistDateLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`
}
function buddhistMonthYear(isoMonth: string) {
  const [y, m] = isoMonth.split('-').map(Number)
  return `${THAI_MONTHS[m - 1]} ${y + 543}`
}
function todayISO() { return new Date().toLocaleDateString('sv-SE') }
function thisMonthISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function toMin(t: string): number | null {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function fmtHours(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`
}
function calcMins(start: string, end: string): number | null {
  const s = toMin(start), e = toMin(end)
  if (s === null || e === null) return null
  return (e <= s ? e + 1440 : e) - s
}

const PLATFORMS = ['TikTok', 'Shopee', 'Facebook', 'อื่นๆ']
const PROMO_TYPES = ['โปรซื้อครบ', 'เคลียร์สปอร์ต', 'แถมตาม SKU', 'อื่นๆ']

interface SalesRow { product_name: string; qty_box: string; qty_pack: string; amount: string; platform: string; note: string }
interface GiftRow  { gift_name: string; promo_type: string; qty: string; unit: string; price: string; note: string }

function blankSales(): SalesRow { return { product_name: '', qty_box: '', qty_pack: '', amount: '', platform: 'TikTok', note: '' } }
function blankGift(): GiftRow  { return { gift_name: '', promo_type: 'โปรซื้อครบ', qty: '1', unit: 'ชิ้น', price: '', note: '' } }

interface DailyLogRow { date: string; tiktok_start: string; tiktok_end: string; fb_start: string; fb_end: string; sales_shopee: number; sales_tiktok: number; sales_outside_tiktok: number; sales_outside_fb: number; obstacles: string; suggestions: string; note: string }
interface HistoryEntry { date: string; daily_log: DailyLogRow | null; sales: Record<string, unknown>[]; gifts: Record<string, unknown>[] }

const inputCls = 'w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white'
const smallInputCls = 'w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white'

export default function LiveReportPage() {
  const [tab, setTab] = useState<'form' | 'history'>('form')

  // Meta
  const [nickname, setNickname] = useState('')
  const [date, setDate] = useState(todayISO())

  // ชั่วโมงไลฟ์
  const [tiktokStart, setTiktokStart] = useState('')
  const [tiktokEnd, setTiktokEnd] = useState('')
  const [fbStart, setFbStart] = useState('')
  const [fbEnd, setFbEnd] = useState('')

  // ยอดขายรวม (aggregate by platform)
  const [salesShopee, setSalesShopee] = useState('')
  const [salesTiktok, setSalesTiktok] = useState('')
  const [salesOutsideTiktok, setSalesOutsideTiktok] = useState('')
  const [salesOutsideFb, setSalesOutsideFb] = useState('')

  // รายงานการขาย (per-product)
  const [salesRows, setSalesRows] = useState<SalesRow[]>([blankSales()])

  // ของแถม
  const [giftRows, setGiftRows] = useState<GiftRow[]>([blankGift()])

  // หมายเหตุ
  const [obstacles, setObstacles] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [note, setNote] = useState('')

  // Submission
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)

  // History
  const [histMonth, setHistMonth] = useState(thisMonthISO())
  const [histNick, setHistNick] = useState('')
  const [history, setHistory] = useState<HistoryEntry[] | null>(null)
  const [histLoading, setHistLoading] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NICKNAME_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (typeof parsed === 'string' && parsed.trim()) {
          setNickname(parsed.trim())
          setHistNick(parsed.trim())
        }
      }
    } catch { /* */ }
  }, [])

  // KPI calculation
  const ttMin = calcMins(tiktokStart, tiktokEnd)
  const fbMin = calcMins(fbStart, fbEnd)
  const totalLiveMin = (ttMin ?? 0) + (fbMin ?? 0)
  const hasAnyHours = ttMin !== null || fbMin !== null
  const isDay = tiktokStart ? (toMin(tiktokStart) ?? 0) < 960 : fbStart ? (toMin(fbStart) ?? 0) < 960 : true
  const kpiTarget = isDay ? 360 : 300
  const kpiMin = isDay ? 330 : 270

  // Aggregate sales total
  const aggTotal = [salesShopee, salesTiktok, salesOutsideTiktok, salesOutsideFb]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0)

  // Sales row helpers
  function updateSales(i: number, patch: Partial<SalesRow>) { setSalesRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row)) }
  function removeSales(i: number) { setSalesRows(r => r.filter((_, idx) => idx !== i)) }

  // Gift row helpers
  function updateGift(i: number, patch: Partial<GiftRow>) { setGiftRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row)) }
  function removeGift(i: number) { setGiftRows(r => r.filter((_, idx) => idx !== i)) }

  const validSales = salesRows.filter(s => s.product_name.trim())
  const validGifts = giftRows.filter(g => g.gift_name.trim())

  const hasDailyLog = !!(tiktokStart || fbStart || aggTotal > 0 || obstacles.trim() || suggestions.trim() || note.trim())

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/live-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          date,
          daily_log: hasDailyLog ? {
            tiktok_start: tiktokStart, tiktok_end: tiktokEnd,
            fb_start: fbStart, fb_end: fbEnd,
            sales_shopee: parseFloat(salesShopee) || 0,
            sales_tiktok: parseFloat(salesTiktok) || 0,
            sales_outside_tiktok: parseFloat(salesOutsideTiktok) || 0,
            sales_outside_fb: parseFloat(salesOutsideFb) || 0,
            obstacles: obstacles.trim(), suggestions: suggestions.trim(), note: note.trim(),
          } : undefined,
          sales: validSales.map(s => ({
            product_name: s.product_name.trim(),
            qty_box: parseFloat(s.qty_box) || 0,
            qty_pack: parseFloat(s.qty_pack) || 0,
            amount: parseFloat(s.amount) || 0,
            platform: s.platform, note: s.note.trim(),
          })),
          gifts: validGifts.map(g => ({
            gift_name: g.gift_name.trim(), promo_type: g.promo_type,
            qty: parseInt(g.qty) || 1, unit: g.unit.trim(),
            price: parseFloat(g.price) || 0, note: g.note.trim(),
          })),
        }),
      })
      if (res.ok) {
        setShowConfirm(false)
        setSubmitDone(true)
        // Reset form
        setTiktokStart(''); setTiktokEnd(''); setFbStart(''); setFbEnd('')
        setSalesShopee(''); setSalesTiktok(''); setSalesOutsideTiktok(''); setSalesOutsideFb('')
        setSalesRows([blankSales()]); setGiftRows([blankGift()])
        setObstacles(''); setSuggestions(''); setNote('')
      }
    } catch { /* */ } finally { setSubmitting(false) }
  }

  const loadHistory = useCallback(async (nick: string, mo: string) => {
    if (!nick.trim()) return
    setHistLoading(true)
    setHistory(null)
    try {
      const res = await fetch(`/api/live-report?nickname=${encodeURIComponent(nick.trim())}&month=${mo}`)
      const data = await res.json() as {
        sales: Record<string, unknown>[]
        gifts: Record<string, unknown>[]
        daily_logs: DailyLogRow[]
      }
      const dateSet: Record<string, true> = {}
      data.sales.forEach(r => { dateSet[String(r.date)] = true })
      data.gifts.forEach(r => { dateSet[String(r.date)] = true })
      data.daily_logs?.forEach(r => { dateSet[r.date] = true })
      const allDates = Object.keys(dateSet).sort()
      const entries: HistoryEntry[] = allDates.map(d => ({
        date: d,
        daily_log: data.daily_logs?.find(r => r.date === d) ?? null,
        sales: data.sales.filter(r => String(r.date) === d),
        gifts: data.gifts.filter(r => String(r.date) === d),
      }))
      setHistory(entries)
    } catch { setHistory([]) } finally { setHistLoading(false) }
  }, [])

  useEffect(() => { if (tab === 'history' && histNick.trim()) loadHistory(histNick, histMonth) }, [tab, histMonth, loadHistory])

  function prevHistMonth() {
    const [y, m] = histMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setHistMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextHistMonth() {
    const [y, m] = histMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setHistMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const canSubmit = nickname.trim() && date && (hasDailyLog || validSales.length > 0 || validGifts.length > 0)

  return (
    <div className="min-h-screen bg-[#F5F6F8] font-['Sarabun']">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-4 flex items-center gap-3">
        <Link href="/" className="text-white/70 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-bold">รายงานการขาย-ของแถม</h1>
          <p className="text-xs text-white/60">บันทึกชั่วโมงไลฟ์ ยอดขาย และของแถมรายวัน</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] bg-white sticky top-0 z-10">
        {(['form', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === t ? 'text-[#1E3A5F] border-b-2 border-[#1E3A5F]' : 'text-gray-400'}`}>
            {t === 'form' ? '✏️ กรอกรายงาน' : '📋 ประวัติ'}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* ===== FORM TAB ===== */}
        {tab === 'form' && (
          <>
            {submitDone && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center space-y-1">
                <div className="text-2xl">✅</div>
                <p className="text-sm font-bold text-green-700">บันทึกสำเร็จ!</p>
                <button onClick={() => setSubmitDone(false)} className="text-xs text-green-600 underline mt-1">กรอกรายการใหม่</button>
              </div>
            )}

            {/* Meta */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-[#1E3A5F]">ข้อมูลทั่วไป</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">ชื่อเล่น <span className="text-red-500">*</span></label>
                  <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="ชื่อเล่น" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">วันที่ <span className="text-red-500">*</span></label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* ชั่วโมงไลฟ์ */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
                ⚡ กะกลางวัน: เป้า <strong>6 ชม.</strong> / min <strong>5:30 ชม.</strong>&nbsp;|&nbsp;กะกลางคืน: เป้า <strong>5 ชม.</strong> / min <strong>4:30 ชม.</strong>
              </div>
              <p className="text-sm font-bold text-[#1E3A5F]">⏱️ ชั่วโมงไลฟ์ <span className="font-normal text-gray-400 text-xs">(ไม่บังคับ)</span></p>
              {/* TikTok */}
              <div>
                <p className="text-xs font-semibold text-[#374151] mb-2">📱 TikTok</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">เวลาขึ้นไลฟ์</label>
                    <input type="time" value={tiktokStart} onChange={e => setTiktokStart(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">เวลาลงไลฟ์</label>
                    <input type="time" value={tiktokEnd} onChange={e => setTiktokEnd(e.target.value)} className={inputCls} />
                  </div>
                </div>
                {ttMin !== null && (
                  <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${ttMin >= kpiTarget ? 'bg-green-50 text-green-700' : ttMin >= kpiMin ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>
                    {ttMin >= kpiTarget ? '✅' : ttMin >= kpiMin ? '⚠️' : '❌'}
                    {fmtHours(ttMin)} — {ttMin >= kpiTarget ? `ครบ KPI ${isDay ? 'กะกลางวัน' : 'กะกลางคืน'}` : ttMin >= kpiMin ? 'เกินขั้นต่ำ ยังไม่ถึงเป้า' : `ต่ำกว่าขั้นต่ำ (${isDay ? '5:30' : '4:30'} ชม.)`}
                  </div>
                )}
              </div>
              {/* Facebook */}
              <div>
                <p className="text-xs font-semibold text-[#374151] mb-2">📘 Facebook</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">เวลาขึ้นไลฟ์</label>
                    <input type="time" value={fbStart} onChange={e => setFbStart(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">เวลาลงไลฟ์</label>
                    <input type="time" value={fbEnd} onChange={e => setFbEnd(e.target.value)} className={inputCls} />
                  </div>
                </div>
                {fbMin !== null && (
                  <div className="mt-2 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-50 text-gray-600">
                    📘 {fmtHours(fbMin)}
                  </div>
                )}
              </div>
              {hasAnyHours && (
                <div className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${totalLiveMin >= kpiTarget ? 'bg-green-100 text-green-800' : totalLiveMin >= kpiMin ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'}`}>
                  รวมทั้งหมด: {fmtHours(totalLiveMin)}
                </div>
              )}
            </div>

            {/* ยอดขายรวม (aggregate) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <p className="text-sm font-bold text-[#1E3A5F]">💰 ยอดขายรวม <span className="font-normal text-gray-400 text-xs">(ทุกช่องไม่บังคับ)</span></p>
              {([
                ['Shopee',           salesShopee,        setSalesShopee],
                ['TikTok',           salesTiktok,         setSalesTiktok],
                ['โยนนอก TikTok',    salesOutsideTiktok,  setSalesOutsideTiktok],
                ['โยนนอก Facebook',  salesOutsideFb,      setSalesOutsideFb],
              ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-[#374151] w-[130px] shrink-0">{label}</span>
                  <div className="relative flex-1">
                    <input type="number" min="0" value={val} onChange={e => setter(e.target.value)} placeholder="0"
                      className={inputCls + ' pr-10'} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">บาท</span>
                  </div>
                </div>
              ))}
              {aggTotal > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-[#E2E8F0]">
                  <span className="text-xs font-semibold text-[#374151]">รวมทั้งหมด</span>
                  <span className="text-base font-bold text-[#1E3A5F]">{aggTotal.toLocaleString('th-TH')} บาท</span>
                </div>
              )}
            </div>

            {/* รายงานการขาย (per-product) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#1E3A5F]">รายงานการขาย (รายสินค้า)</h2>
                <span className="text-xs text-gray-400">{validSales.length} รายการ</span>
              </div>
              {salesRows.map((row, i) => (
                <div key={i} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">สินค้า #{i + 1}</span>
                    {salesRows.length > 1 && (
                      <button onClick={() => removeSales(i)} className="text-xs text-red-400 hover:text-red-600">ลบ</button>
                    )}
                  </div>
                  <input value={row.product_name} onChange={e => updateSales(i, { product_name: e.target.value })}
                    placeholder="ชื่อสินค้า" className={smallInputCls} />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ยกกล่อง</label>
                      <input type="number" value={row.qty_box} onChange={e => updateSales(i, { qty_box: e.target.value })}
                        placeholder="0" min="0" className={smallInputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ยกแพ็ค</label>
                      <input type="number" value={row.qty_pack} onChange={e => updateSales(i, { qty_pack: e.target.value })}
                        placeholder="0" min="0" className={smallInputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ยอด (บาท)</label>
                      <input type="number" value={row.amount} onChange={e => updateSales(i, { amount: e.target.value })}
                        placeholder="0" min="0" className={smallInputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">แพลตฟอร์ม</label>
                      <select value={row.platform} onChange={e => updateSales(i, { platform: e.target.value })}
                        className={smallInputCls}>
                        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">หมายเหตุ</label>
                      <input value={row.note} onChange={e => updateSales(i, { note: e.target.value })}
                        placeholder="(ไม่จำเป็น)" className={smallInputCls} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setSalesRows(r => [...r, blankSales()])}
                className="w-full border-2 border-dashed border-[#1E3A5F]/30 rounded-xl py-2.5 text-sm text-[#1E3A5F] font-semibold hover:bg-[#1E3A5F]/5 transition-colors">
                + เพิ่มสินค้า
              </button>
            </div>

            {/* ของแถม */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#1E3A5F]">ของแถม</h2>
                <span className="text-xs text-gray-400">{validGifts.length} รายการ</span>
              </div>
              {giftRows.map((row, i) => (
                <div key={i} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">ของแถม #{i + 1}</span>
                    {giftRows.length > 1 && (
                      <button onClick={() => removeGift(i)} className="text-xs text-red-400 hover:text-red-600">ลบ</button>
                    )}
                  </div>
                  <input value={row.gift_name} onChange={e => updateGift(i, { gift_name: e.target.value })}
                    placeholder="ชื่อของแถม" className={smallInputCls} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ประเภทโปร</label>
                      <select value={row.promo_type} onChange={e => updateGift(i, { promo_type: e.target.value })}
                        className={smallInputCls}>
                        {PROMO_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">จำนวน</label>
                      <div className="flex gap-1">
                        <input type="number" value={row.qty} onChange={e => updateGift(i, { qty: e.target.value })}
                          placeholder="1" min="1" className="flex-1 min-w-0 border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white" />
                        <input value={row.unit} onChange={e => updateGift(i, { unit: e.target.value })}
                          placeholder="ชิ้น" className="w-14 border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ราคา (บาท)</label>
                      <input type="number" value={row.price} onChange={e => updateGift(i, { price: e.target.value })}
                        placeholder="0" min="0" className={smallInputCls} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">หมายเหตุ</label>
                      <input value={row.note} onChange={e => updateGift(i, { note: e.target.value })}
                        placeholder="(ไม่จำเป็น)" className={smallInputCls} />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={() => setGiftRows(r => [...r, blankGift()])}
                className="w-full border-2 border-dashed border-[#16A34A]/30 rounded-xl py-2.5 text-sm text-[#16A34A] font-semibold hover:bg-green-50 transition-colors">
                + เพิ่มของแถม
              </button>
            </div>

            {/* หมายเหตุ */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
              <p className="text-sm font-bold text-[#1E3A5F]">📝 หมายเหตุและข้อเสนอแนะ <span className="font-normal text-gray-400 text-xs">(ไม่บังคับ)</span></p>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-2">ปัญหาและอุปสรรค / หมายเหตุ</label>
                <textarea value={obstacles} onChange={e => setObstacles(e.target.value)}
                  placeholder="เช่น ไลฟ์ไม่ครบเพราะประชุม / เน็ตหลุด / ลูกค้าน้อย..."
                  rows={3} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-2">แนวทางแก้ไข / ข้อเสนอแนะ</label>
                <textarea value={suggestions} onChange={e => setSuggestions(e.target.value)}
                  placeholder="เช่น จะชดชั่วโมงพรุ่งนี้ / เปลี่ยนมือถือที่ใช้ไลฟ์..."
                  rows={3} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-2">หมายเหตุ</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="เช่น วันหยุด / พักร้อน / ชด 30 นาที..."
                  className={inputCls} />
              </div>
            </div>

            {/* Submit */}
            <button disabled={!canSubmit} onClick={() => setShowConfirm(true)}
              className="w-full bg-[#1E3A5F] text-white rounded-2xl py-4 text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1E3A5F]/90 transition-colors">
              บันทึกรายงาน
            </button>
          </>
        )}

        {/* ===== HISTORY TAB ===== */}
        {tab === 'history' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex gap-2">
                <input value={histNick} onChange={e => setHistNick(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadHistory(histNick, histMonth)}
                  placeholder="ชื่อเล่น" className={inputCls} />
                <button onClick={() => loadHistory(histNick, histMonth)}
                  className="bg-[#1E3A5F] text-white px-4 rounded-xl text-sm font-semibold shrink-0">ค้นหา</button>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={prevHistMonth} className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-[#374151] hover:bg-gray-50">‹</button>
                <span className="text-sm font-bold text-[#1E3A5F]">{buddhistMonthYear(histMonth)}</span>
                <button onClick={nextHistMonth} className="w-9 h-9 rounded-xl border border-[#E2E8F0] flex items-center justify-center text-[#374151] hover:bg-gray-50">›</button>
              </div>
            </div>

            {histLoading && <div className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</div>}
            {history !== null && history.length === 0 && !histLoading && (
              <div className="text-center py-8 text-gray-400 text-sm">ไม่พบข้อมูลในเดือนนี้</div>
            )}

            {history?.map(entry => {
              const dl = entry.daily_log
              const dlTtMin = dl ? calcMins(dl.tiktok_start, dl.tiktok_end) : null
              const dlFbMin = dl ? calcMins(dl.fb_start, dl.fb_end) : null
              const dlTotalLive = (dlTtMin ?? 0) + (dlFbMin ?? 0)
              const dlAggTotal = dl ? dl.sales_shopee + dl.sales_tiktok + dl.sales_outside_tiktok + dl.sales_outside_fb : 0
              return (
                <div key={entry.date} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                  <p className="text-sm font-bold text-[#1E3A5F]">📅 {buddhistDateLabel(entry.date)}</p>

                  {/* Live hours */}
                  {dl && (dlTtMin !== null || dlFbMin !== null) && (
                    <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-800 space-y-1">
                      {dlTtMin !== null && <div>📱 TikTok: <strong>{fmtHours(dlTtMin)}</strong> ({dl.tiktok_start} – {dl.tiktok_end})</div>}
                      {dlFbMin !== null && <div>📘 Facebook: <strong>{fmtHours(dlFbMin)}</strong> ({dl.fb_start} – {dl.fb_end})</div>}
                      {(dlTtMin !== null || dlFbMin !== null) && (
                        <div className="pt-1 border-t border-blue-200 font-semibold">รวม: {fmtHours(dlTotalLive)}</div>
                      )}
                    </div>
                  )}

                  {/* Aggregate sales */}
                  {dl && dlAggTotal > 0 && (
                    <div className="bg-green-50 rounded-xl px-3 py-2 text-xs text-green-800 space-y-1">
                      {dl.sales_shopee > 0 && <div>Shopee: {dl.sales_shopee.toLocaleString('th-TH')} บาท</div>}
                      {dl.sales_tiktok > 0 && <div>TikTok: {dl.sales_tiktok.toLocaleString('th-TH')} บาท</div>}
                      {dl.sales_outside_tiktok > 0 && <div>โยนนอก TikTok: {dl.sales_outside_tiktok.toLocaleString('th-TH')} บาท</div>}
                      {dl.sales_outside_fb > 0 && <div>โยนนอก Facebook: {dl.sales_outside_fb.toLocaleString('th-TH')} บาท</div>}
                      <div className="pt-1 border-t border-green-200 font-semibold">รวม: {dlAggTotal.toLocaleString('th-TH')} บาท</div>
                    </div>
                  )}

                  {/* Per-product sales */}
                  {entry.sales.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">รายงานการขาย ({entry.sales.length} รายการ)</p>
                      <div className="space-y-1">
                        {entry.sales.map((s, i) => (
                          <div key={i} className="bg-blue-50 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                            <span className="font-semibold text-[#1E3A5F] flex-1">{String(s.product_name || '')}</span>
                            <span className="text-blue-600">{String(s.platform || '')}</span>
                            {Number(s.amount) > 0 && <span className="text-green-700 font-semibold">{Number(s.amount).toLocaleString('th-TH')} ฿</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gifts */}
                  {entry.gifts.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1">ของแถม ({entry.gifts.length} รายการ)</p>
                      <div className="space-y-1">
                        {entry.gifts.map((g, i) => (
                          <div key={i} className="bg-yellow-50 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                            <span className="font-semibold text-yellow-800 flex-1">{String(g.gift_name || '')}</span>
                            <span className="text-yellow-600">{String(g.promo_type || '')}</span>
                            <span className="text-gray-600">{String(g.qty || 1)} {String(g.unit || '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {dl && dl.obstacles && (
                    <div className="text-xs text-gray-500 border-l-2 border-yellow-300 pl-2">
                      <span className="font-semibold text-gray-700">ปัญหา:</span> {dl.obstacles}
                    </div>
                  )}
                  {dl && dl.suggestions && (
                    <div className="text-xs text-gray-500 border-l-2 border-blue-300 pl-2">
                      <span className="font-semibold text-gray-700">แนวทาง:</span> {dl.suggestions}
                    </div>
                  )}
                  {dl && dl.note && (
                    <div className="text-xs text-gray-400 italic">{dl.note}</div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-base font-bold text-[#1E3A5F]">ยืนยันการบันทึก</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-semibold">ชื่อเล่น:</span> {nickname}</p>
              <p><span className="font-semibold">วันที่:</span> {buddhistDateLabel(date)}</p>
            </div>

            {hasAnyHours && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-500">ชั่วโมงไลฟ์</p>
                {ttMin !== null && <p className="text-xs text-gray-700">📱 TikTok: {fmtHours(ttMin)}</p>}
                {fbMin !== null && <p className="text-xs text-gray-700">📘 Facebook: {fmtHours(fbMin)}</p>}
              </div>
            )}

            {aggTotal > 0 && (
              <p className="text-xs text-gray-700"><span className="font-semibold">ยอดขายรวม:</span> {aggTotal.toLocaleString('th-TH')} บาท</p>
            )}

            {validSales.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">รายการสินค้า ({validSales.length})</p>
                {validSales.map((s, i) => (
                  <div key={i} className="text-xs text-gray-700 flex gap-2">
                    <span className="text-gray-400">{i + 1}.</span>
                    <span>{s.product_name}</span>
                    {s.amount && <span className="text-green-600">{parseFloat(s.amount).toLocaleString('th-TH')} ฿</span>}
                    <span className="text-blue-500">{s.platform}</span>
                  </div>
                ))}
              </div>
            )}

            {validGifts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">ของแถม ({validGifts.length})</p>
                {validGifts.map((g, i) => (
                  <div key={i} className="text-xs text-gray-700 flex gap-2">
                    <span className="text-gray-400">{i + 1}.</span>
                    <span>{g.gift_name}</span>
                    <span className="text-yellow-600">{g.promo_type}</span>
                  </div>
                ))}
              </div>
            )}

            {obstacles.trim() && <p className="text-xs text-gray-600 border-l-2 border-yellow-300 pl-2">{obstacles.trim()}</p>}
            {suggestions.trim() && <p className="text-xs text-gray-600 border-l-2 border-blue-300 pl-2">{suggestions.trim()}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowConfirm(false)} disabled={submitting}
                className="flex-1 border border-[#E2E8F0] rounded-xl py-3 text-sm font-semibold text-gray-600">ยกเลิก</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 bg-[#1E3A5F] text-white rounded-xl py-3 text-sm font-bold disabled:opacity-60">
                {submitting ? 'กำลังบันทึก...' : 'ยืนยันบันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
