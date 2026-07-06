'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type PricingData = {
  multiplier: string
  msrp_price: string | null
  risk_amount: number
  commission_tier: string
  box_system_enabled?: boolean
  break_enabled?: boolean
  box_price_system: number
  box_price_external: number
  pack_price_system: number
  pack_price_external: number
}

type StockPrice = {
  id: string
  product_name: string
  quantity: string
  packs_per_box: string
  cost: string
  note: string | null
  image_data: string
  created_at: string
  acknowledged_at: string | null
  pricing_data: string | null
  old_pricing_data: string | null
  status: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const roundUp10 = (n: number) => Math.ceil(n / 10) * 10

const MULTIPLIERS = [
  { key: '2.4', label: 'ทั่วไป', value: 2.4 },
  { key: '2.6', label: 'หายาก', value: 2.6 },
  { key: '2.8', label: 'หายากมาก', value: 2.8 },
  { key: '3', label: 'สั่งไม่ได้อีก', value: 3 },
]

export default function StockPricesPage() {
  const router = useRouter()
  const [items, setItems] = useState<StockPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [imageModal, setImageModal] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [pricingModal, setPricingModal] = useState<StockPrice | null>(null)
  const [pmMultiplier, setPmMultiplier] = useState('')
  const [pmMsrpPrice, setPmMsrpPrice] = useState('')
  const [pmRisk, setPmRisk] = useState(0)
  const [pmCommission, setPmCommission] = useState('')
  const [pmSubmitting, setPmSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<StockPrice | null>(null)
  const [editForm, setEditForm] = useState({ product_name: '', quantity: '', packs_per_box: '', cost: '', note: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const fetchData = useCallback(() => {
    fetch('/api/stock-prices')
      .then((r) => r.json())
      .then((data) => { setItems(data); setLastUpdated(new Date()) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  async function handleEditSave() {
    if (!editingItem) return
    setSavingEdit(true)
    try {
      const res = await fetch('/api/stock-arrival', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingItem.id, ...editForm }),
      })
      if (res.ok) {
        setItems((prev) => prev.map((r) =>
          r.id === editingItem.id
            ? { ...r, product_name: editForm.product_name, quantity: editForm.quantity, packs_per_box: editForm.packs_per_box, cost: editForm.cost, note: editForm.note || null }
            : r
        ))
        setEditingItem(null)
      } else {
        const err = await res.json()
        alert(err.error || 'แก้ไขไม่สำเร็จ — กรุณาลองอีกครั้ง')
      }
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setSavingEdit(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('ยืนยันลบรายการนี้?')) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/stock-arrival', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((r) => r.id !== id))
      } else {
        const data = await res.json()
        alert(data.error || 'ไม่สามารถลบได้')
      }
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setDeletingId(null) }
  }

  function openPricingModal(r: StockPrice) {
    if (!r.pricing_data) return
    setPricingModal(r)
    const p: PricingData = JSON.parse(r.pricing_data)
    setPmMultiplier(p.multiplier)
    setPmMsrpPrice(p.msrp_price || '')
    setPmRisk(p.risk_amount)
    setPmCommission(p.commission_tier)
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
      packPriceExternal = oldPricing!.pack_price_external ? Number(oldPricing!.pack_price_external) : roundUp10(packPriceSystem * 0.90)
    } else {
      const rawBox = pmMultiplier === 'msrp' ? Number(pmMsrpPrice) : cost * Number(pmMultiplier)
      boxPriceSystem = pmMultiplier === 'msrp' ? rawBox : roundUp10(rawBox)
      boxPriceExternal = roundUp10(boxPriceSystem * 0.90 * 0.84)
      packPriceSystem = roundUp10((boxPriceSystem / packs) + pmRisk)
      packPriceExternal = roundUp10(packPriceSystem * 0.90)
    }

    const pricing = {
      multiplier: pmMultiplier,
      msrp_price: pmMsrpPrice || null,
      risk_amount: pmRisk,
      commission_tier: pmCommission,
      box_price_system: boxPriceSystem,
      box_price_external: boxPriceExternal,
      pack_price_system: packPriceSystem,
      pack_price_external: packPriceExternal,
    }

    setPmSubmitting(true)
    try {
      const res = await fetch('/api/stock-prices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pricingModal.id, pricing }),
      })
      if (res.ok) {
        setItems((prev) => prev.map((r) => r.id === pricingModal!.id
          ? { ...r, pricing_data: JSON.stringify(pricing) }
          : r
        ))
        setPricingModal(null)
      } else { alert('เกิดข้อผิดพลาด') }
    } catch { alert('เกิดข้อผิดพลาด') }
    finally { setPmSubmitting(false) }
  }

  const filtered = items.filter((r) => {
    const d = (r.acknowledged_at || r.created_at).slice(0, 10)
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  })

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#16A34A] text-white px-4 py-5 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/70 hover:text-white text-lg w-8">←</button>
          <div>
            <h1 className="text-base font-bold">ราคาขายสินค้า</h1>
            <p className="text-xs opacity-70 mt-0.5">รายการสินค้าเข้า และสถานะการตั้งราคา</p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1">
            <button
              onClick={() => { setLoading(true); fetchData() }}
              className="text-white/70 hover:text-white text-sm px-3 py-1.5 border border-white/30 rounded-lg"
            >
              รีเฟรช
            </button>
            <span className="text-[10px] text-white/50">
              {lastUpdated ? `ล่าสุด ${lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'อัพเดททุก 30 วิ'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        {/* Filter */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-500">วันที่</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          />
          <span className="text-xs text-gray-400">ถึง</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-xs text-gray-400 hover:text-gray-600 underline">
              ล้าง
            </button>
          )}
          <span className="ml-auto text-sm text-gray-500 font-semibold">{filtered.length} รายการ</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">ยังไม่มีรายการสินค้าเข้า</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                    <th className="text-left px-4 py-3">วันที่</th>
                    <th className="text-left px-4 py-3">ชื่อสินค้า / LOT</th>
                    <th className="text-center px-4 py-3">จำนวน</th>
                    <th className="text-center px-4 py-3">ซอง/กล่อง</th>
                    <th className="text-right px-3 py-3 text-[#1E3A5F]">ยกกล่อง<br/>(ในระบบ)</th>
                    <th className="text-right px-3 py-3">ยกกล่อง<br/>(โยนนอก)</th>
                    <th className="text-right px-3 py-3 text-[#16A34A]">แยกซอง<br/>(ในระบบ)</th>
                    <th className="text-right px-3 py-3">แยกซอง<br/>(โยนนอก)</th>
                    <th className="text-center px-3 py-3">Comm.</th>
                    <th className="text-center px-3 py-3">รูป</th>
                    <th className="text-center px-3 py-3">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => {
                    if (r.status === 'pending' || !r.pricing_data) {
                      return (
                        <tr key={r.id} className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                            {formatDate(r.created_at)}
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[180px]">
                            <p className="font-semibold text-[#1E3A5F] truncate">{r.product_name}</p>
                            {r.note && <p className="text-gray-400 truncate">{r.note}</p>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-[#374151]">{r.quantity}</td>
                          <td className="px-4 py-3 text-center text-xs text-[#374151]">{r.packs_per_box}</td>
                          <td className="px-3 py-3 text-center text-xs text-gray-300" colSpan={5}>ยังไม่ได้ตั้งราคา</td>
                          <td className="px-3 py-3 text-center">
                            {r.image_data && (
                              <img
                                src={r.image_data}
                                alt="สินค้า"
                                onClick={() => setImageModal(r.image_data)}
                                className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 mx-auto"
                              />
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="text-xs font-bold bg-[#DC2626]/10 text-[#DC2626] px-2 py-0.5 rounded-full whitespace-nowrap">
                                รอดำเนินการ
                              </span>
                              <button
                                onClick={() => {
                                  setEditingItem(r)
                                  setEditForm({ product_name: r.product_name, quantity: r.quantity, packs_per_box: r.packs_per_box, cost: r.cost, note: r.note || '' })
                                }}
                                className="text-xs text-[#1E3A5F] bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100"
                              >
                                แก้ไข
                              </button>
                              <button
                                onClick={() => handleDelete(r.id)}
                                disabled={deletingId === r.id}
                                className="text-xs text-[#DC2626] bg-red-50 px-2 py-0.5 rounded-full hover:bg-red-100 disabled:opacity-60"
                              >
                                {deletingId === r.id ? '...' : 'ลบ'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    const p: PricingData = JSON.parse(r.pricing_data)
                    const multiplierLabel = p.multiplier === 'msrp' ? 'MSRP' : p.multiplier === 'old' ? 'ราคาเดิม' : `×${p.multiplier}`
                    return (
                      <tr key={r.id} className={`border-t border-[#E2E8F0] ${idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'}`}>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                          {formatDate(r.acknowledged_at || r.created_at)}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[180px]">
                          <p className="font-semibold text-[#1E3A5F] truncate">{r.product_name}</p>
                          {r.note && <p className="text-gray-400 truncate">{r.note}</p>}
                          <p className="text-gray-400 mt-0.5">{multiplierLabel}</p>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-[#374151]">{r.quantity}</td>
                        <td className="px-4 py-3 text-center text-xs text-[#374151]">{r.packs_per_box}</td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-[#1E3A5F] whitespace-nowrap">
                          {p.box_system_enabled === false ? <span className="text-gray-300 font-normal">-</span> : fmt(p.box_price_system)}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-[#374151] whitespace-nowrap">{fmt(p.box_price_external)}</td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-[#16A34A] whitespace-nowrap">
                          {p.break_enabled ? <span className="text-gray-300 font-normal">-</span> : fmt(p.pack_price_system)}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-[#374151] whitespace-nowrap">
                          {fmt(p.pack_price_external)}
                          {p.break_enabled && (
                            <span className="block text-[10px] text-[#D97706] bg-orange-50 rounded px-1 mt-0.5">เปิด break</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-bold bg-[#1E3A5F]/10 text-[#1E3A5F] px-2 py-0.5 rounded-full">
                            {p.commission_tier}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {r.image_data && (
                            <img
                              src={r.image_data}
                              alt="สินค้า"
                              onClick={() => setImageModal(r.image_data)}
                              className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 mx-auto"
                            />
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => openPricingModal(r)}
                            className="border border-[#1E3A5F] text-[#1E3A5F] px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap hover:bg-[#F5F6F8]"
                          >
                            แก้ไขราคา
                          </button>
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

      {/* Edit Pending Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="font-bold text-[#1E3A5F] text-base">แก้ไขข้อมูลสินค้า</h2>
              <p className="text-xs text-gray-400 mt-0.5">รอดำเนินการ — แก้ไขได้ก่อน Admin ดำเนินการ</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">ชื่อสินค้า / LOT</label>
                <input
                  type="text"
                  value={editForm.product_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, product_name: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">จำนวน</label>
                <input
                  type="text"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">แพ็คต่อกล่อง</label>
                <input
                  type="text"
                  value={editForm.packs_per_box}
                  onChange={(e) => setEditForm((f) => ({ ...f, packs_per_box: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">ต้นทุน/กล่อง (บาท)</label>
                <input
                  type="text"
                  value={editForm.cost}
                  onChange={(e) => setEditForm((f) => ({ ...f, cost: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">หมายเหตุ</label>
                <textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                  rows={2}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#E2E8F0] flex gap-3">
              <button
                onClick={() => setEditingItem(null)}
                disabled={savingEdit}
                className="flex-1 border border-[#E2E8F0] text-[#374151] py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleEditSave}
                disabled={savingEdit || !editForm.product_name.trim() || !editForm.quantity.trim() || !editForm.packs_per_box.trim() || !editForm.cost.trim()}
                className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Modal */}
      {pricingModal && (() => {
        const cost = Number(pricingModal.cost) || 0
        const packs = Number(pricingModal.packs_per_box) || 1
        let boxPriceSystem = 0, boxPriceExternal = 0, packPriceSystem = 0, packPriceExternal = 0, calcReady = false
        let oldPricing: Record<string, string> | null = null
        try {
          oldPricing = pricingModal.old_pricing_data ? JSON.parse(pricingModal.old_pricing_data) : null
        } catch { oldPricing = null }
        if (pmMultiplier) {
          if (pmMultiplier === 'msrp' && pmMsrpPrice) { boxPriceSystem = Number(pmMsrpPrice); calcReady = true }
          else if (pmMultiplier === 'old' && oldPricing?.box_price_system) {
            boxPriceSystem = Number(oldPricing.box_price_system)
            boxPriceExternal = oldPricing.box_price_external ? Number(oldPricing.box_price_external) : roundUp10(boxPriceSystem * 0.90 * 0.84)
            packPriceSystem = oldPricing.pack_price_system ? Number(oldPricing.pack_price_system) : roundUp10((boxPriceSystem / packs) + pmRisk)
            packPriceExternal = oldPricing.pack_price_external ? Number(oldPricing.pack_price_external) : roundUp10(packPriceSystem * 0.90)
            calcReady = true
          }
          else if (pmMultiplier !== 'msrp' && pmMultiplier !== 'old') { boxPriceSystem = roundUp10(cost * Number(pmMultiplier)); calcReady = true }
          if (calcReady && pmMultiplier !== 'old') {
            boxPriceExternal = roundUp10(boxPriceSystem * 0.90 * 0.84)
            packPriceSystem = roundUp10((boxPriceSystem / packs) + pmRisk)
            packPriceExternal = roundUp10(packPriceSystem * 0.90)
          }
        }
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setPricingModal(null) }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
              <div className="bg-[#16A34A] text-white px-5 py-4 rounded-t-2xl">
                <p className="text-xs opacity-70 mb-0.5">แก้ไขราคา</p>
                <h2 className="font-bold text-base leading-tight">{pricingModal.product_name}</h2>
                <p className="text-xs opacity-60 mt-0.5">{pricingModal.packs_per_box} ซอง/กล่อง</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Multiplier */}
                <div>
                  <p className="text-xs font-semibold text-[#374151] mb-2">ประเภทสินค้า <span className="text-[#DC2626]">*</span></p>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${pmMultiplier === 'msrp' ? 'border-[#16A34A] bg-green-50' : 'border-[#E2E8F0]'}`}>
                      <input type="radio" name="spm" value="msrp" checked={pmMultiplier === 'msrp'} onChange={() => setPmMultiplier('msrp')} className="accent-[#16A34A]" />
                      <span className="text-sm font-semibold text-[#374151]">MSRP</span>
                      <span className="text-xs text-gray-400">(sleeve / playmat)</span>
                      {pmMultiplier === 'msrp' && (
                        <input type="number" value={pmMsrpPrice} onChange={(e) => setPmMsrpPrice(e.target.value)} placeholder="ราคา MSRP (บาท)"
                          className="ml-auto border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
                          onClick={(e) => e.stopPropagation()} />
                      )}
                    </label>
                    {/* Old price option */}
                    <label className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${oldPricing?.box_price_system ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'} ${pmMultiplier === 'old' ? 'border-[#16A34A] bg-green-50' : 'border-[#E2E8F0]'}`}>
                      <input
                        type="radio"
                        name="spm"
                        value="old"
                        checked={pmMultiplier === 'old'}
                        disabled={!oldPricing?.box_price_system}
                        onChange={() => setPmMultiplier('old')}
                        className="accent-[#16A34A]"
                      />
                      <span className="text-sm font-semibold text-[#374151]">ราคาเดิม</span>
                      <span className="text-xs text-gray-400">(ตามที่ Stock แจ้ง)</span>
                      {oldPricing?.box_price_system ? (
                        <span className="ml-auto text-sm font-bold text-[#16A34A]">{oldPricing.box_price_system} ฿</span>
                      ) : (
                        <span className="ml-auto text-xs text-gray-400">ไม่มีข้อมูล</span>
                      )}
                    </label>
                    {MULTIPLIERS.map((m) => (
                      <label key={m.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${pmMultiplier === m.key ? 'border-[#16A34A] bg-green-50' : 'border-[#E2E8F0]'}`}>
                        <input type="radio" name="spm" value={m.key} checked={pmMultiplier === m.key} onChange={() => setPmMultiplier(m.key)} className="accent-[#16A34A]" />
                        <span className="text-sm font-semibold text-[#374151]">{m.label}</span>
                        <span className="text-xs text-gray-400">× {m.value}</span>
                        {cost > 0 && <span className="ml-auto text-sm font-bold text-[#16A34A]">{(cost * m.value).toLocaleString('th-TH', { maximumFractionDigits: 0 })} ฿</span>}
                      </label>
                    ))}
                  </div>
                </div>
                {/* Risk */}
                <div>
                  <p className="text-xs font-semibold text-[#374151] mb-2">บวกความเสี่ยง (ราคาซอง)</p>
                  <div className="flex items-center gap-3">
                    <input type="number" min={0} max={200} value={pmRisk}
                      onChange={(e) => setPmRisk(Math.min(200, Math.max(0, Number(e.target.value) || 0)))}
                      className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-[#16A34A]" placeholder="0" />
                    <span className="text-xs text-gray-400">บาท (0–200)</span>
                  </div>
                </div>
                {/* Prices */}
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
                {/* Commission */}
                <div>
                  <p className="text-xs font-semibold text-[#374151] mb-2">ค่าคอมมิชชั่น <span className="text-[#DC2626]">*</span></p>
                  <div className="flex gap-2">
                    {[{ key: 'P1', label: 'P(1)', pct: '1%' }, { key: 'P2', label: 'P(2)', pct: '2%' }, { key: 'P3', label: 'P(3)', pct: '3%' }].map((p) => (
                      <button key={p.key} type="button" onClick={() => setPmCommission(p.key)}
                        className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-colors ${pmCommission === p.key ? 'bg-[#16A34A] text-white border-[#16A34A]' : 'border-[#E2E8F0] text-[#374151]'}`}>
                        {p.label}<br/><span className="text-xs font-normal">{p.pct}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 flex gap-3">
                <button onClick={() => setPricingModal(null)} className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm">ยกเลิก</button>
                <button onClick={handlePricingSubmit} disabled={pmSubmitting}
                  className="flex-1 bg-[#16A34A] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60">
                  {pmSubmitting ? 'กำลังบันทึก...' : 'บันทึก ✓'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Image Modal */}
      {imageModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
          <img src={imageModal} alt="สินค้า" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  )
}
