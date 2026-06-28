'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTMENTS } from '@/types/kpi'

const MAX_VIDEO_MB = 20

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

export default function ComplaintPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [department, setDepartment] = useState('')
  const [description, setDescription] = useState('')
  const [attachmentData, setAttachmentData] = useState<string | null>(null)
  const [attachmentType, setAttachmentType] = useState<'image' | 'video' | null>(null)
  const [fileName, setFileName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrors((p) => ({ ...p, file: '' }))
    if (file.type.startsWith('image/')) {
      try {
        const data = await compressImage(file)
        setAttachmentData(data); setAttachmentType('image'); setFileName(file.name)
      } catch { setErrors((p) => ({ ...p, file: 'โหลดรูปไม่ได้ กรุณาลองใหม่' })) }
    } else if (file.type.startsWith('video/')) {
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setErrors((p) => ({ ...p, file: `วีดีโอต้องไม่เกิน ${MAX_VIDEO_MB}MB` })); return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        setAttachmentData(e.target?.result as string)
        setAttachmentType('video'); setFileName(file.name)
      }
      reader.readAsDataURL(file)
    } else {
      setErrors((p) => ({ ...p, file: 'รองรับเฉพาะรูปภาพและวีดีโอเท่านั้น' }))
    }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!nickname.trim()) e.nickname = 'กรุณากรอกชื่อเล่น'
    if (!department) e.department = 'กรุณาเลือกแผนก'
    if (!description.trim()) e.description = 'กรุณาระบุรายละเอียด'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          department,
          description: description.trim(),
          attachment_data: attachmentData || '',
          attachment_type: attachmentType || '',
        }),
      })
      if (res.ok) { setDone(true) }
      else { const d = await res.json(); alert(d.error || 'เกิดข้อผิดพลาด') }
    } catch { alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ') }
    finally { setSubmitting(false) }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">📨</div>
          <h2 className="text-xl font-bold text-[#1E3A5F] mb-2">ส่งเรื่องสำเร็จ</h2>
          <p className="text-gray-500 text-sm mb-6">Admin จะรับทราบและดำเนินการ</p>
          <button onClick={() => router.push('/')}
            className="w-full bg-[#1E3A5F] text-white py-3 rounded-xl font-semibold text-sm">
            กลับหน้าหลัก
          </button>
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
            <h1 className="text-base font-bold">ร้องเรียนด้านการทำงานร่วมกัน</h1>
            <p className="text-xs opacity-60 mt-0.5">ข้อมูลจะถูกส่งตรงถึง Admin</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-10">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          {/* ชื่อเล่น */}
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

          {/* แผนก */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              แผนก <span className="text-[#DC2626]">*</span>
            </label>
            <select value={department}
              onChange={(e) => { setDepartment(e.target.value); setErrors((p) => ({ ...p, department: '' })) }}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]">
              <option value="">เลือกแผนก</option>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.department && <p className="text-[#DC2626] text-xs mt-1">{errors.department}</p>}
          </div>

          {/* รายละเอียด */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              รายละเอียด <span className="text-[#DC2626]">*</span>
            </label>
            <textarea value={description}
              onChange={(e) => { setDescription(e.target.value); setErrors((p) => ({ ...p, description: '' })) }}
              placeholder="อธิบายสิ่งที่เกิดขึ้น..."
              rows={4}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none" />
            {errors.description && <p className="text-[#DC2626] text-xs mt-1">{errors.description}</p>}
          </div>

          {/* แนบไฟล์ */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              แนบหลักฐาน
              <span className="text-xs font-normal text-gray-400 ml-1">(รูปหรือวีดีโอ ไม่บังคับ)</span>
            </label>
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />
            {attachmentData ? (
              <div className="space-y-2">
                {attachmentType === 'image' && (
                  <img src={attachmentData} alt="หลักฐาน" className="w-full max-h-48 object-cover rounded-xl border border-[#E2E8F0]" />
                )}
                {attachmentType === 'video' && (
                  <video src={attachmentData} controls className="w-full rounded-xl border border-[#E2E8F0]" />
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400 truncate">{fileName}</p>
                  <button type="button"
                    onClick={() => { setAttachmentData(null); setAttachmentType(null); setFileName(''); if (fileRef.current) fileRef.current.value = '' }}
                    className="text-[#DC2626] text-xs font-semibold hover:underline shrink-0 ml-2">
                    ลบ
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-6 flex flex-col items-center gap-1.5 hover:border-[#1E3A5F] transition-colors">
                <span className="text-2xl">📎</span>
                <span className="text-sm text-gray-400">แตะเพื่อแนบรูปหรือวีดีโอ</span>
                <span className="text-xs text-gray-300">วีดีโอสูงสุด {MAX_VIDEO_MB}MB</span>
              </button>
            )}
            {errors.file && <p className="text-[#DC2626] text-xs mt-1">{errors.file}</p>}
          </div>
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full bg-[#374151] text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60">
          {submitting ? 'กำลังส่ง...' : 'ส่งเรื่องร้องเรียน'}
        </button>
      </div>
    </div>
  )
}
