'use client'

import { useState, useRef, useEffect } from 'react'

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

interface BlacklistEntry {
  id: string
  customer_name: string
  reason: string
  incident_date: string
  image_data: string | null
  reported_by: string
  created_at: string
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`
}

export default function BlacklistPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [entries, setEntries] = useState<BlacklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const [customerName, setCustomerName] = useState('')
  const [reason, setReason] = useState('')
  const [incidentDate, setIncidentDate] = useState('')
  const [reportedBy, setReportedBy] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function fetchEntries() {
    setLoading(true)
    try {
      const res = await fetch('/api/blacklist')
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchEntries() }, [])

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors(p => ({ ...p, image: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' }))
      return
    }
    setImageUploading(true)
    setErrors(p => ({ ...p, image: '' }))
    try {
      const base64 = await compressImage(file)
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 }),
      })
      setImageData(res.ok ? (await res.json()).url : base64)
    } catch {
      setErrors(p => ({ ...p, image: 'โหลดรูปไม่ได้ กรุณาลองใหม่' }))
    } finally { setImageUploading(false) }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!customerName.trim()) e.customerName = 'กรุณากรอกชื่อลูกค้า'
    if (!reason.trim()) e.reason = 'กรุณากรอกเหตุผล'
    if (!incidentDate) e.incidentDate = 'กรุณาระบุวันที่เกิดเหตุ'
    if (!reportedBy.trim()) e.reportedBy = 'กรุณากรอกชื่อผู้แจ้ง'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: customerName, reason, incident_date: incidentDate, image_data: imageData, reported_by: reportedBy }),
      })
      if (!res.ok) {
        const d = await res.json()
        setErrors({ submit: d.error || 'เกิดข้อผิดพลาด' })
        setShowConfirm(false)
        return
      }
      setCustomerName(''); setReason(''); setIncidentDate(''); setReportedBy(''); setImageData(null)
      if (fileRef.current) fileRef.current.value = ''
      setShowConfirm(false)
      setShowForm(false)
      await fetchEntries()
    } catch {
      setErrors({ submit: 'เกิดข้อผิดพลาด กรุณาลองใหม่' })
      setShowConfirm(false)
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => history.back()} className="text-white/70 text-lg w-8">←</button>
        <div>
          <h1 className="text-base font-bold">🚫 Blacklist ลูกค้า</h1>
          <p className="text-xs opacity-70">รายชื่อลูกค้าที่ต้องระวัง</p>
        </div>
        <button
          onClick={() => { setShowForm(p => !p); setErrors({}) }}
          className="ml-auto text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-semibold"
        >
          {showForm ? '✕ ปิด' : '+ เพิ่มรายชื่อ'}
        </button>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <p className="text-sm font-bold text-[#1E3A5F]">เพิ่มรายชื่อ Blacklist ใหม่</p>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">ชื่อลูกค้า / ชื่อบัญชี <span className="text-[#DC2626]">*</span></label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="ชื่อจริง หรือ ชื่อบัญชี TikTok / FB"
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
              {errors.customerName && <p className="text-[#DC2626] text-xs mt-1">{errors.customerName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">เหตุผล / พฤติกรรม <span className="text-[#DC2626]">*</span></label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="อธิบายพฤติกรรมที่เป็นปัญหา..."
                rows={3}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 resize-none"
              />
              {errors.reason && <p className="text-[#DC2626] text-xs mt-1">{errors.reason}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">วันที่เกิดเหตุ <span className="text-[#DC2626]">*</span></label>
              <input
                type="date"
                value={incidentDate}
                onChange={e => setIncidentDate(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
              {errors.incidentDate && <p className="text-[#DC2626] text-xs mt-1">{errors.incidentDate}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">ชื่อผู้แจ้ง <span className="text-[#DC2626]">*</span></label>
              <input
                type="text"
                value={reportedBy}
                onChange={e => setReportedBy(e.target.value)}
                placeholder="ชื่อพนักงานที่แจ้ง"
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
              />
              {errors.reportedBy && <p className="text-[#DC2626] text-xs mt-1">{errors.reportedBy}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">รูปหลักฐาน (ถ้ามี)</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              {imageData ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageData} alt="หลักฐาน" className="w-full h-36 object-cover rounded-xl border border-[#E2E8F0]" />
                  <button
                    type="button"
                    onClick={() => { setImageData(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="absolute top-2 right-2 bg-white/90 text-[#DC2626] rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow"
                  >✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={imageUploading}
                  className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-5 text-sm text-[#374151] flex flex-col items-center gap-1"
                >
                  {imageUploading ? <span className="text-[#1E3A5F]">กำลังอัพโหลด...</span> : <><span className="text-2xl">📷</span><span>แตะเพื่อเลือกรูป</span></>}
                </button>
              )}
              {errors.image && <p className="text-[#DC2626] text-xs mt-1">{errors.image}</p>}
            </div>

            {errors.submit && <p className="text-[#DC2626] text-xs">{errors.submit}</p>}

            <button
              onClick={() => { if (validate()) setShowConfirm(true) }}
              disabled={imageUploading}
              className="w-full py-3 rounded-xl bg-[#DC2626] text-white font-bold text-sm disabled:opacity-50"
            >
              บันทึกรายชื่อ
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-10 text-sm text-gray-400">กำลังโหลด...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">ยังไม่มีรายชื่อ Blacklist</div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 font-semibold">{entries.length} รายชื่อ</p>
            {entries.map(entry => (
              <div key={entry.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#DC2626]">🚫 {entry.customer_name}</span>
                    </div>
                    <p className="text-xs text-[#374151] mt-1.5 leading-relaxed">{entry.reason}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">📅 {formatDate(entry.incident_date)}</span>
                      <span className="text-xs text-gray-500">แจ้งโดย {entry.reported_by}</span>
                    </div>
                  </div>
                  {entry.image_data && (
                    <button onClick={() => setSelectedImage(entry.image_data)} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.image_data} alt="หลักฐาน" className="w-16 h-16 object-cover rounded-xl border border-[#E2E8F0]" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-base font-bold text-[#1E3A5F]">ยืนยันการบันทึก</h3>
            <div className="space-y-1 text-sm text-[#374151]">
              <p><span className="font-semibold">ลูกค้า:</span> {customerName}</p>
              <p><span className="font-semibold">วันที่:</span> {formatDate(incidentDate)}</p>
              <p><span className="font-semibold">แจ้งโดย:</span> {reportedBy}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#374151] font-semibold">แก้ไข</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-bold disabled:opacity-50">
                {submitting ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image preview */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedImage} alt="หลักฐาน" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  )
}
