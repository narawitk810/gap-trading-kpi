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
function todayISO() {
  return new Date().toLocaleDateString('sv-SE')
}
function thisMonthISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const PLATFORMS = ['TikTok', 'Shopee', 'Facebook', 'อื่นๆ']
const PROMO_TYPES = ['โปรซื้อครบ', 'เคลียร์สปอร์ต', 'แถมตาม SKU', 'อื่นๆ']

interface SalesRow { product_name: string; qty_box: string; qty_pack: string; amount: string; platform: string; note: string }
interface GiftRow  { gift_name: string; promo_type: string; qty: string; unit: string; price: string; note: string }

function blankSales(): SalesRow { return { product_name: '', qty_box: '', qty_pack: '', amount: '', platform: 'TikTok', note: '' } }
function blankGift(): GiftRow  { return { gift_name: '', promo_type: 'โปรซื้อครบ', qty: '1', unit: 'ชิ้น', price: '', note: '' } }

interface HistoryEntry {
  date: string
  sales: Record<string, unknown>[]
  gifts: Record<string, unknown>[]
}

export default function LiveReportPage() {
  const [tab, setTab] = useState<'form' | 'history'>('form')
  const [nickname, setNickname] = useState('')
  const [date, setDate] = useState(todayISO())
  const [salesRows, setSalesRows] = useState<SalesRow[]>([blankSales()])
  const [giftRows, setGiftRows] = useState<GiftRow[]>([blankGift()])
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)

  // History state
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

  // Sales row helpers
  function updateSales(i: number, patch: Partial<SalesRow>) { setSalesRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row)) }
  function addSales() { setSalesRows(r => [...r, blankSales()]) }
  function removeSales(i: number) { setSalesRows(r => r.filter((_, idx) => idx !== i)) }

  // Gift row helpers
  function updateGift(i: number, patch: Partial<GiftRow>) { setGiftRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row)) }
  function addGift() { setGiftRows(r => [...r, blankGift()]) }
  function removeGift(i: number) { setGiftRows(r => r.filter((_, idx) => idx !== i)) }

  const validSales = salesRows.filter(s => s.product_name.trim())
  const validGifts = giftRows.filter(g => g.gift_name.trim())

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/live-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          date,
          sales: validSales.map(s => ({
            product_name: s.product_name.trim(),
            qty_box: parseFloat(s.qty_box) || 0,
            qty_pack: parseFloat(s.qty_pack) || 0,
            amount: parseFloat(s.amount) || 0,
            platform: s.platform,
            note: s.note.trim(),
          })),
          gifts: validGifts.map(g => ({
            gift_name: g.gift_name.trim(),
            promo_type: g.promo_type,
            qty: parseInt(g.qty) || 1,
            unit: g.unit.trim(),
            price: parseFloat(g.price) || 0,
            note: g.note.trim(),
          })),
        }),
      })
      if (res.ok) {
        setShowConfirm(false)
        setSubmitDone(true)
        setSalesRows([blankSales()])
        setGiftRows([blankGift()])
      }
    } catch { /* */ } finally { setSubmitting(false) }
  }

  const loadHistory = useCallback(async (nick: string, mo: string) => {
    if (!nick.trim()) return
    setHistLoading(true)
    setHistory(null)
    try {
      const res = await fetch(`/api/live-report?nickname=${encodeURIComponent(nick.trim())}&month=${mo}`)
      const data = await res.json() as { sales: Record<string, unknown>[]; gifts: Record<string, unknown>[] }
      const dateSet: Record<string, true> = {}
      data.sales.forEach(r => { dateSet[String(r.date)] = true })
      data.gifts.forEach(r => { dateSet[String(r.date)] = true })
      const allDates = Object.keys(dateSet).sort()
      const entries: HistoryEntry[] = allDates.map(d => ({
        date: d,
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
          <p className="text-xs text-white/60">บันทึกยอดขายสินค้าและของแถมรายวัน</p>
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
                  <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="ชื่อเล่น"
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">วันที่ <span className="text-red-500">*</span></label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                </div>
              </div>
            </div>

            {/* Sales Report */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#1E3A5F]">รายงานการขาย</h2>
                <span className="text-xs text-gray-400">{validSales.length} รายการ</span>
              </div>

              {salesRows.map((row, i) => (
                <div key={i} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">สินค้า #{i + 1}</span>
                    {salesRows.length > 1 && (
                      <button onClick={() => removeSales(i)} className="text-xs text-red-400 hover:text-red-600">ลบ</button>
                    )}
                  </div>
                  <input value={row.product_name} onChange={e => updateSales(i, { product_name: e.target.value })}
                    placeholder="ชื่อสินค้า *"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ยกกล่อง</label>
                      <input type="number" value={row.qty_box} onChange={e => updateSales(i, { qty_box: e.target.value })}
                        placeholder="0" min="0"
                        className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ยกแพ็ค</label>
                      <input type="number" value={row.qty_pack} onChange={e => updateSales(i, { qty_pack: e.target.value })}
                        placeholder="0" min="0"
                        className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ยอด (บาท)</label>
                      <input type="number" value={row.amount} onChange={e => updateSales(i, { amount: e.target.value })}
                        placeholder="0" min="0"
                        className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">แพลตฟอร์ม</label>
                      <select value={row.platform} onChange={e => updateSales(i, { platform: e.target.value })}
                        className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white">
                        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">หมายเหตุ</label>
                      <input value={row.note} onChange={e => updateSales(i, { note: e.target.value })}
                        placeholder="(ไม่จำเป็น)"
                        className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addSales}
                className="w-full border-2 border-dashed border-[#1E3A5F]/30 rounded-xl py-2.5 text-sm text-[#1E3A5F] font-semibold hover:bg-[#1E3A5F]/5 transition-colors">
                + เพิ่มสินค้า
              </button>
            </div>

            {/* Gifts */}
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
                    placeholder="ชื่อของแถม *"
                    className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ประเภทโปร</label>
                      <select value={row.promo_type} onChange={e => updateGift(i, { promo_type: e.target.value })}
                        className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white">
                        {PROMO_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">จำนวน</label>
                      <div className="flex gap-1">
                        <input type="number" value={row.qty} onChange={e => updateGift(i, { qty: e.target.value })}
                          placeholder="1" min="1"
                          className="flex-1 min-w-0 border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                        <input value={row.unit} onChange={e => updateGift(i, { unit: e.target.value })}
                          placeholder="ชิ้น"
                          className="w-14 border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">ราคา (บาท)</label>
                      <input type="number" value={row.price} onChange={e => updateGift(i, { price: e.target.value })}
                        placeholder="0" min="0"
                        className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">หมายเหตุ</label>
                      <input value={row.note} onChange={e => updateGift(i, { note: e.target.value })}
                        placeholder="(ไม่จำเป็น)"
                        className="w-full border border-[#E2E8F0] rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addGift}
                className="w-full border-2 border-dashed border-[#16A34A]/30 rounded-xl py-2.5 text-sm text-[#16A34A] font-semibold hover:bg-green-50 transition-colors">
                + เพิ่มของแถม
              </button>
            </div>

            {/* Submit */}
            <button
              disabled={!nickname.trim() || !date || (validSales.length === 0 && validGifts.length === 0)}
              onClick={() => setShowConfirm(true)}
              className="w-full bg-[#1E3A5F] text-white rounded-2xl py-4 text-base font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1E3A5F]/90 transition-colors">
              บันทึกรายงาน
            </button>
          </>
        )}

        {tab === 'history' && (
          <>
            {/* History search */}
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex gap-2">
                <input value={histNick} onChange={e => setHistNick(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadHistory(histNick, histMonth)}
                  placeholder="ชื่อเล่น"
                  className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
                <button onClick={() => loadHistory(histNick, histMonth)}
                  className="bg-[#1E3A5F] text-white px-4 rounded-xl text-sm font-semibold">ค้นหา</button>
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
            {history?.map(entry => (
              <div key={entry.date} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                <p className="text-sm font-bold text-[#1E3A5F]">📅 {buddhistDateLabel(entry.date)}</p>

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
              </div>
            ))}
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
            {validSales.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">รายงานการขาย ({validSales.length} รายการ)</p>
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
                <p className="text-xs font-semibold text-gray-500 mb-1">ของแถม ({validGifts.length} รายการ)</p>
                {validGifts.map((g, i) => (
                  <div key={i} className="text-xs text-gray-700 flex gap-2">
                    <span className="text-gray-400">{i + 1}.</span>
                    <span>{g.gift_name}</span>
                    <span className="text-yellow-600">{g.promo_type}</span>
                    <span>{g.qty} {g.unit}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowConfirm(false)} disabled={submitting}
                className="flex-1 border border-[#E2E8F0] rounded-xl py-3 text-sm font-semibold text-gray-600">
                ยกเลิก
              </button>
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
