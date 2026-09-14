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

interface LiveStaff {
  id: string
  name: string
  department: string
}

type PageState = 'form' | 'confirm' | 'submitting' | 'success'

export default function LiveRequestPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pageState, setPageState] = useState<PageState>('form')
  const [liveStaff, setLiveStaff] = useState<LiveStaff[]>([])
  const [nickname, setNickname] = useState('')
  const [productName, setProductName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/live-staff')
      .then((r) => r.json())
      .then((d) => {
        const all: LiveStaff[] = d.staff || []
        setLiveStaff(all.filter((s) => s.department === 'ไลฟ์สด'))
      })
      .catch(() => {})
  }, [])

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((p) => ({ ...p, image: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' }))
      return
    }
    setImageUploading(true)
    setErrors((p) => ({ ...p, image: '' }))
    try {
      const base64 = await compressImage(file)
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64 }),
      })
      if (res.ok) {
        const { url } = await res.json()
        setImageData(url)
      } else {
        setImageData(base64)
      }
    } catch {
      setErrors((p) => ({ ...p, image: 'โหลดรูปไม่ได้ กรุณาลองใหม่' }))
    } finally {
      setImageUploading(false)
    }
  }

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!nickname.trim()) e.nickname = 'กรุณาเลือกชื่อ'
    if (!productName.trim()) e.productName = 'กรุณากรอกชื่อสินค้า'
    if (!quantity.trim()) e.quantity = 'กรุณากรอกจำนวน'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmitClick() {
    if (!validate()) return
    setPageState('confirm')
  }

  async function handleConfirm() {
    setPageState('submitting')
    try {
      const res = await fetch('/api/live-urgent-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, product_name: productName, quantity, note, image_data: imageData }),
      })
      if (!res.ok) {
        const data = await res.json()
        setErrors({ submit: data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่' })
        setPageState('form')
        return
      }
      setPageState('success')
    } catch {
      setErrors({ submit: 'เกิดข้อผิดพลาด กรุณาลองใหม่' })
      setPageState('form')
    }
  }

  function handleReset() {
    setNickname('')
    setProductName('')
    setQuantity('')
    setNote('')
    setImageData(null)
    setErrors({})
    setPageState('form')
    if (fileRef.current) fileRef.current.value = ''
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex flex-col items-center justify-center p-4" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>
        <div className="bg-white rounded-2xl p-8 shadow-sm w-full max-w-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-[#16A34A] mb-2">ส่งคำขอแล้ว!</h2>
          <p className="text-sm text-[#374151] mb-6">ทีมสต็อกได้รับแจ้งเตือนแล้ว</p>
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl bg-[#1E3A5F] text-white font-semibold text-sm"
          >
            ส่งคำขออีกครั้ง
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>
      <div className="max-w-sm mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="pt-4">
          <h1 className="text-xl font-bold text-[#1E3A5F]">🚨 ขอสินค้าเร่งด่วน</h1>
          <p className="text-xs text-[#374151] mt-1">สำหรับพนักงานไลฟ์สด</p>
        </div>

        {/* Service notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-base leading-none mt-0.5">⏰</span>
          <p className="text-sm text-amber-800">บริการขอสินค้าเร่งด่วนให้บริการ <strong>10:00 – 20:00 น.</strong></p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          {/* ชื่อพนักงาน */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              ชื่อพนักงาน <span className="text-[#DC2626]">*</span>
            </label>
            <select
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            >
              <option value="">— เลือกชื่อ —</option>
              {liveStaff.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            {errors.nickname && <p className="text-[#DC2626] text-xs mt-1">{errors.nickname}</p>}
          </div>

          {/* ชื่อสินค้า */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              ชื่อสินค้า <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="เช่น Pokemon SV10 กล่อง"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            />
            {errors.productName && <p className="text-[#DC2626] text-xs mt-1">{errors.productName}</p>}
          </div>

          {/* จำนวน */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              จำนวนที่ต้องการ <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="เช่น 2 กล่อง / 10 ซอง"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30"
            />
            {errors.quantity && <p className="text-[#DC2626] text-xs mt-1">{errors.quantity}</p>}
          </div>

          {/* หมายเหตุ */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">หมายเหตุ (ถ้ามี)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ข้อมูลเพิ่มเติม..."
              rows={2}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/30 resize-none"
            />
          </div>

          {/* รูปสินค้า */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">รูปสินค้า (แนะนำ)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {imageData ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageData.startsWith('https://') ? imageData : imageData}
                  alt="สินค้า"
                  className="w-full h-40 object-cover rounded-xl border border-[#E2E8F0]"
                />
                <button
                  type="button"
                  onClick={() => { setImageData(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="absolute top-2 right-2 bg-white/90 text-[#DC2626] rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={imageUploading}
                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 text-sm text-[#374151] flex flex-col items-center gap-1"
              >
                {imageUploading ? (
                  <span className="text-[#1E3A5F]">กำลังอัพโหลด...</span>
                ) : (
                  <>
                    <span className="text-2xl">📷</span>
                    <span>แตะเพื่อเลือกรูป</span>
                  </>
                )}
              </button>
            )}
            {errors.image && <p className="text-[#DC2626] text-xs mt-1">{errors.image}</p>}
          </div>

          {errors.submit && <p className="text-[#DC2626] text-xs">{errors.submit}</p>}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmitClick}
          disabled={imageUploading}
          className="w-full py-3.5 rounded-xl bg-[#DC2626] text-white font-bold text-base shadow-sm disabled:opacity-50"
        >
          ส่งคำขอ
        </button>
      </div>

      {/* Confirm dialog */}
      {pageState === 'confirm' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <h3 className="text-base font-bold text-[#1E3A5F]">ยืนยันการส่งคำขอ</h3>
            <div className="space-y-1 text-sm text-[#374151]">
              <p><span className="font-semibold">พนักงาน:</span> {nickname}</p>
              <p><span className="font-semibold">สินค้า:</span> {productName}</p>
              <p><span className="font-semibold">จำนวน:</span> {quantity}</p>
              {note && <p><span className="font-semibold">หมายเหตุ:</span> {note}</p>}
              {imageData && <p className="text-[#16A34A]">✅ มีรูปสินค้า</p>}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPageState('form')}
                className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-sm text-[#374151] font-semibold"
              >
                แก้ไข
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-bold"
              >
                ยืนยัน ส่งเลย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submitting overlay */}
      {pageState === 'submitting' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-8 py-6 text-center">
            <p className="text-sm text-[#374151]">กำลังส่งคำขอ...</p>
          </div>
        </div>
      )}
    </div>
  )
}
