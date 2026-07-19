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
type ModalState = 'detail' | 'action_form' | 'confirm' | 'submitting' | 'reimburse_form' | 'reimburse_submitting'
type EqModalState = 'detail' | 'approve_form' | 'approve_confirm' | 'approve_submitting'

type EquipmentRequest = {
  id: string
  nickname: string
  request_type: 'damaged' | 'new' | 'pack' | 'ads' | 'other' | string
  action: string
  description: string
  image_data: string
  status: 'pending' | 'acknowledged'
  created_at: string
  acknowledged_at: string | null
}

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
  payment_method: string
  order_disburse_slip: string
  order_pay_slip: string
  advance_slip: string
  reimbursed_at: string
  reimbursement_slip: string
  order_channel: string
  order_channel_image: string
  qr_slip: string
  tax_invoice_status: string
  tax_invoice_image: string
  tax_invoice_no_reason: string
  payment_note: string
  remaining_note: string
  payment_recorded_at: string
  close_month: string
  closed_by: string
  closed_at: string
  status: DisbursementStatus
  equipment_id: string
  bank_account: string
  bank_name: string
  created_at: string
}

const STAGES: { status: DisbursementStatus; label: string; icon: string; color: string; badge: string; actionLabel: string; actionColor: string }[] = [
  {
    status: 'pending_approval',
    label: 'รายการเบิกจากทุกแผนก',
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

const NEXT_STAGE: Partial<Record<DisbursementStatus, DisbursementStatus>> = {
  pending_approval: 'approved',
  approved: 'ordered',
  ordered: 'payment_recorded',
  payment_recorded: 'monthly_closed',
}

function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

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
  const [equipmentItems, setEquipmentItems] = useState<EquipmentRequest[]>([])
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentRequest | null>(null)
  const [eqModalState, setEqModalState] = useState<EqModalState>('detail')
  const [eqAmount, setEqAmount] = useState('')
  const [eqAmountError, setEqAmountError] = useState('')
  const [eqApprovedBy, setEqApprovedBy] = useState('')
  const [eqApprovedByError, setEqApprovedByError] = useState('')

  // Action form state
  const [approvedBy, setApprovedBy] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [slipData, setSlipData] = useState<string | null>(null)
  const [slipName, setSlipName] = useState('')
  const [orderedBy, setOrderedBy] = useState('')
  const [actualAmount, setActualAmount] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'เบิก' | 'สำรองจ่าย' | 'สำรองจ่าย_บริษัท' | 'qr'>('เบิก')
  const [orderDisburseSlipData, setOrderDisburseSlipData] = useState<string | null>(null)
  const [orderDisburseSlipName, setOrderDisburseSlipName] = useState('')
  const [orderPaySlipData, setOrderPaySlipData] = useState<string | null>(null)
  const [orderPaySlipName, setOrderPaySlipName] = useState('')
  const [advanceSlipData, setAdvanceSlipData] = useState<string | null>(null)
  const [advanceSlipName, setAdvanceSlipName] = useState('')
  const [orderChannel, setOrderChannel] = useState<'offline' | 'online'>('offline')
  const [orderChannelImageData, setOrderChannelImageData] = useState<string | null>(null)
  const [orderChannelImageName, setOrderChannelImageName] = useState('')
  const [qrSlipData, setQrSlipData] = useState<string | null>(null)
  const [qrSlipName, setQrSlipName] = useState('')
  const [taxInvoiceStatus, setTaxInvoiceStatus] = useState<'yes' | 'receipt' | 'cash' | ''>('')
  const [taxInvoiceImageData, setTaxInvoiceImageData] = useState<string | null>(null)
  const [taxInvoiceImageName, setTaxInvoiceImageName] = useState('')
  const [taxInvoiceNoReason, setTaxInvoiceNoReason] = useState('')
  const [reimbursementSlipData, setReimbursementSlipData] = useState<string | null>(null)
  const [reimbursementSlipName, setReimbursementSlipName] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [remainingNote, setRemainingNote] = useState('')
  const [closeMonth, setCloseMonth] = useState('')
  const [closedBy, setClosedBy] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('')
  const [savingBank, setSavingBank] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<Disbursement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteEqTarget, setDeleteEqTarget] = useState<EquipmentRequest | null>(null)
  const [deletingEq, setDeletingEq] = useState(false)

  const slipRef = useRef<HTMLInputElement>(null)
  const orderDisburseSlipRef = useRef<HTMLInputElement>(null)
  const orderPaySlipRef = useRef<HTMLInputElement>(null)
  const advanceSlipRef = useRef<HTMLInputElement>(null)
  const reimbursementSlipRef = useRef<HTMLInputElement>(null)
  const orderChannelImageRef = useRef<HTMLInputElement>(null)
  const qrSlipRef = useRef<HTMLInputElement>(null)
  const taxInvoiceImageRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const t = Date.now()
    try {
      const [disbRes, eqRes] = await Promise.all([
        fetch(`/api/disbursements?_t=${t}`),
        fetch(`/api/equipment/all?_t=${t}`),
      ])
      if (disbRes.ok) setItems(await disbRes.json())
      if (eqRes.ok) setEquipmentItems(await eqRes.json())
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteEq() {
    if (!deleteEqTarget) return
    setDeletingEq(true)
    const targetId = deleteEqTarget.id
    try {
      const res = await fetch('/api/equipment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId }),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'เกิดข้อผิดพลาด'); return }
      setDeleteEqTarget(null)
      setEquipmentItems(prev => prev.filter(e => e.id !== targetId))
    } catch { alert('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setDeletingEq(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const targetId = deleteTarget.id
    try {
      const res = await fetch(`/api/disbursements/${targetId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'เกิดข้อผิดพลาด')
        return
      }
      setDeleteTarget(null)
      setItems(prev => prev.filter(i => i.id !== targetId))
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => { load() }, [])

  function openItem(item: Disbursement) {
    setSelected(item)
    setModalState('detail')
    setApprovedBy(''); setTransferAmount(''); setSlipData(null); setSlipName('')
    setOrderedBy(''); setActualAmount(''); setOrderNote('')
    setPaymentMethod('เบิก')
    setOrderDisburseSlipData(null); setOrderDisburseSlipName('')
    setOrderPaySlipData(null); setOrderPaySlipName('')
    setAdvanceSlipData(null); setAdvanceSlipName('')
    setReimbursementSlipData(null); setReimbursementSlipName('')
    setOrderChannel('offline'); setOrderChannelImageData(null); setOrderChannelImageName('')
    setQrSlipData(null); setQrSlipName('')
    setTaxInvoiceStatus(''); setTaxInvoiceImageData(null); setTaxInvoiceImageName(''); setTaxInvoiceNoReason('')
    setPaymentNote(''); setRemainingNote('')
    setCloseMonth(''); setClosedBy('')
    setBankAccount(item.bank_account || ''); setBankName(item.bank_name || '')
    setFormErrors({})
  }

  function closeModal() {
    setSelected(null)
  }

  function openEquipment(eq: EquipmentRequest) {
    setSelectedEquipment(eq)
    setEqModalState('detail')
    setEqAmount('')
    setEqAmountError('')
    setEqApprovedBy('')
    setEqApprovedByError('')
  }

  async function handleEqApprove() {
    if (!selectedEquipment) return
    setEqModalState('approve_submitting')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const disbRes = await fetch('/api/disbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requester: selectedEquipment.nickname,
          item_list: selectedEquipment.description,
          amount: Number(eqAmount),
          request_date: today,
          request_doc: selectedEquipment.image_data || '',
          equipment_id: selectedEquipment.id,
          approved_by: eqApprovedBy.trim(),
        }),
      })
      if (!disbRes.ok) throw new Error()
      await fetch('/api/equipment/acknowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedEquipment.id }),
      })
      setSelectedEquipment(null)
      await load()
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setEqModalState('approve_form')
    }
  }

  function makeImageHandler(
    setData: (d: string | null) => void,
    setName: (n: string) => void,
    errorKey: string
  ) {
    return async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setFormErrors((p) => ({ ...p, [errorKey]: '' }))
      if (!file.type.startsWith('image/')) {
        setFormErrors((p) => ({ ...p, [errorKey]: 'รองรับเฉพาะรูปภาพ' }))
        return
      }
      try {
        const data = await compressImage(file)
        setData(data); setName(file.name)
      } catch {
        setFormErrors((p) => ({ ...p, [errorKey]: 'โหลดรูปไม่ได้' }))
      }
    }
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

  const handleOrderDisburseSlipFile = makeImageHandler(setOrderDisburseSlipData, setOrderDisburseSlipName, 'orderDisburseSlip')
  const handleOrderPaySlipFile = makeImageHandler(setOrderPaySlipData, setOrderPaySlipName, 'orderPaySlip')
  const handleAdvanceSlipFile = makeImageHandler(setAdvanceSlipData, setAdvanceSlipName, 'advanceSlip')
  const handleReimbursementSlipFile = makeImageHandler(setReimbursementSlipData, setReimbursementSlipName, 'reimbursementSlip')
  const handleOrderChannelImageFile = makeImageHandler(setOrderChannelImageData, setOrderChannelImageName, 'orderChannelImage')
  const handleQrSlipFile = makeImageHandler(setQrSlipData, setQrSlipName, 'qrSlip')
  const handleTaxInvoiceImageFile = makeImageHandler(setTaxInvoiceImageData, setTaxInvoiceImageName, 'taxInvoiceImage')

  function validateAction() {
    const e: Record<string, string> = {}
    if (!selected) return false
    if (selected.status === 'pending_approval') {
      if (!approvedBy.trim()) e.approvedBy = 'กรุณากรอกชื่อผู้อนุมัติ'
    } else if (selected.status === 'approved') {
      if (!orderedBy.trim()) e.orderedBy = 'กรุณากรอกชื่อผู้ดำเนินการ'
      if (actualAmount === '' || isNaN(Number(actualAmount)) || Number(actualAmount) < 0) e.actualAmount = 'กรุณากรอกยอดจริง (ใส่ 0 ได้หากไม่มีค่าใช้จ่าย)'
      if (paymentMethod === 'เบิก') {
        if (!orderDisburseSlipData) e.orderDisburseSlip = 'กรุณาแนบสลิปที่ขอเบิก'
        if (!orderPaySlipData) e.orderPaySlip = 'กรุณาแนบสลิปชำระเงิน'
      } else if (paymentMethod === 'สำรองจ่าย' || paymentMethod === 'สำรองจ่าย_บริษัท') {
        if (!advanceSlipData) e.advanceSlip = 'กรุณาแนบสลิป'
      } else if (paymentMethod === 'qr') {
        if (!qrSlipData) e.qrSlip = 'กรุณาแนบ QR Code'
      }
      if (orderChannel === 'offline' && !orderChannelImageData) e.orderChannelImage = 'กรุณาแนบรูปประกอบ'
    } else if (selected.status === 'ordered') {
      if (!taxInvoiceStatus) e.taxInvoiceStatus = 'กรุณาเลือกสถานะเอกสาร'
      if (['yes', 'receipt'].includes(taxInvoiceStatus) && !taxInvoiceImageData) e.taxInvoiceImage = 'กรุณาแนบรูปเอกสาร'
    } else if (selected.status === 'payment_recorded') {
      if (!closeMonth.trim()) e.closeMonth = 'กรุณาระบุเดือน (ปี-เดือน)'
      if (!closedBy.trim()) e.closedBy = 'กรุณากรอกชื่อผู้ปิดงบ'
    }
    setFormErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSkipApprove(id: string) {
    try {
      const res = await fetch(`/api/disbursements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip_to_approved' }),
      })
      if (res.ok) {
        setSelectedStage('approved')
        closeModal()
        await load()
      } else {
        alert('เกิดข้อผิดพลาด')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }

  async function handleClearSlip(id: string) {
    if (!confirm('ยืนยันลบสลิปการโอน?')) return
    try {
      await fetch(`/api/disbursements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_slip' }),
      })
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, payment_slip: '' } : i))
      if (selected?.id === id) setSelected((prev) => prev ? { ...prev, payment_slip: '' } : prev)
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }

  async function handleRollbackToPending() {
    if (!selected) return
    if (!confirm('ยืนยันย้อนกลับสู่ขั้นตอนรอดำเนินการ?')) return
    try {
      const res = await fetch(`/api/disbursements/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback_to_pending' }),
      })
      if (res.ok) {
        setSelectedStage('pending_approval')
        closeModal()
        await load()
      } else {
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ')
    }
  }

  async function handleRollbackToApproved() {
    if (!selected) return
    if (!confirm('ยืนยันย้อนกลับสู่ขั้นตอน 2? ข้อมูลการสั่งซื้อจะถูกล้างทั้งหมด')) return
    try {
      const res = await fetch(`/api/disbursements/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback_to_approved' }),
      })
      if (res.ok) {
        setSelectedStage('approved')
        closeModal()
        await load()
      } else {
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ')
    }
  }

  async function handleRollbackToOrdered() {
    if (!selected) return
    if (!confirm('ยืนยันย้อนกลับสู่ขั้นตอน 3? ข้อมูลการบันทึกจ่ายจะถูกล้างทั้งหมด')) return
    try {
      const res = await fetch(`/api/disbursements/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback_to_ordered' }),
      })
      if (res.ok) {
        setSelectedStage('ordered')
        closeModal()
        await load()
      } else {
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ')
    }
  }

  async function handleActionSubmit() {
    if (!selected) return
    setModalState('submitting')

    let body: Record<string, unknown> = {}
    if (selected.status === 'pending_approval') {
      body = { action: 'approve', approved_by: approvedBy.trim() }
    } else if (selected.status === 'approved') {
      body = {
        action: 'order',
        ordered_by: orderedBy.trim(),
        actual_amount: Number(actualAmount),
        order_note: orderNote.trim(),
        payment_method: paymentMethod,
        order_disburse_slip: paymentMethod === 'เบิก' ? orderDisburseSlipData : '',
        order_pay_slip: paymentMethod === 'เบิก' ? orderPaySlipData : '',
        advance_slip: (paymentMethod === 'สำรองจ่าย' || paymentMethod === 'สำรองจ่าย_บริษัท') ? advanceSlipData : '',
        order_channel: orderChannel,
        order_channel_image: orderChannelImageData,
        qr_slip: paymentMethod === 'qr' ? qrSlipData : '',
        bank_account: ['เบิก', 'สำรองจ่าย', 'สำรองจ่าย_บริษัท'].includes(paymentMethod) ? bankAccount.trim() : '',
        bank_name: ['เบิก', 'สำรองจ่าย', 'สำรองจ่าย_บริษัท'].includes(paymentMethod) ? bankName.trim() : '',
      }
    } else if (selected.status === 'ordered') {
      body = {
        action: 'record_payment',
        payment_note: paymentNote.trim(),
        remaining_note: remainingNote.trim(),
        tax_invoice_status: taxInvoiceStatus,
        tax_invoice_image: ['yes', 'receipt', 'cash'].includes(taxInvoiceStatus) ? taxInvoiceImageData : '',
        tax_invoice_no_reason: '',
      }
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
        const next = NEXT_STAGE[selected.status]
        if (next) setSelectedStage(next)
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

  async function handleSaveBankInfo() {
    if (!selected) return
    setSavingBank(true)
    try {
      const res = await fetch(`/api/disbursements/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_bank_info', bank_account: bankAccount, bank_name: bankName }),
      })
      if (!res.ok) { const d = await res.json(); alert(d.error || 'เกิดข้อผิดพลาด'); return }
      setItems(prev => prev.map(i => i.id === selected.id ? { ...i, bank_account: bankAccount.trim(), bank_name: bankName.trim() } : i))
      setSelected(prev => prev ? { ...prev, bank_account: bankAccount.trim(), bank_name: bankName.trim() } : prev)
      alert('บันทึกข้อมูลบัญชีแล้ว')
    } catch { alert('เกิดข้อผิดพลาด กรุณาลองใหม่') }
    finally { setSavingBank(false) }
  }

  async function handleReimburseSubmit() {
    if (!selected) return
    if (!reimbursementSlipData) {
      setFormErrors({ reimbursementSlip: 'กรุณาแนบสลิปการจ่ายคืน' })
      return
    }
    setModalState('reimburse_submitting')
    try {
      const res = await fetch(`/api/disbursements/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reimburse', reimbursement_slip: reimbursementSlipData }),
      })
      if (res.ok) {
        closeModal()
        await load()
      } else {
        const data = await res.json()
        alert(data.error || 'เกิดข้อผิดพลาด')
        setModalState('reimburse_form')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ')
      setModalState('reimburse_form')
    }
  }

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage.status] = items.filter((i) => i.status === stage.status)
    return acc
  }, {} as Record<DisbursementStatus, Disbursement[]>)

  const linkedEquipmentIds = new Set(items.map((d) => d.equipment_id).filter(Boolean))
  const pendingEquipment = equipmentItems.filter((eq) => !linkedEquipmentIds.has(eq.id))

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
          <div className="flex items-center gap-2">
            <button onClick={() => load()} className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors">
              ↻
            </button>
            <Link href="/disbursement/new"
              className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors">
              + สร้างใหม่
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto pb-10">

        {/* Horizontal pipeline strip */}
        <div className="overflow-x-auto px-4 py-4 border-b border-[#E2E8F0] bg-white">
          <div className="flex items-center w-max">
            {STAGES.map((stage, idx) => {
              const count = stage.status === 'pending_approval' ? pendingEquipment.length + (grouped['pending_approval'] || []).length : (grouped[stage.status] || []).length
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
                    <span className="text-[8px] font-semibold text-gray-400 leading-none mb-0.5">
                      สถานะที่ {idx + 1}
                    </span>
                    <span className="text-2xl">{stage.icon}</span>
                    <span className="text-[9px] font-bold text-center text-[#374151] leading-tight mt-1 h-7 flex items-center">
                      {stage.label}
                    </span>
                    <span className={`text-sm font-bold mt-0.5 tabular-nums ${count > 0 ? 'text-orange-700' : 'text-gray-300'}`}>
                      {count}
                    </span>
                  </button>
                  {idx < STAGES.length - 1 && (
                    <div className="flex flex-col items-center px-0.5 select-none">
                      <span className="text-gray-300 text-2xl font-light leading-none">›</span>
                      <span className="text-[8px] text-gray-400 font-semibold text-center leading-tight w-12">
                        {['บัญชี(บอส)', 'จัดซื้อ', 'จัดซื้อ', 'บัญชี'][idx]}
                      </span>
                    </div>
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
                {' · '}{selectedStage === 'pending_approval' ? pendingEquipment.length + (grouped['pending_approval'] || []).length : (grouped[selectedStage] || []).length} รายการ
              </p>

              {selectedStage === 'pending_approval' ? (
                pendingEquipment.length === 0 && (grouped['pending_approval'] || []).length === 0 ? (
                  <div className="text-center py-14 text-gray-400 text-sm">ไม่มีรายการอุปกรณ์</div>
                ) : (
                  <>
                    {(grouped['pending_approval'] || []).map((item) => (
                      <div key={item.id} className="flex bg-white rounded-xl shadow-sm border border-[#E2E8F0]">
                        <button
                          onClick={() => openItem(item)}
                          className="flex-1 p-3 text-left active:bg-gray-50 min-w-0 rounded-l-xl"
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
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="px-3 border-l border-[#E2E8F0] text-red-400 hover:text-red-600 hover:bg-red-50 rounded-r-xl transition-colors shrink-0"
                          title="ลบรายการ"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    {pendingEquipment.map((eq) => (
                      <div key={eq.id} className="flex bg-white rounded-xl shadow-sm border border-[#E2E8F0]">
                        <button
                          onClick={() => openEquipment(eq)}
                          className="flex-1 p-3 text-left active:bg-gray-50 min-w-0 rounded-l-xl"
                        >
                          <div className="flex items-start gap-3">
                            {eq.image_data && (
                              <img
                                src={eq.image_data}
                                alt="รูปอุปกรณ์"
                                className="w-12 h-12 object-cover rounded-lg shrink-0 border border-[#E2E8F0]"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-semibold text-[#374151]">{eq.nickname}</p>
                                {eq.request_type && eq.request_type !== 'damaged' && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                    {{ new: 'เบิกใหม่', pack: 'เบิกของแพค', ads: 'เบิกค่า Ads', other: 'เบิกอื่นๆ' }[eq.request_type] || eq.request_type}
                                  </span>
                                )}
                                {eq.request_type === 'damaged' && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">อุปกรณ์เสีย</span>
                                )}
                                {eq.action ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                    {eq.action}
                                  </span>
                                ) : null}
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto shrink-0 bg-red-100 text-red-600">
                                  รอดำเนินการ
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{eq.description}</p>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => setDeleteEqTarget(eq)}
                          className="px-3 border-l border-[#E2E8F0] text-red-400 hover:text-red-600 hover:bg-red-50 rounded-r-xl transition-colors shrink-0"
                          title="ลบรายการ"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </>
                )
              ) : (grouped[selectedStage] || []).length === 0 ? (
                <div className="text-center py-14 text-gray-400 text-sm">ไม่มีรายการในสถานะนี้</div>
              ) : (
                <>
                  {(grouped[selectedStage] || []).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openItem(item)}
                      className="w-full bg-white rounded-xl p-3 text-left shadow-sm hover:shadow-md transition-shadow border border-[#E2E8F0] active:bg-gray-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#374151] truncate">{item.requester}</p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{item.item_list}</p>
                          {selectedStage === 'ordered' && (
                            <div className="mt-1.5">
                              {(['สำรองจ่าย', 'qr'] as string[]).includes(item.payment_method) && !item.reimbursed_at ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                  ⏳ รอบริษัทจ่ายคืน
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F]">
                                  ⏳ รอบันทึกจ่ายเงิน
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-orange-700">
                            {item.requested_amount.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
                          </p>
                          <p className="text-xs text-gray-400">{formatDate(item.request_date)}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Equipment modal */}
      {selectedEquipment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#1E3A5F] text-white px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">
                  {eqModalState === 'detail' ? 'รายละเอียดอุปกรณ์'
                    : eqModalState === 'approve_form' ? 'กรอกยอดที่ขออนุมัติ'
                    : eqModalState === 'approve_confirm' ? 'ยืนยันการอนุมัติ'
                    : 'กำลังบันทึก...'}
                </h2>
                <p className="text-xs text-white/60 mt-0.5 font-mono">{selectedEquipment.id}</p>
              </div>
              {eqModalState !== 'approve_submitting' && (
                <button
                  onClick={() => eqModalState === 'detail' ? setSelectedEquipment(null) : setEqModalState('detail')}
                  className="text-white/70 hover:text-white text-xl leading-none"
                >×</button>
              )}
            </div>

            <div className="px-5 py-4 space-y-4">

              {/* Detail view */}
              {eqModalState === 'detail' && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-bold text-[#374151]">{selectedEquipment.nickname}</p>
                    {selectedEquipment.request_type === 'damaged' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">อุปกรณ์เสีย</span>
                    )}
                    {selectedEquipment.request_type && selectedEquipment.request_type !== 'damaged' && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {{ new: 'เบิกใหม่', pack: 'เบิกของแพค', ads: 'เบิกค่า Ads', other: 'เบิกอื่นๆ' }[selectedEquipment.request_type] || selectedEquipment.request_type}
                      </span>
                    )}
                    {selectedEquipment.action ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {selectedEquipment.action}
                      </span>
                    ) : null}
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      รอดำเนินการ
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">คำอธิบาย</p>
                    <p className="text-sm text-[#374151] whitespace-pre-wrap">{selectedEquipment.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">วันที่แจ้ง</p>
                    <p className="text-sm font-semibold text-[#374151]">{formatDate(selectedEquipment.created_at)}</p>
                  </div>
                  {selectedEquipment.image_data && (
                    <img src={selectedEquipment.image_data} alt="รูปอุปกรณ์"
                      className="w-full max-h-64 object-contain rounded-xl border border-[#E2E8F0]" />
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setSelectedEquipment(null)}
                      className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm">
                      ปิด
                    </button>
                    <button onClick={() => setEqModalState('approve_form')}
                      className="flex-1 bg-[#16A34A] text-white py-3 rounded-xl font-semibold text-sm">
                      อนุมัติ →
                    </button>
                  </div>
                </>
              )}

              {/* Approve form */}
              {eqModalState === 'approve_form' && (
                <>
                  <div className="bg-[#F5F6F8] rounded-xl p-3 text-sm space-y-1">
                    <p className="font-semibold text-[#374151]">{selectedEquipment.nickname}</p>
                    <p className="text-gray-500 text-xs">{selectedEquipment.description}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-semibold text-[#374151]">
                        ชื่อผู้อนุมัติ <span className="text-[#DC2626]">*</span>
                      </label>
                      <button type="button"
                        onClick={() => { setEqApprovedBy('Boss'); setEqApprovedByError('') }}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#1E3A5F] text-white">
                        Boss
                      </button>
                    </div>
                    <input type="text" value={eqApprovedBy}
                      onChange={(e) => { setEqApprovedBy(e.target.value); setEqApprovedByError('') }}
                      placeholder="ชื่อผู้มีอำนาจอนุมัติ"
                      className={inputClass} />
                    {eqApprovedByError && <p className="text-[#DC2626] text-xs mt-1">{eqApprovedByError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                      ยอดที่ขอเบิก <span className="text-[#DC2626]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number" min="0" step="0.01" value={eqAmount}
                        onChange={(e) => { setEqAmount(e.target.value); setEqAmountError('') }}
                        placeholder="0.00"
                        className={inputClass + ' pr-10'}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">บาท</span>
                    </div>
                    {eqAmountError && <p className="text-[#DC2626] text-xs mt-1">{eqAmountError}</p>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEqModalState('detail')}
                      className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm">
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => {
                        if (!eqApprovedBy.trim()) { setEqApprovedByError('กรุณากรอกชื่อผู้อนุมัติ'); return }
                        if (!eqAmount || isNaN(Number(eqAmount)) || Number(eqAmount) <= 0) {
                          setEqAmountError('กรุณากรอกยอดที่ถูกต้อง')
                          return
                        }
                        setEqModalState('approve_confirm')
                      }}
                      className="flex-1 bg-[#16A34A] text-white py-3 rounded-xl font-semibold text-sm"
                    >
                      ตรวจสอบ →
                    </button>
                  </div>
                </>
              )}

              {/* Approve confirm */}
              {eqModalState === 'approve_confirm' && (
                <>
                  <div className="bg-[#F5F6F8] rounded-xl p-3 text-sm space-y-2">
                    <p className="font-semibold text-[#374151]">ยืนยันการอนุมัติ</p>
                    <p className="text-gray-600">ผู้ขอ: <span className="font-semibold">{selectedEquipment.nickname}</span></p>
                    <p className="text-gray-600">รายการ: <span className="font-semibold">{selectedEquipment.description}</span></p>
                    <p className="text-gray-600">ผู้อนุมัติ: <span className="font-semibold">{eqApprovedBy}</span></p>
                    <p className="text-gray-600">ยอด: <span className="font-semibold text-green-700">
                      {Number(eqAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </span></p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEqModalState('approve_form')}
                      className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm">
                      แก้ไข
                    </button>
                    <button onClick={handleEqApprove}
                      className="flex-1 bg-[#16A34A] text-white py-3 rounded-xl font-semibold text-sm">
                      ยืนยันอนุมัติ
                    </button>
                  </div>
                </>
              )}

              {/* Submitting */}
              {eqModalState === 'approve_submitting' && (
                <p className="text-center text-gray-500 text-sm py-4">กำลังบันทึก...</p>
              )}

            </div>
          </div>
        </div>
      )}

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
                      <div>
                        <img src={selected.request_doc} alt="เอกสาร" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                        <button onClick={() => downloadImage(selected.request_doc, 'request-doc.jpg')} className="text-xs text-[#1E3A5F] font-semibold mt-1">⬇ บันทึกรูป</button>
                      </div>
                    )}
                  </div>

                  {/* Step 2 info */}
                  {(['approved', 'ordered', 'payment_recorded', 'monthly_closed'] as DisbursementStatus[]).includes(selected.status) && (
                    <div className="border-t border-[#E2E8F0] pt-3 space-y-2 text-sm">
                      <p className="text-xs font-semibold text-green-700">✅ บัญชีอนุมัติแล้ว</p>
                      <div>
                        <p className="text-xs text-gray-500">ผู้อนุมัติ</p>
                        <p className="font-semibold text-[#374151]">{selected.approved_by}</p>
                      </div>
                      {selected.status === 'approved' && selected.bank_account && (
                        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-xs font-bold text-blue-700 mb-1">🏦 ข้อมูลบัญชีรับโอน (บันทึกชั่วคราว)</p>
                          <p className="text-[#374151]">เลขบัญชี: <span className="font-semibold">{selected.bank_account}</span></p>
                          {selected.bank_name && <p className="text-[#374151]">ธนาคาร: <span className="font-semibold">{selected.bank_name}</span></p>}
                        </div>
                      )}
                      {selected.payment_slip && (
                        <div className="space-y-2">
                          <img src={selected.payment_slip} alt="สลิป" className="w-full max-h-32 object-cover rounded-xl border border-[#E2E8F0]" />
                          <div className="flex gap-2">
                            <button onClick={() => downloadImage(selected.payment_slip, 'payment-slip.jpg')} className="flex-1 border border-[#E2E8F0] text-[#1E3A5F] py-2 rounded-xl text-xs font-semibold">⬇ บันทึกรูป</button>
                            <button onClick={() => handleClearSlip(selected.id)} className="flex-1 border border-red-200 text-red-600 py-2 rounded-xl text-xs font-semibold">ลบสลิปการโอน</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3 info */}
                  {(['ordered', 'payment_recorded', 'monthly_closed'] as DisbursementStatus[]).includes(selected.status) && (
                    <div className="border-t border-[#E2E8F0] pt-3 space-y-2 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-semibold text-blue-700">🛒 ดำเนินการสั่งซื้อแล้ว</p>
                        {selected.payment_method && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            selected.payment_method === 'เบิก' ? 'bg-green-100 text-green-700' :
                            selected.payment_method === 'สำรองจ่าย' ? 'bg-orange-100 text-orange-700' :
                            selected.payment_method === 'สำรองจ่าย_บริษัท' ? 'bg-blue-100 text-blue-700' :
                            selected.payment_method === 'qr' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {selected.payment_method === 'เบิก' ? 'ขอเบิก' :
                             selected.payment_method === 'สำรองจ่าย' ? 'สำรองจ่าย (บช พนักงาน)' :
                             selected.payment_method === 'สำรองจ่าย_บริษัท' ? 'สำรองจ่าย (บช บริษัท)' :
                             selected.payment_method === 'qr' ? 'QR Code' : 'มีอยู่แล้ว'}
                          </span>
                        )}
                        {selected.order_channel && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${selected.order_channel === 'offline' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'}`}>
                            {selected.order_channel === 'offline' ? '🏪 Offline' : '🌐 Online'}
                          </span>
                        )}
                      </div>
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
                      {selected.order_channel_image && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">{selected.order_channel === 'offline' ? 'รูปประกอบ' : 'แคปหน้าจอคำสั่งซื้อ'}</p>
                          <img src={selected.order_channel_image} alt="รูปประกอบ" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                          <button onClick={() => downloadImage(selected.order_channel_image, 'order-channel.jpg')} className="text-xs text-[#1E3A5F] font-semibold mt-1">⬇ บันทึกรูป</button>
                        </div>
                      )}
                      {selected.payment_method === 'เบิก' && (
                        <div className="space-y-2">
                          {selected.order_disburse_slip && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">สลิปที่ขอเบิก</p>
                              <img src={selected.order_disburse_slip} alt="สลิปขอเบิก" className="w-full max-h-32 object-cover rounded-xl border border-[#E2E8F0]" />
                              <button onClick={() => downloadImage(selected.order_disburse_slip, 'disburse-slip.jpg')} className="text-xs text-[#1E3A5F] font-semibold mt-1">⬇ บันทึกรูป</button>
                            </div>
                          )}
                          {selected.order_pay_slip && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">สลิปชำระเงิน</p>
                              <img src={selected.order_pay_slip} alt="สลิปชำระ" className="w-full max-h-32 object-cover rounded-xl border border-[#E2E8F0]" />
                              <button onClick={() => downloadImage(selected.order_pay_slip, 'pay-slip.jpg')} className="text-xs text-[#1E3A5F] font-semibold mt-1">⬇ บันทึกรูป</button>
                            </div>
                          )}
                        </div>
                      )}
                      {(selected.payment_method === 'สำรองจ่าย' || selected.payment_method === 'สำรองจ่าย_บริษัท' || selected.payment_method === 'qr') && (
                        <div className="space-y-2">
                          {selected.advance_slip && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">
                                {selected.payment_method === 'สำรองจ่าย_บริษัท' ? 'สลิปการโอน (บช บริษัท)' : 'สลิปสำรองจ่าย (บช พนักงาน)'}
                              </p>
                              <img src={selected.advance_slip} alt="สลิปสำรองจ่าย" className="w-full max-h-32 object-cover rounded-xl border border-[#E2E8F0]" />
                              <button onClick={() => downloadImage(selected.advance_slip, 'advance-slip.jpg')} className="text-xs text-[#1E3A5F] font-semibold mt-1">⬇ บันทึกรูป</button>
                            </div>
                          )}
                          {selected.qr_slip && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">QR Code</p>
                              <img src={selected.qr_slip} alt="QR Code" className="w-full max-h-32 object-cover rounded-xl border border-[#E2E8F0]" />
                              <button onClick={() => downloadImage(selected.qr_slip, 'qr-code.jpg')} className="text-xs text-[#1E3A5F] font-semibold mt-1">⬇ บันทึกรูป</button>
                            </div>
                          )}
                          {selected.payment_method !== 'สำรองจ่าย_บริษัท' && (selected.reimbursed_at ? (
                            <div className="bg-green-50 rounded-xl px-3 py-2">
                              <p className="text-xs font-semibold text-green-700">
                                ✅ {selected.payment_method === 'qr' ? 'บริษัทชำระแล้ว' : 'บริษัทจ่ายคืนแล้ว'}
                              </p>
                              {selected.payment_method !== 'qr' && selected.bank_account && (
                                <p className="text-xs text-gray-500 mt-1">
                                  โอนไปที่: <span className="font-semibold text-[#374151]">{selected.bank_account}</span>
                                  {selected.bank_name ? ` (${selected.bank_name})` : ''}
                                </p>
                              )}
                              {selected.reimbursement_slip && (
                                <>
                                  <img src={selected.reimbursement_slip} alt="สลิปยืนยัน" className="w-full max-h-32 object-cover rounded-xl border border-green-200 mt-2" />
                                  <button onClick={() => downloadImage(selected.reimbursement_slip, 'reimbursement-slip.jpg')} className="text-xs text-[#1E3A5F] font-semibold mt-1">⬇ บันทึกรูป</button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="bg-orange-50 rounded-xl px-3 py-2">
                              <p className="text-xs font-semibold text-orange-700">
                                ⏳ {selected.payment_method === 'qr' ? 'รอบริษัทชำระ' : 'รอบริษัทจ่ายคืน'}
                              </p>
                            </div>
                          ))}
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
                      {selected.tax_invoice_status && (
                        <div className={`rounded-xl px-3 py-2 ${selected.tax_invoice_status === 'yes' || selected.tax_invoice_status === 'receipt' || selected.tax_invoice_status === 'cash' ? 'bg-green-50' : 'bg-gray-50'}`}>
                          <p className="text-xs font-semibold text-gray-700">
                            {selected.tax_invoice_status === 'yes' ? '🧾 ใบกำกับภาษี'
                              : selected.tax_invoice_status === 'receipt' ? '🧾 ใบเสร็จรับเงิน'
                              : selected.tax_invoice_status === 'cash' ? '💵 บิลเงินสด'
                              : '❌ ไม่มีใบกำกับภาษี'}
                          </p>
                          {selected.tax_invoice_no_reason && (
                            <p className="text-xs text-gray-500 mt-0.5">เหตุผล: {selected.tax_invoice_no_reason}</p>
                          )}
                          {selected.tax_invoice_image && (
                            <>
                              <img src={selected.tax_invoice_image} alt="เอกสาร" className="w-full max-h-32 object-cover rounded-xl border border-[#E2E8F0] mt-2" />
                              <button onClick={() => downloadImage(selected.tax_invoice_image, 'tax-invoice.jpg')} className="text-xs text-[#1E3A5F] font-semibold mt-1">⬇ บันทึกรูป</button>
                            </>
                          )}
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

                  {/* Rollback button */}
                  {selected.status === 'approved' && (
                    <button onClick={handleRollbackToPending}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                      ↩ ย้อนกลับสู่รายเบิกจากทุกแผนก
                    </button>
                  )}
                  {selected.status === 'ordered' && (
                    <button onClick={handleRollbackToApproved}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                      ↩ ย้อนกลับสู่ขั้นตอนอนุมัติ
                    </button>
                  )}
                  {selected.status === 'payment_recorded' && (
                    <button onClick={handleRollbackToOrdered}
                      className="w-full py-2.5 rounded-xl font-semibold text-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                      ↩ ย้อนกลับสู่ขั้นตอนสั่งซื้อ
                    </button>
                  )}

                  {/* Action button */}
                  {selected.status === 'pending_approval' ? (
                    <button
                      onClick={() => setModalState('action_form')}
                      className={`w-full py-3 rounded-xl font-semibold text-sm ${STAGES.find((s) => s.status === selected.status)?.actionColor}`}
                    >
                      {STAGES.find((s) => s.status === selected.status)?.actionLabel} →
                    </button>
                  ) : selected.status === 'ordered' && ['สำรองจ่าย', 'qr'].includes(selected.payment_method) && !selected.reimbursed_at ? (
                    <button
                      onClick={() => setModalState('reimburse_form')}
                      className="w-full py-3 rounded-xl font-semibold text-sm bg-orange-500 text-white"
                    >
                      {selected.payment_method === 'qr' ? 'บันทึกบริษัทชำระแล้ว →' : 'บันทึกการจ่ายคืน →'}
                    </button>
                  ) : selected.status !== 'monthly_closed' ? (
                    <button
                      onClick={() => setModalState('action_form')}
                      className={`w-full py-3 rounded-xl font-semibold text-sm ${STAGES.find((s) => s.status === selected.status)?.actionColor}`}
                    >
                      {STAGES.find((s) => s.status === selected.status)?.actionLabel} →
                    </button>
                  ) : null}
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
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-sm font-semibold text-[#374151]">
                              ชื่อผู้อนุมัติ <span className="text-[#DC2626]">*</span>
                            </label>
                            <button type="button"
                              onClick={() => { setApprovedBy('Boss'); setFormErrors((p) => ({ ...p, approvedBy: '' })) }}
                              className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#1E3A5F] text-white">
                              Boss
                            </button>
                          </div>
                          <input type="text" value={approvedBy}
                            onChange={(e) => { setApprovedBy(e.target.value); setFormErrors((p) => ({ ...p, approvedBy: '' })) }}
                            placeholder="ชื่อผู้มีอำนาจอนุมัติ"
                            className={inputClass} />
                          {formErrors.approvedBy && <p className="text-[#DC2626] text-xs mt-1">{formErrors.approvedBy}</p>}
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
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            วิธีจ่ายเงิน <span className="text-[#DC2626]">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {(['เบิก', 'สำรองจ่าย', 'สำรองจ่าย_บริษัท', 'qr'] as const).map((m) => (
                              <button key={m} type="button"
                                onClick={() => { setPaymentMethod(m); setFormErrors((p) => ({ ...p, orderDisburseSlip: '', orderPaySlip: '', advanceSlip: '', qrSlip: '' })) }}
                                className={`py-2.5 rounded-xl font-semibold text-sm border transition-colors ${paymentMethod === m ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-[#374151] border-[#E2E8F0]'}`}>
                                {m === 'เบิก' ? '📄 ขอเบิก' : m === 'สำรองจ่าย' ? '💵 สำรองจ่าย (บช พนักงาน)' : m === 'สำรองจ่าย_บริษัท' ? '💼 สำรองจ่าย (บช บริษัท)' : '📱 ส่ง QR'}
                              </button>
                            ))}
                          </div>
                        </div>
                        {['เบิก', 'สำรองจ่าย', 'สำรองจ่าย_บริษัท'].includes(paymentMethod) && (
                          <div className="space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-xs font-bold text-blue-700">🏦 ข้อมูลบัญชีรับโอน</p>
                            <div>
                              <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                                เลขพร้อมเพย์ / เลขบัญชีธนาคาร
                              </label>
                              <input
                                type="text"
                                value={bankAccount}
                                onChange={(e) => setBankAccount(e.target.value)}
                                placeholder="เช่น 0812345678 หรือ 123-4-56789-0"
                                className={inputClass}
                              />
                              {formErrors.bankAccount && <p className="text-[#DC2626] text-xs mt-1">{formErrors.bankAccount}</p>}
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                                ชื่อธนาคาร
                              </label>
                              <input
                                type="text"
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                placeholder="เช่น กสิกรไทย, SCB, ทหารไทยธนชาต"
                                className={inputClass}
                              />
                              {formErrors.bankName && <p className="text-[#DC2626] text-xs mt-1">{formErrors.bankName}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={handleSaveBankInfo}
                              disabled={savingBank}
                              className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white disabled:opacity-40 active:bg-blue-700 transition-colors"
                            >
                              {savingBank ? 'กำลังบันทึก...' : 'บันทึกชั่วคราว'}
                            </button>
                          </div>
                        )}
                        {paymentMethod === 'เบิก' ? (
                          <>
                            <div>
                              <label className="block text-sm font-semibold text-[#374151] mb-1.5">สลิปที่ขอเบิก <span className="text-[#DC2626]">*</span><span className="text-xs font-normal text-gray-500 ml-1">(ขอเบิกเงินให้บริษัทโอนเข้า บช. พนักงานไปซื้อ)</span></label>
                              <input ref={orderDisburseSlipRef} type="file" accept="image/*" onChange={handleOrderDisburseSlipFile} className="hidden" />
                              {orderDisburseSlipData ? (
                                <div className="space-y-1">
                                  <img src={orderDisburseSlipData} alt="สลิปขอเบิก" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-400 truncate">{orderDisburseSlipName}</p>
                                    <button type="button" onClick={() => { setOrderDisburseSlipData(null); setOrderDisburseSlipName(''); if (orderDisburseSlipRef.current) orderDisburseSlipRef.current.value = '' }} className="text-[#DC2626] text-xs font-semibold ml-2">ลบ</button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" onClick={() => orderDisburseSlipRef.current?.click()}
                                  className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#1E3A5F] transition-colors">
                                  <span className="text-2xl">🧾</span>
                                  <span className="text-xs text-gray-400">แนบสลิปที่ขอเบิก</span>
                                </button>
                              )}
                              {formErrors.orderDisburseSlip && <p className="text-[#DC2626] text-xs mt-1">{formErrors.orderDisburseSlip}</p>}
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-[#374151] mb-1.5">สลิปชำระเงิน <span className="text-[#DC2626]">*</span><span className="text-xs font-normal text-gray-500 ml-1">(สลิปชำระเงินต้องเป็นชื่อเดียวกับผู้ขอเบิก)</span></label>
                              <input ref={orderPaySlipRef} type="file" accept="image/*" onChange={handleOrderPaySlipFile} className="hidden" />
                              {orderPaySlipData ? (
                                <div className="space-y-1">
                                  <img src={orderPaySlipData} alt="สลิปชำระ" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-400 truncate">{orderPaySlipName}</p>
                                    <button type="button" onClick={() => { setOrderPaySlipData(null); setOrderPaySlipName(''); if (orderPaySlipRef.current) orderPaySlipRef.current.value = '' }} className="text-[#DC2626] text-xs font-semibold ml-2">ลบ</button>
                                  </div>
                                </div>
                              ) : (
                                <button type="button" onClick={() => orderPaySlipRef.current?.click()}
                                  className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#1E3A5F] transition-colors">
                                  <span className="text-2xl">💳</span>
                                  <span className="text-xs text-gray-400">แนบสลิปชำระเงิน</span>
                                </button>
                              )}
                              {formErrors.orderPaySlip && <p className="text-[#DC2626] text-xs mt-1">{formErrors.orderPaySlip}</p>}
                            </div>
                          </>
                        ) : paymentMethod === 'สำรองจ่าย' ? (
                          <div>
                            <label className="block text-sm font-semibold text-[#374151] mb-1.5">สลิปสำรองจ่าย (บช พนักงาน) <span className="text-[#DC2626]">*</span></label>
                            <input ref={advanceSlipRef} type="file" accept="image/*" onChange={handleAdvanceSlipFile} className="hidden" />
                            {advanceSlipData ? (
                              <div className="space-y-1">
                                <img src={advanceSlipData} alt="สลิปสำรองจ่าย" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-400 truncate">{advanceSlipName}</p>
                                  <button type="button" onClick={() => { setAdvanceSlipData(null); setAdvanceSlipName(''); if (advanceSlipRef.current) advanceSlipRef.current.value = '' }} className="text-[#DC2626] text-xs font-semibold ml-2">ลบ</button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => advanceSlipRef.current?.click()}
                                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#1E3A5F] transition-colors">
                                <span className="text-2xl">💵</span>
                                <span className="text-xs text-gray-400">แนบสลิปสำรองจ่าย</span>
                              </button>
                            )}
                            {formErrors.advanceSlip && <p className="text-[#DC2626] text-xs mt-1">{formErrors.advanceSlip}</p>}
                          </div>
                        ) : paymentMethod === 'สำรองจ่าย_บริษัท' ? (
                          <div>
                            <label className="block text-sm font-semibold text-[#374151] mb-1.5">สลิปการโอน (บช บริษัท) <span className="text-[#DC2626]">*</span></label>
                            <input ref={advanceSlipRef} type="file" accept="image/*" onChange={handleAdvanceSlipFile} className="hidden" />
                            {advanceSlipData ? (
                              <div className="space-y-1">
                                <img src={advanceSlipData} alt="สลิปการโอน" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-400 truncate">{advanceSlipName}</p>
                                  <button type="button" onClick={() => { setAdvanceSlipData(null); setAdvanceSlipName(''); if (advanceSlipRef.current) advanceSlipRef.current.value = '' }} className="text-[#DC2626] text-xs font-semibold ml-2">ลบ</button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => advanceSlipRef.current?.click()}
                                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#1E3A5F] transition-colors">
                                <span className="text-2xl">💼</span>
                                <span className="text-xs text-gray-400">แนบสลิปการโอน (บช บริษัท)</span>
                              </button>
                            )}
                            {formErrors.advanceSlip && <p className="text-[#DC2626] text-xs mt-1">{formErrors.advanceSlip}</p>}
                          </div>
                        ) : paymentMethod === 'qr' ? (
                          <div>
                            <label className="block text-sm font-semibold text-[#374151] mb-1.5">QR Code <span className="text-[#DC2626]">*</span></label>
                            <input ref={qrSlipRef} type="file" accept="image/*" onChange={handleQrSlipFile} className="hidden" />
                            {qrSlipData ? (
                              <div className="space-y-1">
                                <img src={qrSlipData} alt="QR Code" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-400 truncate">{qrSlipName}</p>
                                  <button type="button" onClick={() => { setQrSlipData(null); setQrSlipName(''); if (qrSlipRef.current) qrSlipRef.current.value = '' }} className="text-[#DC2626] text-xs font-semibold ml-2">ลบ</button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => qrSlipRef.current?.click()}
                                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#1E3A5F] transition-colors">
                                <span className="text-2xl">📱</span>
                                <span className="text-xs text-gray-400">แนบ QR Code จากซัพพลายเออร์</span>
                              </button>
                            )}
                            {formErrors.qrSlip && <p className="text-[#DC2626] text-xs mt-1">{formErrors.qrSlip}</p>}
                          </div>
                        ) : null}
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            ช่องทางสั่งซื้อ <span className="text-[#DC2626]">*</span>
                          </label>
                          <div className="flex gap-2">
                            {(['offline', 'online'] as const).map((ch) => (
                              <button key={ch} type="button"
                                onClick={() => { setOrderChannel(ch); setOrderChannelImageData(null); setOrderChannelImageName(''); setFormErrors((p) => ({ ...p, orderChannelImage: '' })) }}
                                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm border transition-colors ${orderChannel === ch ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-[#374151] border-[#E2E8F0]'}`}>
                                {ch === 'offline' ? '🏪 Offline' : '🌐 Online'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            {orderChannel === 'offline' ? 'รูปประกอบ' : 'แคปหน้าจอคำสั่งซื้อ'} {orderChannel === 'offline' && <span className="text-[#DC2626]">*</span>}
                          </label>
                          <input ref={orderChannelImageRef} type="file" accept="image/*" onChange={handleOrderChannelImageFile} className="hidden" />
                          {orderChannelImageData ? (
                            <div className="space-y-1">
                              <img src={orderChannelImageData} alt="รูปประกอบ" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-400 truncate">{orderChannelImageName}</p>
                                <button type="button" onClick={() => { setOrderChannelImageData(null); setOrderChannelImageName(''); if (orderChannelImageRef.current) orderChannelImageRef.current.value = '' }} className="text-[#DC2626] text-xs font-semibold ml-2">ลบ</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => orderChannelImageRef.current?.click()}
                              className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#1E3A5F] transition-colors">
                              <span className="text-2xl">{orderChannel === 'offline' ? '📷' : '🖥️'}</span>
                              <span className="text-xs text-gray-400">{orderChannel === 'offline' ? 'แนบรูปประกอบ' : 'แนบแคปหน้าจอ'}</span>
                            </button>
                          )}
                          {formErrors.orderChannelImage && <p className="text-[#DC2626] text-xs mt-1">{formErrors.orderChannelImage}</p>}
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
                        <div>
                          <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                            ใบกำกับภาษี <span className="text-[#DC2626]">*</span>
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {(['yes', 'receipt', 'cash'] as const).map((v) => (
                              <button key={v} type="button"
                                onClick={() => { setTaxInvoiceStatus(v); setTaxInvoiceImageData(null); setTaxInvoiceImageName(''); if (taxInvoiceImageRef.current) taxInvoiceImageRef.current.value = ''; setFormErrors((p) => ({ ...p, taxInvoiceStatus: '', taxInvoiceImage: '' })) }}
                                className={`py-2.5 rounded-xl font-semibold text-sm border transition-colors ${taxInvoiceStatus === v ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-[#374151] border-[#E2E8F0]'}`}>
                                {v === 'yes' ? '🧾 ใบกำกับภาษี' : v === 'receipt' ? '🧾 ใบเสร็จรับเงิน' : '💵 บิลเงินสด'}
                              </button>
                            ))}
                          </div>
                          {formErrors.taxInvoiceStatus && <p className="text-[#DC2626] text-xs mt-1">{formErrors.taxInvoiceStatus}</p>}
                        </div>
                        {['yes', 'receipt', 'cash'].includes(taxInvoiceStatus) && (
                          <div>
                            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                              {taxInvoiceStatus === 'yes' ? 'รูปใบกำกับภาษี' : taxInvoiceStatus === 'receipt' ? 'รูปใบเสร็จรับเงิน' : 'รูปบิลเงินสด'} {taxInvoiceStatus !== 'cash' && <span className="text-[#DC2626]">*</span>}
                            </label>
                            <input ref={taxInvoiceImageRef} type="file" accept="image/*" onChange={handleTaxInvoiceImageFile} className="hidden" />
                            {taxInvoiceImageData ? (
                              <div className="space-y-1">
                                <img src={taxInvoiceImageData} alt="เอกสาร" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-400 truncate">{taxInvoiceImageName}</p>
                                  <button type="button" onClick={() => { setTaxInvoiceImageData(null); setTaxInvoiceImageName(''); if (taxInvoiceImageRef.current) taxInvoiceImageRef.current.value = '' }} className="text-[#DC2626] text-xs font-semibold ml-2">ลบ</button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => taxInvoiceImageRef.current?.click()}
                                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#1E3A5F] transition-colors">
                                <span className="text-2xl">{taxInvoiceStatus === 'cash' ? '💵' : '🧾'}</span>
                                <span className="text-xs text-gray-400">แนบรูปเอกสาร</span>
                              </button>
                            )}
                            {formErrors.taxInvoiceImage && <p className="text-[#DC2626] text-xs mt-1">{formErrors.taxInvoiceImage}</p>}
                          </div>
                        )}
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
                        <p className="text-gray-600">วิธีจ่ายเงิน: <span className={`font-semibold ${paymentMethod === 'เบิก' ? 'text-green-700' : paymentMethod === 'สำรองจ่าย' ? 'text-orange-600' : paymentMethod === 'สำรองจ่าย_บริษัท' ? 'text-blue-700' : 'text-purple-700'}`}>
                          {paymentMethod === 'เบิก' ? 'ขอเบิก' : paymentMethod === 'สำรองจ่าย' ? 'สำรองจ่าย (บช พนักงาน)' : paymentMethod === 'สำรองจ่าย_บริษัท' ? 'สำรองจ่าย (บช บริษัท)' : 'ส่ง QR Code'}
                        </span></p>
                        <p className="text-gray-600">ช่องทางสั่งซื้อ: <span className="font-semibold">{orderChannel === 'offline' ? '🏪 Offline' : '🌐 Online'}</span></p>
                      </>
                    )}
                    {selected.status === 'ordered' && (
                      <>
                        <p className="text-gray-600">รายละเอียด: <span className="font-semibold">{paymentNote}</span></p>
                        {remainingNote && <p className="text-gray-600">คงเหลือ: {remainingNote}</p>}
                        <p className="text-gray-600">เอกสาร: <span className="font-semibold">{taxInvoiceStatus === 'yes' ? '🧾 ใบกำกับภาษี' : taxInvoiceStatus === 'receipt' ? '🧾 ใบเสร็จรับเงิน' : '💵 บิลเงินสด'}</span></p>
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

              {/* Reimburse form */}
              {(modalState === 'reimburse_form' || modalState === 'reimburse_submitting') && (
                <>
                  <div className="space-y-3">
                    <div className="bg-orange-50 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-orange-700">
                        {selected.payment_method === 'qr' ? 'บันทึกการชำระโดยบริษัท' : 'บันทึกการจ่ายคืนจากบริษัท'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selected.payment_method === 'qr' ? 'แนบสลิปยืนยันที่บริษัทชำระ QR แล้ว' : 'แนบสลิปที่บริษัทจ่ายคืนให้เพื่อดำเนินการขั้นตอนถัดไป'}
                      </p>
                    </div>
                    {selected.payment_method === 'สำรองจ่าย' && (
                      <div className="bg-blue-50 rounded-xl px-3 py-3 border border-blue-100">
                        <p className="text-xs font-bold text-blue-700 mb-2">🏦 บัญชีรับโอนของผู้กรอก</p>
                        {selected.bank_account ? (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500">เลขบัญชี / พร้อมเพย์</span>
                              <span className="text-xs font-semibold text-[#374151]">{selected.bank_account}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500">ธนาคาร</span>
                              <span className="text-xs font-semibold text-[#374151]">{selected.bank_name || '—'}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-orange-600">⚠️ ยังไม่มีข้อมูลบัญชี — กลับไปกรอกในขั้นตอนก่อนหน้า</p>
                        )}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                        สลิปที่บริษัทจ่ายคืน <span className="text-[#DC2626]">*</span>
                      </label>
                      <input ref={reimbursementSlipRef} type="file" accept="image/*" onChange={handleReimbursementSlipFile} className="hidden" />
                      {reimbursementSlipData ? (
                        <div className="space-y-1">
                          <img src={reimbursementSlipData} alt="สลิปจ่ายคืน" className="w-full max-h-40 object-cover rounded-xl border border-[#E2E8F0]" />
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400 truncate">{reimbursementSlipName}</p>
                            <button type="button"
                              onClick={() => { setReimbursementSlipData(null); setReimbursementSlipName(''); if (reimbursementSlipRef.current) reimbursementSlipRef.current.value = '' }}
                              className="text-[#DC2626] text-xs font-semibold ml-2">ลบ</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => reimbursementSlipRef.current?.click()}
                          className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1 hover:border-[#1E3A5F] transition-colors">
                          <span className="text-2xl">💵</span>
                          <span className="text-xs text-gray-400">แนบสลิปการจ่ายคืน</span>
                        </button>
                      )}
                      {formErrors.reimbursementSlip && <p className="text-[#DC2626] text-xs mt-1">{formErrors.reimbursementSlip}</p>}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => { setModalState('detail'); setFormErrors({}) }}
                      className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm">
                      ยกเลิก
                    </button>
                    <button onClick={handleReimburseSubmit}
                      disabled={modalState === 'reimburse_submitting'}
                      className="flex-1 py-3 rounded-xl font-semibold text-sm bg-orange-500 text-white disabled:opacity-60">
                      {modalState === 'reimburse_submitting' ? 'กำลังบันทึก...' : 'ยืนยัน'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Equipment delete confirmation modal */}
      {deleteEqTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="text-base font-bold text-[#374151]">ยืนยันการลบคำขอ</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                คุณต้องการลบคำขอของ<br />
                <span className="font-semibold text-[#374151]">{deleteEqTarget.nickname}</span><br />
                ({deleteEqTarget.description || deleteEqTarget.request_type}) ใช่หรือไม่?
              </p>
              <p className="text-xs text-[#DC2626] mt-2">⚠️ ไม่สามารถกู้คืนได้</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteEqTarget(null)}
                disabled={deletingEq}
                className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-gray-600"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDeleteEq}
                disabled={deletingEq}
                className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold disabled:opacity-50"
              >
                {deletingEq ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="text-base font-bold text-[#374151]">ยืนยันการลบรายการ</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                คุณต้องการลบ<br />
                <span className="font-semibold text-[#374151]">&ldquo;{deleteTarget.item_list}&rdquo;</span><br />
                ของ {deleteTarget.requester} ใช่หรือไม่?
              </p>
              <p className="text-xs text-[#DC2626] mt-2">⚠️ ไม่สามารถกู้คืนได้</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-sm font-semibold text-gray-600"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
