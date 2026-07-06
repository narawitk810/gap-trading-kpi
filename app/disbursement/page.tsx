'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 800
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

type DisbursementStatus = 'pending_approval' | 'approved' | 'ordered' | 'payment_recorded' | 'monthly_closed'
type ModalState = 'detail' | 'action_form' | 'confirm' | 'submitting'

type Disbursement = {
  id: string
  requester: string
  item_list: string
  requested_amount: number
  request_doc: string
  request_date: string
  approved_by: string
  transfer_amount: number | null
  payment_slip: string
  approved_at: string
  ordered_by: string
  actual_amount: number | null
  order_note: string
  ordered_at: string
  payment_note: string
  remaining_note: string
  payment_recorded_at: string
  close_month: string
  closed_by: string
  closed_at: string
  status: DisbursementStatus
  created_at: string
}

const STAGES: { status: DisbursementStatus; label: string; icon: string; color: string; badge: string; actionLabel: string; actionColor: string }[] = [
  {
    status: 'pending_approval',
    label: 'จัดซื้อขอเบิก',
    icon: '📋',
    color: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    actionLabel: 'อนุมัติ',
    actionColor: 'bg-[#16A34A] text-white',
  },
  {
    status: 'approved',
    label: 'บัญชีอนุมัติแล้ว',
    icon: '✅',
    color: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-700',
    actionLabel: 'ยืนยันสั่งซื้อ',
    actionColor: 'bg-blue-600 text-white',
  },
  {
    status: 'ordered',
    label: 'ผู้ดำเนินการสั่งซื้อ',
    icon: '🛒',
    color: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    actionLabel: 'บันทึกจ่ายเงิน',
    actionColor: 'bg-[#1E3A5F] text-white',
  },
  {
    status: 'payment_recorded',
    label: 'บันทึกจ่ายรายวัน',
    icon: '💳',
    color: 'bg-indigo-50 border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-700',
    actionLabel: 'ปิดงบเดือน',
    actionColor: 'bg-purple-600 text-white',
  },
  {
    status: 'monthly_closed',
    label: 'ปิดงบเดือน',
    icon: '🔒',
    color: 'bg-gray-50 border-gray-200',
    badge: 'bg-gray-100 text-gray-600',
    actionLabel: '',
    actionColor: '',
  },
]

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

function formatMoney(n: number | null | undefined) {
  if (n == null) return '-'
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' บาท'
}

