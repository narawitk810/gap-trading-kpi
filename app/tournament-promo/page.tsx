'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function TournamentPromoPage() {
  const router = useRouter()
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageData, setImageData] = useState<string | null>(null)
  const [stage, setStage] = useState<'form' | 'confirm' | 'submitting' | 'success'>('form')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const MAX = 800
          let w = img.width, h = img.height
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round((h * MAX) / w); w = MAX }
            else { w = Math.round((w * MAX) / h); h = MAX }
          }
          const canvas = document.createElement('canvas')
          canvas.width = w; canvas.height = h
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.7))
        }
        img.src = e.target!.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  async function handleFileChange(file: File | null) {
    if (!file) return
    const compressed = await compressImage(file)
    setImagePreview(compressed)
    // upload to Vercel Blob
    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: compressed }),
      })
      if (res.ok) {
        const data = await res.json()
        setImageData(data.url || compressed)
      } else {
        setImageData(compressed)
      }
    } catch {
      setImageData(compressed)
    }
  }

  async function handleSubmit() {
    if (!imageData) return
    setStage('submitting')
    try {
      const res = await fetch('/api/tournament-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: imageData }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.error || 'เกิดข้อผิดพลาด')
        setStage('confirm')
        return
      }
      setStage('success')
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองอีกครั้ง')
      setStage('confirm')
    }
  }

  function handleReset() {
    setImagePreview(null)
    setImageData(null)
    setStage('form')
  }

  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-6" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>
        <div className="bg-white rounded-2xl p-10 text-center max-w-sm w-full shadow-sm">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-[#16A34A] mb-2">ส่งสำเร็จ!</h2>
          <p className="text-sm text-gray-500 mb-6">ทีมงานได้รับแจ้งแล้ว</p>
          <div className="flex gap-3">
            <button onClick={handleReset} className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-semibold">
              ส่งอีกครั้ง
            </button>
            <button onClick={() => router.back()} className="flex-1 border border-[#E2E8F0] text-[#374151] py-2.5 rounded-xl text-sm font-semibold">
              กลับ
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/70 hover:text-white text-lg w-8">←</button>
          <div>
            <h1 className="text-base font-bold">แจ้งโปรโมงานแข่ง</h1>
            <p className="text-xs opacity-70 mt-0.5">ส่งรูปโปรโมชั่น/เอกสารงานแข่ง</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Image picker */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-[#374151] mb-3">แนบรูปโปรโมชั่น/เอกสาร <span className="text-[#DC2626]">*</span></p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
          {imagePreview ? (
            <div className="space-y-3">
              <img
                src={imagePreview}
                alt="ตัวอย่างรูป"
                className="w-full rounded-xl object-contain max-h-72 border border-[#E2E8F0]"
              />
              <button
                onClick={() => { setImagePreview(null); setImageData(null); fileInputRef.current?.click() }}
                className="w-full border border-[#E2E8F0] text-[#374151] py-2 rounded-xl text-sm font-semibold hover:bg-[#F5F6F8]"
              >
                เปลี่ยนรูป
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-12 flex flex-col items-center gap-2 hover:border-[#1E3A5F]/50 transition-colors"
            >
              <span className="text-4xl">📷</span>
              <p className="text-sm font-semibold text-[#374151]">ถ่ายรูปหรือเลือกจากคลัง</p>
              <p className="text-xs text-gray-400">แตะเพื่อเปิดกล้อง</p>
            </button>
          )}
        </div>

        {/* Submit */}
        {stage === 'form' && imagePreview && (
          <button
            onClick={() => setStage('confirm')}
            className="w-full bg-[#1E3A5F] text-white py-3.5 rounded-2xl text-base font-semibold shadow-sm"
          >
            ส่ง
          </button>
        )}
      </div>

      {/* Confirm modal */}
      {stage === 'confirm' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-base font-bold text-[#1E3A5F] text-center">ยืนยันการส่ง?</h3>
            <p className="text-sm text-gray-500 text-center">ระบบจะแจ้งเตือนไปยังกลุ่มงานแข่ง</p>
            {imagePreview && (
              <img src={imagePreview} alt="ตัวอย่าง" className="w-full rounded-xl object-contain max-h-48 border border-[#E2E8F0]" />
            )}
            <div className="flex gap-3">
              <button onClick={() => setStage('form')} className="flex-1 border border-[#E2E8F0] text-[#374151] py-2.5 rounded-xl text-sm font-semibold">
                ยกเลิก
              </button>
              <button onClick={handleSubmit} className="flex-1 bg-[#1E3A5F] text-white py-2.5 rounded-xl text-sm font-semibold">
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'submitting' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl px-8 py-6 text-center">
            <p className="text-sm font-semibold text-[#374151]">กำลังส่ง...</p>
          </div>
        </div>
      )}
    </div>
  )
}
