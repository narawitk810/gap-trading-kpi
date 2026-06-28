'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

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

type PageState = 'form' | 'confirm' | 'submitting' | 'success'

export default function RequestPage() {
  const [nickname, setNickname] = useState('')
  const [description, setDescription] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [pageState, setPageState] = useState<PageState>('form')
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
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
      setImageFile(file)
      setErrors((prev) => ({ ...prev, image: '' }))
    } catch {
      setErrors((prev) => ({ ...prev, image: 'ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่' }))
    }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!nickname.trim()) e.nickname = 'กรุณากรอกชื่อเล่น'
    if (!description.trim()) e.description = 'กรุณาระบุรายละเอียดสินค้า'
    if (!imageData) e.image = 'กรุณาแนบรูปสินค้า'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmitClick() {
    if (validate()) setPageState('confirm')
  }

  async function handleConfirm() {
    setSubmitting(true)
    setPageState('submitting')
    try {
      const res = await fetch('/api/product-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
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

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-[#1E3A5F] mb-2">ส่งคำขอสำเร็จ</h2>
          <p className="text-gray-500 text-sm mb-1">เลขอ้างอิง</p>
          <p className="text-lg font-bold text-[#16A34A] mb-2">#{submittedId}</p>
          <p className="text-gray-400 text-sm mb-8">
            Admin จะตรวจสอบและอนุมัติ<br />สามารถเช็คสถานะได้ที่หน้าด้านล่าง
          </p>
          <Link
            href={`/status?nickname=${encodeURIComponent(nickname)}`}
            className="block w-full bg-[#1E3A5F] text-white py-3.5 rounded-xl font-semibold text-base text-center mb-3"
          >
            ดูสถานะคำขอของฉัน
          </Link>
          <button
            onClick={() => {
              setNickname('')
              setDescription('')
              setImageData(null)
              setImageFile(null)
              setErrors({})
              setPageState('form')
              setSubmittedId('')
            }}
            className="w-full border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm"
          >
            ขอสินค้าอีกชิ้น
          </button>
        </div>
      </div>
    )
  }

  if (pageState === 'confirm') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm overflow-hidden">
          <div className="bg-[#1E3A5F] text-white px-5 py-4">
            <h2 className="font-bold text-lg">ยืนยันคำขอสินค้า</h2>
            <p className="text-sm opacity-75 mt-0.5">ตรวจสอบข้อมูลก่อนส่ง</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">ชื่อเล่น</p>
              <p className="font-semibold text-[#374151]">{nickname}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">รายละเอียดสินค้า</p>
              <p className="text-sm text-[#374151]">{description}</p>
            </div>
            {imageData && (
              <div>
                <p className="text-xs text-gray-500 mb-2">รูปสินค้า</p>
                <img
                  src={imageData}
                  alt="สินค้า"
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
              ยืนยันส่งคำขอ
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="bg-[#1E3A5F] text-white px-4 py-5 text-center shadow-md">
        <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
        <p className="text-sm mt-1 opacity-75">ขอสินค้าสำหรับไลฟ์</p>
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
              onChange={(e) => {
                setNickname(e.target.value)
                setErrors((prev) => ({ ...prev, nickname: '' }))
              }}
              placeholder="ชื่อเล่นของคุณ"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
            {errors.nickname && (
              <p className="text-[#DC2626] text-xs mt-1">{errors.nickname}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-2">
              รายละเอียดสินค้าที่ขอ <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setErrors((prev) => ({ ...prev, description: '' }))
              }}
              placeholder="เช่น เสื้อยืดสีขาว size M จำนวน 2 ตัว / ของที่อยากได้ / หมายเหตุ"
              rows={3}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
            />
            {errors.description && (
              <p className="text-[#DC2626] text-xs mt-1">{errors.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-2">
              รูปสินค้า <span className="text-[#DC2626]">*</span>
              <span className="text-xs font-normal text-gray-400 ml-1">(1 รูป)</span>
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
                  alt="สินค้า"
                  className="w-full max-h-56 object-cover rounded-xl border border-[#E2E8F0]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageData(null)
                    setImageFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
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
            {errors.image && (
              <p className="text-[#DC2626] text-xs mt-1">{errors.image}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmitClick}
          className="w-full bg-[#1E3A5F] text-white py-4 rounded-xl font-bold text-base shadow-md active:opacity-90"
        >
          ส่งคำขอสินค้า
        </button>

        <Link
          href="/status"
          className="block text-center text-sm text-[#1E3A5F] font-semibold hover:underline py-2"
        >
          เช็คสถานะคำขอของฉัน →
        </Link>
      </div>
    </div>
  )
}