export default function DisbursementDashboard() {
  const router = useRouter()
  const [items, setItems] = useState<Disbursement[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Disbursement | null>(null)
  const [modalState, setModalState] = useState<ModalState>('detail')
  const [selectedStage, setSelectedStage] = useState<DisbursementStatus>('pending_approval')

  // Action form state
  const [approvedBy, setApprovedBy] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [slipData, setSlipData] = useState<string | null>(null)
  const [slipName, setSlipName] = useState('')
  const [orderedBy, setOrderedBy] = useState('')
  const [actualAmount, setActualAmount] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [remainingNote, setRemainingNote] = useState('')
  const [closeMonth, setCloseMonth] = useState('')
  const [closedBy, setClosedBy] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const slipRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/disbursements')
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openItem(item: Disbursement) {
    setSelected(item)
    setModalState('detail')
    setApprovedBy(''); setTransferAmount(''); setSlipData(null); setSlipName('')
    setOrderedBy(''); setActualAmount(''); setOrderNote('')
    setPaymentNote(''); setRemainingNote('')
    setCloseMonth(''); setClosedBy('')
    setFormErrors({})
  }

  function closeModal() {
    setSelected(null)
  }

  async function handleSlipFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFormErrors((p) => ({ ...p, slip: '' }))
    if (!file.type.startsWith('image/')) {
      setFormErrors((p) => ({ ...p, slip: 'รองรับเฉพาะรูปภาพ' }))
      return
    }
    try {
      const data = await compressImage(file)
      setSlipData(data); setSlipName(file.name)
    } catch {
      setFormErrors((p) => ({ ...p, slip: 'โหลดรูปไม่ได้' }))
    }
  }

  function validateAction() {
    const e: Record<string, string> = {}
    if (!selected) return false
    if (selected.status === 'pending_approval') {
      if (!approvedBy.trim()) e.approvedBy = 'กรุณากรอกชื่อผู้อนุมัติ'
      if (!transferAmount || isNaN(Number(transferAmount)) || Number(transferAmount) <= 0) e.transferAmount = 'กรุณากรอกยอดโอน'
      if (!slipData) e.slip = 'กรุณาแนบสลิปการโอน'
    } else if (selected.status === 'approved') {
      if (!orderedBy.trim()) e.orderedBy = 'กรุณากรอกชื่อผู้ดำเนินการ'
      if (!actualAmount || isNaN(Number(actualAmount)) || Number(actualAmount) <= 0) e.actualAmount = 'กรุณากรอกยอดจริง'
    } else if (selected.status === 'ordered') {
      if (!paymentNote.trim()) e.paymentNote = 'กรุณากรอกรายละเอียดการจ่าย'
    } else if (selected.status === 'payment_recorded') {
      if (!closeMonth.trim()) e.closeMonth = 'กรุณาระบุเดือน (ปี-เดือน)'
      if (!closedBy.trim()) e.closedBy = 'กรุณากรอกชื่อผู้ปิดงบ'
    }
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleActionSubmit() {
    if (!selected) return
    setModalState('submitting')

    let body: Record<string, unknown> = {}
    if (selected.status === 'pending_approval') {
      body = { action: 'approve', approved_by: approvedBy.trim(), transfer_amount: Number(transferAmount), payment_slip: slipData }
    } else if (selected.status === 'approved') {
      body = { action: 'order', ordered_by: orderedBy.trim(), actual_amount: Number(actualAmount), order_note: orderNote.trim() }
    } else if (selected.status === 'ordered') {
      body = { action: 'record_payment', payment_note: paymentNote.trim(), remaining_note: remainingNote.trim() }
    } else if (selected.status === 'payment_recorded') {
      body = { action: 'close_month', close_month: closeMonth.trim(), closed_by: closedBy.trim() }
    }

    try {
      const res = await fetch(`/api/disbursements/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        closeModal()
        await load()
      } else {
        const data = await res.json()
        alert(data.error || 'เกิดข้อผิดพลาด')
        setModalState('action_form')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ')
      setModalState('action_form')
    }
  }

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage.status] = items.filter((i) => i.status === stage.status)
    return acc
  }, {} as Record<DisbursementStatus, Disbursement[]>)

  const inputClass = 'w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]'

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-white/70 hover:text-white text-lg w-8">←</button>
            <div>
              <h1 className="text-base font-bold">ระบบเบิกจ่าย</h1>
              <p className="text-xs opacity-60 mt-0.5">ติดตามสถานะการเบิกจ่ายทั้งหมด</p>
            </div>
          </div>
          <Link href="/disbursement/new"
            className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors">
            + สร้างใหม่
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto pb-10">

        {/* Horizontal pipeline strip */}
        <div className="overflow-x-auto px-4 py-4 border-b border-[#E2E8F0] bg-white">
          <div className="flex items-center w-max">
            {STAGES.map((stage, idx) => {
              const count = (grouped[stage.status] || []).length
              const isActive = selectedStage === stage.status
              return (
                <div key={stage.status} className="flex items-center">
                  <button
                    onClick={() => setSelectedStage(stage.status)}
                    className={`flex flex-col items-center px-2.5 py-2 rounded-2xl border-2 w-[80px] transition-all active:scale-95 ${
                      isActive
                        ? stage.color + ' shadow-sm'
                        : 'bg-[#F5F6F8] border-[#E2E8F0]'
                    }`}
                  >
                    <span className="text-2xl">{stage.icon}</span>
                    <span className="text-[9px] font-bold text-center text-[#374151] leading-tight mt-1 h-7 flex items-center">
                      {stage.label}
                    </span>
                    <span className={`text-sm font-bold mt-0.5 tabular-nums ${count > 0 ? 'text-orange-700' : 'text-gray-300'}`}>
                      {count}
                    </span>
                  </button>
                  {idx < STAGES.length - 1 && (
                    <span className="text-gray-300 text-2xl px-0.5 font-light select-none leading-none">›</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Item list for selected stage */}
        <div className="px-4 pt-4 space-y-3 pb-10">
          {loading ? (
            <div className="text-center py-16 text-gray-400 text-sm">กำลังโหลด...</div>
          ) : (
            <>
              <p className="text-xs font-semibold text-gray-500 px-1">
                {STAGES.find((s) => s.status === selectedStage)?.icon}{' '}
                {STAGES.find((s) => s.status === selectedStage)?.label}
                {' · '}{(grouped[selectedStage] || []).length} รายการ
              </p>

              {(grouped[selectedStage] || []).length === 0 ? (
                <div className="text-center py-14 text-gray-400 text-sm">ไม่มีรายการในสถานะนี้</div>
              ) : (
                (grouped[selectedStage] || []).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openItem(item)}
                    className="w-full bg-white rounded-xl p-3 text-left shadow-sm hover:shadow-md transition-shadow border border-[#E2E8F0] active:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#374151] truncate">{item.requester}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.item_list}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-orange-700">
                          {item.requested_amount.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-gray-400">{formatDate(item.request_date)}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className="bg-[#1E3A5F] text-white px-5 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base">รายละเอียดการเบิกจ่าย</h2>
                <button onClick={closeModal} className="text-white/70 hover:text-white text-xl leading-none">×</button>
              </div>
              <p className="text-xs text-white/60 mt-0.5 font-mono">{selected.id}</p>
            </div>

            <div className="px-5 py-4 space-y-4">

              {/* Detail view */}
              {(modalState === 'detail' || modalState === 'submitting') && (
                <>
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">ผู้ขอเบิก</p>
                        <p className="font-semibold text-[#374151]">{selected.requester}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">วันที่ขอ</p>
                        <p className="font-semibold text-[#374151]">{formatDate(selected.request_date)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">รายการที่ขอ</p>
                      <p className="font-semibold text-[#374151] whitespace-pre-wrap">{selected.item_list}</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-gray-500">ยอดที่ขอเบิก</p>
                      <p className="font-bold text-orange-700 text-base">{formatMoney(selected.requested_amount)}</p>
                    </div>
                    {selected.request_doc && (
                      <img src={selected.request_doc} alt="เอกสาร" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                    )}
                  </div>

                  {/* Step 2 info */}
                  {(['approved', 'ordered', 'payment_recorded', 'monthly_closed'] as DisbursementStatus[]).includes(selected.status) && (
                    <div className="border-t border-[#E2E8F0] pt-3 space-y-2 text-sm">
                      <p className="text-xs font-semibold text-green-700">✅ บัญชีอนุมัติแล้ว</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">ผู้อนุมัติ</p>
                          <p className="font-semibold text-[#374151]">{selected.approved_by}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">ยอดโอน</p>
                          <p className="font-semibold text-[#374151]">{formatMoney(selected.transfer_amount)}</p>
                        </div>
                      </div>
                      {selected.payment_slip && (
                        <img src={selected.payment_slip} alt="สลิป" className="w-full max-h-32 object-cover rounded-xl border border-[#E2E8F0]" />
                      )}
                    </div>
                  )}

                  {/* Step 3 info */}
                  {(['ordered', 'payment_recorded', 'monthly_closed'] as DisbursementStatus[]).includes(selected.status) && (
                    <div className="border-t border-[#E2E8F0] pt-3 space-y-2 text-sm">
                      <p className="text-xs font-semibold text-blue-700">🛒 ดำเนินการสั่งซื้อแล้ว</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">ผู้ดำเนินการ</p>
                          <p className="font-semibold text-[#374151]">{selected.ordered_by}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">ยอดจริง</p>
                          <p className="font-semibold text-[#374151]">{formatMoney(selected.actual_amount)}</p>
                        </div>
                      </div>
                      {selected.order_note && (
                        <div>
                          <p className="text-xs text-gray-500">หมายเหตุ</p>
                          <p className="text-[#374151]">{selected.order_note}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4 info */}
                  {(['payment_recorded', 'monthly_closed'] as DisbursementStatus[]).includes(selected.status) && (
                    <div className="border-t border-[#E2E8F0] pt-3 space-y-2 text-sm">
                      <p className="text-xs font-semibold text-indigo-700">💳 บันทึกจ่ายแล้ว</p>
                      <div>
                        <p className="text-xs text-gray-500">รายละเอียดการจ่าย</p>
                        <p className="text-[#374151]">{selected.payment_note}</p>
                      </div>
                      {selected.remaining_note && (
                        <div>
                          <p className="text-xs text-gray-500">ยอดคงเหลือ</p>
                          <p className="text-[#374151]">{selected.remaining_note}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 5 info */}
                  {selected.status === 'monthly_closed' && (
                    <div className="border-t border-[#E2E8F0] pt-3 space-y-2 text-sm">
                      <p className="text-xs font-semibold text-gray-600">🔒 ปิดงบแล้ว</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">เดือน</p>
                          <p className="font-semibold text-[#374151]">{selected.close_month}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">ผู้ปิดงบ</p>
                          <p className="font-semibold text-[#374151]">{selected.closed_by}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action button */}
                  {selected.status !== 'monthly_closed' && (
                    <button
                      onClick={() => setModalState('action_form')}
                      className={`w-full py-3 rounded-xl font-semibold text-sm ${STAGES.find((s) => s.status === selected.status)?.actionColor}`}
                    >
                      {STAGES.find((s) => s.status === selected.status)?.actionLabel} →
                    </button>
                  )}
                </>
              )}

              {/* Action form */}
              {modalState === 'action_form' && (
                <>
                  <div className="space-y-3">

                    {/* approve form */}
                    {selected.status === 'pending_approval' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            ชื่อผู้อนุมัติ <span className="text-[#DC2626]">*</span>
                          </label>
                          <input type="text" value={approvedBy}
                            onChange={(e) => { setApprovedBy(e.target.value); setFormErrors((p) => ({ ...p, approvedBy: '' })) }}
                            placeholder="ชื่อผู้มีอำนาจอนุมัติ"
                            className={inputClass} />
                          {formErrors.approvedBy && <p className="text-[#DC2626] text-xs mt-1">{formErrors.approvedBy}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            ยอดที่โอน <span className="text-[#DC2626]">*</span>
                          </label>
                          <div className="relative">
                            <input type="number" min="0" step="0.01" value={transferAmount}
                              onChange={(e) => { setTransferAmount(e.target.value); setFormErrors((p) => ({ ...p, transferAmount: '' })) }}
                              placeholder="0.00" className={inputClass + ' pr-10'} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">บาท</span>
                          </div>
                          {formErrors.transferAmount && <p className="text-[#DC2626] text-xs mt-1">{formErrors.transferAmount}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            สลิปการโอน <span className="text-[#DC2626]">*</span>
                          </label>
                          <input ref={slipRef} type="file" accept="image/*" onChange={handleSlipFile} className="hidden" />
                          {slipData ? (
                            <div className="space-y-1">
                              <img src={slipData} alt="สลิป" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-400 truncate">{slipName}</p>
                                <button type="button"
                                  onClick={() => { setSlipData(null); setSlipName(''); if (slipRef.current) slipRef.current.value = '' }}
                                  className="text-[#DC2626] text-xs font-semibold ml-2">ลบ</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => slipRef.current?.click()}
                              className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#1E3A5F] transition-colors">
                              <span className="text-2xl">🧾</span>
                              <span className="text-xs text-gray-400">แนบสลิปการโอน</span>
                            </button>
                          )}
                          {formErrors.slip && <p className="text-[#DC2626] text-xs mt-1">{formErrors.slip}</p>}
                        </div>
                      </>
                    )}

                    {/* order form */}
                    {selected.status === 'approved' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            ผู้ดำเนินการสั่งซื้อ <span className="text-[#DC2626]">*</span>
                          </label>
                          <input type="text" value={orderedBy}
                            onChange={(e) => { setOrderedBy(e.target.value); setFormErrors((p) => ({ ...p, orderedBy: '' })) }}
                            placeholder="ชื่อผู้สั่งซื้อ"
                            className={inputClass} />
                          {formErrors.orderedBy && <p className="text-[#DC2626] text-xs mt-1">{formErrors.orderedBy}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            ยอดจริงที่สั่งซื้อ <span className="text-[#DC2626]">*</span>
                          </label>
                          <div className="relative">
                            <input type="number" min="0" step="0.01" value={actualAmount}
                              onChange={(e) => { setActualAmount(e.target.value); setFormErrors((p) => ({ ...p, actualAmount: '' })) }}
                              placeholder="0.00" className={inputClass + ' pr-10'} />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">บาท</span>
                          </div>
                          {formErrors.actualAmount && <p className="text-[#DC2626] text-xs mt-1">{formErrors.actualAmount}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            หมายเหตุ
                          </label>
                          <input type="text" value={orderNote}
                            onChange={(e) => setOrderNote(e.target.value)}
                            placeholder="เช่น ชื่อซัพพลายเออร์, เลขคำสั่งซื้อ"
                            className={inputClass} />
                        </div>
                      </>
                    )}

                    {/* record_payment form */}
                    {selected.status === 'ordered' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            รายละเอียดการจ่าย <span className="text-[#DC2626]">*</span>
                          </label>
                          <textarea value={paymentNote}
                            onChange={(e) => { setPaymentNote(e.target.value); setFormErrors((p) => ({ ...p, paymentNote: '' })) }}
                            placeholder="บันทึกยอดจ่ายจริง รายละเอียดการชำระ"
                            rows={3} className={inputClass + ' resize-none'} />
                          {formErrors.paymentNote && <p className="text-[#DC2626] text-xs mt-1">{formErrors.paymentNote}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            ยอดคงเหลือ / หมายเหตุ
                          </label>
                          <input type="text" value={remainingNote}
                            onChange={(e) => setRemainingNote(e.target.value)}
                            placeholder="ยอดคงเหลือในบัญชี หรือหมายเหตุอื่นๆ"
                            className={inputClass} />
                        </div>
                      </>
                    )}

                    {/* close_month form */}
                    {selected.status === 'payment_recorded' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            เดือนที่ปิดงบ <span className="text-[#DC2626]">*</span>
                          </label>
                          <input type="month" value={closeMonth}
                            onChange={(e) => { setCloseMonth(e.target.value); setFormErrors((p) => ({ ...p, closeMonth: '' })) }}
                            className={inputClass} />
                          {formErrors.closeMonth && <p className="text-[#DC2626] text-xs mt-1">{formErrors.closeMonth}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            ผู้ปิดงบ <span className="text-[#DC2626]">*</span>
                          </label>
                          <input type="text" value={closedBy}
                            onChange={(e) => { setClosedBy(e.target.value); setFormErrors((p) => ({ ...p, closedBy: '' })) }}
                            placeholder="ชื่อผู้ปิดงบเดือน"
                            className={inputClass} />
                          {formErrors.closedBy && <p className="text-[#DC2626] text-xs mt-1">{formErrors.closedBy}</p>}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setModalState('detail'); setFormErrors({}) }}
                      className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm">
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => { if (validateAction()) setModalState('confirm') }}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm ${STAGES.find((s) => s.status === selected.status)?.actionColor}`}
                    >
                      ตรวจสอบ →
                    </button>
                  </div>
                </>
              )}

              {/* Confirm */}
              {modalState === 'confirm' && (
                <>
                  <div className="bg-[#F5F6F8] rounded-xl p-3 text-sm space-y-2">
                    <p className="font-semibold text-[#374151]">ยืนยันการดำเนินการ</p>
                    {selected.status === 'pending_approval' && (
                      <>
                        <p className="text-gray-600">ผู้อนุมัติ: <span className="font-semibold">{approvedBy}</span></p>
                        <p className="text-gray-600">ยอดโอน: <span className="font-semibold text-green-700">{Number(transferAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span></p>
                      </>
                    )}
                    {selected.status === 'approved' && (
                      <>
                        <p className="text-gray-600">ผู้ดำเนินการ: <span className="font-semibold">{orderedBy}</span></p>
                        <p className="text-gray-600">ยอดจริง: <span className="font-semibold text-blue-700">{Number(actualAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span></p>
                        {orderNote && <p className="text-gray-600">หมายเหตุ: {orderNote}</p>}
                      </>
                    )}
                    {selected.status === 'ordered' && (
                      <>
                        <p className="text-gray-600">รายละเอียด: <span className="font-semibold">{paymentNote}</span></p>
                        {remainingNote && <p className="text-gray-600">คงเหลือ: {remainingNote}</p>}
                      </>
                    )}
                    {selected.status === 'payment_recorded' && (
                      <>
                        <p className="text-gray-600">เดือน: <span className="font-semibold">{closeMonth}</span></p>
                        <p className="text-gray-600">ผู้ปิดงบ: <span className="font-semibold">{closedBy}</span></p>
                      </>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setModalState('action_form')}
                      className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm">
                      แก้ไข
                    </button>
                    <button onClick={handleActionSubmit}
                      className={`flex-1 py-3 rounded-xl font-semibold text-sm ${STAGES.find((s) => s.status === selected.status)?.actionColor}`}
                    >
                      ยืนยัน
                    </button>
                  </div>
                </>
              )}

              {modalState === 'submitting' && (
                <p className="text-center text-gray-500 text-sm py-4">กำลังบันทึก...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
