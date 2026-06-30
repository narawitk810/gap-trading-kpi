'use client'

import { useState, useRef } from 'react'
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

type PageState = 'form' | 'confirm' | 'submitting' | 'success'

export default function PromoThresholdPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [pageState, setPageState] = useState<PageState>('form')
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState('')
  const [nickname, setNickname] = useState('')
  const [productName, setProductName] = useState('')
  const [thresholdAmount, setThresholdAmount] = useState('')
  const [startMonth, setStartMonth] = useState('')
  const [endMonth, setEndMonth] = useState('')
  const [note, setNote] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((p) => ({ ...p, image: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' }))
      return
    }
    try {
      setImageData(await compressImage(file))
      setErrors((p) => ({ ...p, image: '' }))
    } catch {
      setErrors((p) => ({ ...p, image: 'โหลดรูปไม่ได้ กรุณาลองใหม่' }))
    }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!nickname.trim()) e.nickname = 'กรุณากรอกชื่อเล่น'
    if (!productName.trim()) e.productName = 'กรุณาระบุชื่อสินค้า'
    if (!thresholdAmount.trim()) e.thresholdAmount = 'กรุณาระบุยอดซื้อครบ'
    if (!startMonth) e.startMonth = 'กรุณาระบุเดือนเริ่มโปร'
    if (!endMonth) e.endMonth = 'กรุณาระบุเดือนสิ้นสุดโปร'
    if (startMonth && endMonth && endMonth < startMonth) e.endMonth = 'เดือนสิ้นสุดต้องไม่ก่อนเดือนเริ่ม'
    if (!imageData) e.image = 'กรุณาแนบรูปสินค้า'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleConfirm() {
    setSubmitting(true)
    setPageState('submitting')
    try {
      const res = await fetch('/api/promo-threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          product_name: productName.trim(),
          threshold_amount: thresholdAmount.trim(),
          start_month: startMonth,
          end_month: endMonth,
          note: note.trim(),
          image_data: imageData,
        }),
      })
      const data = await res.json()
      if (res.ok) { setSubmittedId(data.id); setPageState('success') }
      else { alert(data.error || 'เกิดข้อผิดพลาด'); setPageState('confirm') }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ')
      setPageState('confirm')
    } finally {
      setSubmitting(false)
    }
  }

  function formatMonthThai(m: string) {
    if (!m) return ''
    const names = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const [y, mo] = m.split('-')
    return `${names[parseInt(mo) - 1]} ${parseInt(y) + 543}`
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🎁</div>
          <h2 className="text-xl font-bold text-[#1E3A5F] mb-2">บันทึกโปรซื้อครบเรียบร้อย</h2>
          <p className="text-gray-500 text-sm mb-1">รหัส: <span className="font-mono text-xs">{submittedId}</span></p>
          <p className="text-gray-400 text-xs mb-6">Admin จะรับทราบรายการโปรนี้</p>
          <button onClick={() => router.push('/')}
            className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm">
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    )
  }

  if (pageState === 'confirm' || pageState === 'submitting') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
          <div className="bg-[#1E3A5F] text-white px-5 py-4">
            <h2 className="font-bold text-lg">ยืนยันโปรซื้อครบ</h2>
            <p className="text-sm opacity-75 mt-0.5">ตรวจสอบข้อมูลก่อนส่ง</p>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ชื่อเล่น</p>
              <p className="font-semibold text-[#374151]">{nickname}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ชื่อสินค้า</p>
              <p className="text-sm text-[#374151]">{productName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ยอดซื้อครบ</p>
              <p className="text-sm font-semibold text-[#374151]">{thresholdAmount} บาท</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ช่วงโปรโมชั่น</p>
              <p className="text-sm font-semibold text-[#374151]">{formatMonthThai(startMonth)} – {formatMonthThai(endMonth)}</p>
            </div>
            {note && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">หมายเหตุ</p>
                <p className="text-sm text-[#374151]">{note}</p>
              </div>
            )}
            {imageData && (
              <div>
                <p className="text-xs text-gray-500 mb-2">รูปสินค้า</p>
                <img src={imageData} alt="สินค้า" className="w-full max-h-48 object-cover rounded-xl border border-[#E2E8F0]" />
              </div>
            )}
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={() => setPageState('form')}
              className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm">
              แก้ไข
            </button>
            <button onClick={handleConfirm} disabled={submitting}
              className="flex-1 bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60">
              {submitting ? 'กำลังส่ง...' : 'ยืนยันส่ง'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/70 hover:text-white text-lg w-8">←</button>
          <div>
            <h1 className="text-base font-bold">โปรซื้อครบ</h1>
            <p className="text-xs opacity-70 mt-0.5">แจ้งโปรโมชั่นซื้อครบของสินค้า</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-10">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              ชื่อเล่น <span className="text-[#DC2626]">*</span>
            </label>
            <input type="text" value={nickname}
              onChange={(e) => { setNickname(e.target.value); setErrors((p) => ({ ...p, nickname: '' })) }}
              placeholder="ชื่อเล่นของคุณ"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
            {errors.nickname && <p className="text-[#DC2626] text-xs mt-1">{errors.nickname}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              ชื่อสินค้า <span className="text-[#DC2626]">*</span>
            </label>
            <input type="text" value={productName}
              onChange={(e) => { setProductName(e.target.value); setErrors((p) => ({ ...p, productName: '' })) }}
              placeholder="เช่น Pokemon SV10 Prismatic Evolutions"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
            {errors.productName && <p className="text-[#DC2626] text-xs mt-1">{errors.productName}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              ซื้อครบ (บาท) <span className="text-[#DC2626]">*</span>
            </label>
            <input type="number" value={thresholdAmount}
              onChange={(e) => { setThresholdAmount(e.target.value); setErrors((p) => ({ ...p, thresholdAmount: '' })) }}
              placeholder="เช่น 500"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
            {errors.thresholdAmount && <p className="text-[#DC2626] text-xs mt-1">{errors.thresholdAmount}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                เริ่มโปรเดือน <span className="text-[#DC2626]">*</span>
              </label>
              <input type="month" value={startMonth}
                onChange={(e) => { setStartMonth(e.target.value); setErrors((p) => ({ ...p, startMonth: '', endMonth: '' })) }}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              {errors.startMonth && <p className="text-[#DC2626] text-xs mt-1">{errors.startMonth}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                สิ้นสุดเดือน <span className="text-[#DC2626]">*</span>
              </label>
              <input type="month" value={endMonth}
                onChange={(e) => { setEndMonth(e.target.value); setErrors((p) => ({ ...p, endMonth: '' })) }}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]" />
              {errors.endMonth && <p className="text-[#DC2626] text-xs mt-1">{errors.endMonth}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              หมายเหตุ
            </label>
            <textarea value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เพิ่มเติม (ถ้ามี)"
              rows={2}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              รูปสินค้า <span className="text-[#DC2626]">*</span>
            </label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            {imageData ? (
              <div className="relative">
                <img src={imageData} alt="สินค้า" className="w-full max-h-56 object-cover rounded-xl border border-[#E2E8F0]" />
                <button type="button"
                  onClick={() => { setImageData(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="absolute top-2 right-2 bg-[#DC2626] text-white w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center shadow">
                  ×
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-8 flex flex-col items-center gap-2 hover:border-[#1E3A5F] transition-colors">
                <span className="text-3xl">📸</span>
                <span className="text-sm text-gray-400">แตะเพื่อถ่ายรูปหรือเลือกจากคลัง</span>
              </button>
            )}
            {errors.image && <p className="text-[#DC2626] text-xs mt-1">{errors.image}</p>}
          </div>
        </div>

        <button type="button" onClick={() => { if (validate()) setPageState('confirm') }}
          className="w-full bg-[#1E3A5F] text-white py-4 rounded-xl font-bold text-base shadow-md active:opacity-90">
          บันทึกโปรซื้อครบ
        </button>
      </div>
    </div>
  )
}
