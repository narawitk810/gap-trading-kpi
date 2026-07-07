'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { DEPARTMENTS } from '@/types/kpi'

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 800
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width)
            width = MAX
          } else {
            width = Math.round((width * MAX) / height)
            height = MAX
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
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

type RequestType = 'damaged' | 'new'
type PageState = 'select' | 'form' | 'confirm' | 'success'

export default function EquipmentPage() {
  const [pageState, setPageState] = useState<PageState>('select')
  const [requestType, setRequestType] = useState<RequestType>('damaged')
  const [nickname, setNickname] = useState('')
  const [department, setDepartment] = useState('')
  const [action, setAction] = useState<'ซ่อม' | 'เบิกใหม่' | ''>('')
  const [description, setDescription] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState('')
  const [errors, setErrors] = useState<{ [k: string]: string }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'กรุณาเลือกไฟล์รูปภาพเท่านั้น' }))
      return
    }
    try {
      const compressed = await compressImage(file)
      setImageData(compressed)
      setErrors((prev) => ({ ...prev, image: '' }))
    } catch {
      setErrors((prev) => ({ ...prev, image: 'ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่' }))
    }
  }

  function validate() {
    const e: { [k: string]: string } = {}
    if (!nickname.trim()) e.nickname = 'กรุณากรอกชื่อเล่น'
    if (!department) e.department = 'กรุณาเลือกแผนก'
    if (requestType === 'damaged' && !action) e.action = 'กรุณาเลือกประเภทการดำเนินการ'
    if (!description.trim()) e.description = 'กรุณากรอกคำอธิบาย'
    if (!imageData) e.image = 'กรุณาแนบรูปภาพ'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmitClick() {
    if (validate()) setPageState('confirm')
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: `${nickname.trim()} (${department})`,
          request_type: requestType,
          action: action,
          description: description.trim(),
          image_data: imageData,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmittedId(data.id)
        setPageState('success')
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        setPageState('confirm')
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต')
      setPageState('confirm')
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setNickname('')
    setDepartment('')
    setAction('')
    setDescription('')
    setImageData(null)
    setErrors({})
    setSubmittedId('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">ส่งแจ้งสำเร็จ</h2>
          <p className="text-gray-500 text-sm mb-1">เลขอ้างอิง</p>
          <p className="text-lg font-bold text-[#16A34A] mb-2">#{submittedId}</p>
          <p className="text-gray-400 text-sm mb-8">
            ทีม HR จะดำเนินการตรวจสอบและติดต่อกลับ
          </p>
          <button
            onClick={() => {
              resetForm()
              setPageState('select')
            }}
            className="w-full bg-[#1E3A5F] text-white py-3.5 rounded-xl font-semibold text-base mb-3"
          >
            แจ้งรายการใหม่
          </button>
          <Link
            href="/"
            className="block w-full border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm text-center"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    )
  }

  if (pageState === 'confirm') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
          <div className="bg-[#1E3A5F] text-white px-5 py-4">
            <h2 className="font-bold text-lg">ยืนยันการแจ้ง</h2>
            <p className="text-sm opacity-75 mt-0.5">ตรวจสอบข้อมูลก่อนส่ง</p>
          </div>
          <div className="p-5 space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ชื่อเล่น</p>
              <p className="font-semibold text-[#374151]">{nickname}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">แผนก</p>
              <p className="font-semibold text-[#374151]">{department}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ประเภท</p>
              <p className="font-semibold text-[#374151]">
                {requestType === 'damaged' ? 'อุปกรณ์เสีย' : 'เบิกอุปกรณ์ใหม่'}
                {action ? ` — ${action}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">คำอธิบาย</p>
              <p className="text-sm text-[#374151]">{description}</p>
            </div>
            {imageData && (
              <div>
                <p className="text-xs text-gray-500 mb-2">รูปภาพ</p>
                <img
                  src={imageData}
                  alt="หลักฐาน"
                  className="w-full max-h-48 object-cover rounded-xl border border-[#E2E8F0]"
                />
              </div>
            )}
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={() => setPageState('form')}
              className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm"
            >
              แก้ไข
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="flex-1 bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
            >
              {submitting ? 'กำลังส่ง...' : 'ยืนยันส่ง'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (pageState === 'select') {
    return (
      <div className="min-h-screen bg-[#F5F6F8]">
        <div className="bg-[#1E3A5F] text-white px-4 py-5 text-center shadow-md relative">
          <Link href="/" className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
          <p className="text-sm mt-1 opacity-75">แจ้งเบิกทุกอย่าง</p>
        </div>

        <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
          <p className="text-sm text-gray-500 text-center mb-6">เลือกประเภทที่ต้องการแจ้ง</p>

          <button
            onClick={() => { setRequestType('damaged'); setPageState('form') }}
            className="w-full bg-white rounded-2xl shadow-sm p-5 text-left flex items-start gap-4 hover:shadow-md transition-shadow border border-[#E2E8F0] active:bg-gray-50"
          >
            <div className="w-12 h-12 bg-[#DC2626] rounded-xl flex items-center justify-center shrink-0 text-2xl">🔧</div>
            <div>
              <p className="font-bold text-[#374151] text-base">อุปกรณ์เสีย</p>
              <p className="text-sm text-gray-400 mt-1">แจ้งอุปกรณ์ชำรุด ต้องการซ่อมหรือเบิกใหม่ พร้อมรูปหลักฐาน</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-300 ml-auto shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => { setRequestType('new'); setPageState('form') }}
            className="w-full bg-white rounded-2xl shadow-sm p-5 text-left flex items-start gap-4 hover:shadow-md transition-shadow border border-[#E2E8F0] active:bg-gray-50"
          >
            <div className="w-12 h-12 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-2xl">📦</div>
            <div>
              <p className="font-bold text-[#374151] text-base">เบิกอุปกรณ์ใหม่</p>
              <p className="text-sm text-gray-400 mt-1">ขอเบิกอุปกรณ์ใหม่ พร้อมรูปตัวอย่างและเหตุผลความจำเป็น</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-300 ml-auto shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="bg-[#1E3A5F] text-white px-4 py-5 text-center shadow-md relative">
        <button
          onClick={() => { resetForm(); setPageState('select') }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
        <p className="text-sm mt-1 opacity-75">แจ้งเบิกทุกอย่าง</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-10">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-2">
              ชื่อเล่น <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setErrors((p) => ({ ...p, nickname: '' })) }}
              placeholder="ชื่อเล่นของคุณ"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
            {errors.nickname && <p className="text-[#DC2626] text-xs mt-1">{errors.nickname}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-2">
              แผนก <span className="text-[#DC2626]">*</span>
            </label>
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="flex gap-2 w-max pb-1">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => { setDepartment(dept); setErrors((p) => ({ ...p, department: '' })) }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
                      department === dept
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-white text-[#374151] border-[#E2E8F0]'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>
            {errors.department && <p className="text-[#DC2626] text-xs mt-1">{errors.department}</p>}
          </div>

          {requestType === 'damaged' && (
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-2">
                ต้องการ <span className="text-[#DC2626]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['ซ่อม', 'เบิกใหม่'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { setAction(opt); setErrors((p) => ({ ...p, action: '' })) }}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      action === opt
                        ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                        : 'bg-white text-[#374151] border-[#E2E8F0]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              {errors.action && <p className="text-[#DC2626] text-xs mt-1">{errors.action}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-2">
              {requestType === 'damaged' ? 'คำอธิบายอุปกรณ์ที่เสีย' : 'คำอธิบายและเหตุผลความจำเป็น'}
              {' '}<span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setErrors((p) => ({ ...p, description: '' })) }}
              placeholder={requestType === 'damaged' ? 'เช่น คอมพิวเตอร์โน้ตบุ๊คหน้าจอแตก ใช้งานไม่ได้' : 'เช่น ขอเบิกเมาส์ไร้สาย เนื่องจากของเดิมชำรุดและส่งผลต่อการทำงาน'}
              rows={3}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
            />
            {errors.description && <p className="text-[#DC2626] text-xs mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-2">
              {requestType === 'damaged' ? 'รูปอุปกรณ์ที่เสีย' : 'รูปตัวอย่างอุปกรณ์ที่ต้องการ'}
              {' '}<span className="text-[#DC2626]">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            {imageData ? (
              <div className="relative">
                <img
                  src={imageData}
                  alt="อุปกรณ์"
                  className="w-full max-h-56 object-cover rounded-xl border border-[#E2E8F0]"
                />
                <button
                  type="button"
                  onClick={() => { setImageData(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="absolute top-2 right-2 bg-[#DC2626] text-white w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center shadow"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-xs text-[#1E3A5F] font-semibold hover:underline"
                >
                  เปลี่ยนรูป
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-8 flex flex-col items-center gap-2 hover:border-[#1E3A5F] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-400">แตะเพื่อเลือกรูปหรือถ่ายภาพ</span>
              </button>
            )}
            {errors.image && <p className="text-[#DC2626] text-xs mt-1">{errors.image}</p>}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmitClick}
          className="w-full bg-[#1E3A5F] text-white py-4 rounded-xl font-bold text-base shadow-md active:opacity-90"
        >
          ส่งแจ้ง
        </button>
      </div>
    </div>
  )
}
