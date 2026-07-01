'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

const MAX_VIDEO_MB = 20
const MAX_FILES = 10

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

type EvidenceFile = { name: string; type: 'image' | 'video'; data: string }

type EvidenceRow = {
  id: string
  employee_name: string
  incident: string
  incident_date: string
  time_start: string
  time_end: string
  evidence_data: string
  created_by: string
  created_dept: string
  created_at: string
}

type FormErrors = { [key: string]: string }

function formatThaiDateTime(iso: string) {
  const d = new Date(iso)
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} น.`
}

export default function EvidencePage() {
  const [employeeName, setEmployeeName] = useState('')
  const [incident, setIncident] = useState('')
  const [incidentDate, setIncidentDate] = useState('')
  const [timeStart, setTimeStart] = useState('')
  const [timeEnd, setTimeEnd] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [createdDept, setCreatedDept] = useState('')
  const [files, setFiles] = useState<EvidenceFile[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [rows, setRows] = useState<EvidenceRow[]>([])
  const [loadingRows, setLoadingRows] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchRows = useCallback(async () => {
    setLoadingRows(true)
    try {
      const res = await fetch('/api/evidence')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } finally {
      setLoadingRows(false)
    }
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  useEffect(() => {
    const now = new Date()
    setIncidentDate(now.toLocaleDateString('sv-SE'))
    const hhmm = now.toTimeString().slice(0, 5)
    setTimeStart(hhmm)
    setTimeEnd(hhmm)
  }, [])

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return
    const remaining = MAX_FILES - files.length
    if (remaining <= 0) {
      setErrors((p: FormErrors) => ({ ...p, files: `แนบหลักฐานได้สูงสุด ${MAX_FILES} รายการ` }))
      return
    }
    const toProcess = selected.slice(0, remaining)
    const newFiles: EvidenceFile[] = []
    for (const file of toProcess) {
      if (file.type.startsWith('image/')) {
        try {
          const data = await compressImage(file)
          newFiles.push({ name: file.name, type: 'image', data })
        } catch {
          setErrors((p: FormErrors) => ({ ...p, files: `โหลดรูป ${file.name} ไม่ได้` }))
        }
      } else if (file.type.startsWith('video/')) {
        if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
          setErrors((p: FormErrors) => ({ ...p, files: `วีดีโอ ${file.name} ต้องไม่เกิน ${MAX_VIDEO_MB}MB` }))
          continue
        }
        const data = await new Promise<string>((res, rej) => {
          const reader = new FileReader()
          reader.onload = (ev) => res(ev.target?.result as string)
          reader.onerror = rej
          reader.readAsDataURL(file)
        })
        newFiles.push({ name: file.name, type: 'video', data })
      } else {
        setErrors((p: FormErrors) => ({ ...p, files: 'รองรับเฉพาะรูปภาพและวีดีโอเท่านั้น' }))
      }
    }
    setFiles((prev) => [...prev, ...newFiles])
    setErrors((p: FormErrors) => ({ ...p, files: '' }))
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  function validate() {
    const e: FormErrors = {}
    if (!employeeName.trim()) e.employeeName = 'กรุณากรอกชื่อพนักงาน'
    if (!incident.trim()) e.incident = 'กรุณาระบุเหตุการณ์'
    if (!createdBy.trim()) e.createdBy = 'กรุณากรอกชื่อผู้บันทึก'
    if (!createdDept) e.createdDept = 'กรุณาเลือกแผนก'
    if (files.length === 0) e.files = 'กรุณาแนบหลักฐานอย่างน้อย 1 รายการ'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_name: employeeName.trim(),
          incident: incident.trim(),
          incident_date: incidentDate,
          time_start: timeStart,
          time_end: timeEnd,
          created_by: createdBy.trim(),
          created_dept: createdDept,
          evidence_data: files,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setEmployeeName('')
        setIncident('')
        const now2 = new Date()
        setIncidentDate(now2.toLocaleDateString('sv-SE'))
        const hhmm2 = now2.toTimeString().slice(0, 5)
        setTimeStart(hhmm2)
        setTimeEnd(hhmm2)
        setCreatedBy('')
        setCreatedDept('')
        setFiles([])
        setShowConfirm(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 4000)
        fetchRows()
      } else {
        alert(data.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        setShowConfirm(false)
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาตรวจสอบการเชื่อมต่อ')
      setShowConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  async function downloadAll(row: EvidenceRow) {
    setDownloading(row.id)
    try {
      const evidenceFiles: EvidenceFile[] = JSON.parse(row.evidence_data)
      for (let i = 0; i < evidenceFiles.length; i++) {
        const f = evidenceFiles[i]
        const ext = f.type === 'video' ? (f.name.split('.').pop() || 'mp4') : 'jpg'
        const safeName = `${row.employee_name}_${i + 1}.${ext}`
        const a = document.createElement('a')
        a.href = f.data
        a.download = safeName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        await new Promise((r) => setTimeout(r, 300))
      }
    } catch {
      alert('ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 text-center shadow-md relative">
        <Link href="/" className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
        <p className="text-sm mt-1 opacity-75">หลักฐานรอลงทัณฑ์</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-12">
        {/* Success banner */}
        {success && (
          <div className="bg-[#16A34A] text-white rounded-2xl px-4 py-3 text-sm font-semibold text-center shadow">
            ✅ บันทึกหลักฐานสำเร็จ
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-[#1E3A5F]">บันทึกหลักฐานใหม่</h2>

          {/* ชื่อพนักงาน */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              ชื่อพนักงานที่ถูกดำเนินการ <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={employeeName}
              onChange={(e) => { setEmployeeName(e.target.value); setErrors((p: FormErrors) => ({ ...p, employeeName: '' })) }}
              placeholder="ชื่อ-นามสกุล หรือชื่อเล่น"
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
            {errors.employeeName && <p className="text-[#DC2626] text-xs mt-1">{errors.employeeName}</p>}
          </div>

          {/* เหตุการณ์ */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              เหตุการณ์ / รายละเอียด <span className="text-[#DC2626]">*</span>
            </label>
            <textarea
              value={incident}
              onChange={(e) => { setIncident(e.target.value); setErrors((p: FormErrors) => ({ ...p, incident: '' })) }}
              placeholder="ระบุเหตุการณ์ที่เกิดขึ้น วัน-เวลา และรายละเอียดที่เกี่ยวข้อง"
              rows={4}
              className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
            />
            {errors.incident && <p className="text-[#DC2626] text-xs mt-1">{errors.incident}</p>}
          </div>

          {/* วันที่ / เวลา */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-1.5">วันที่เกิดเหตุ</label>
              <input
                type="date"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-2.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-1.5">เวลาเริ่ม</label>
              <input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-2.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-1.5">เวลาสิ้นสุด</label>
              <input
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-2.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
          </div>

          {/* หลักฐาน */}
          <div>
            <label className="block text-sm font-semibold text-[#374151] mb-1.5">
              หลักฐาน (รูปภาพ / วีดีโอ) <span className="text-[#DC2626]">*</span>
              <span className="text-xs font-normal text-gray-400 ml-1">สูงสุด {MAX_FILES} ไฟล์ · วีดีโอไม่เกิน {MAX_VIDEO_MB}MB</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleFiles}
              className="hidden"
            />

            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {files.map((f, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#F5F6F8] aspect-square flex items-center justify-center">
                    {f.type === 'image' ? (
                      <img src={f.data} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 p-2">
                        <span className="text-2xl">🎬</span>
                        <span className="text-[10px] text-gray-500 text-center leading-tight truncate w-full px-1">{f.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-[#DC2626] text-white rounded-full text-xs font-bold flex items-center justify-center shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-[#E2E8F0] rounded-xl aspect-square flex flex-col items-center justify-center gap-1 hover:border-[#1E3A5F] transition-colors"
                  >
                    <span className="text-xl text-gray-300">+</span>
                    <span className="text-[10px] text-gray-400">เพิ่ม</span>
                  </button>
                )}
              </div>
            )}

            {files.length === 0 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-[#E2E8F0] rounded-xl py-8 flex flex-col items-center gap-2 hover:border-[#1E3A5F] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-gray-400">แตะเพื่อเลือกรูปหรือวีดีโอ</span>
                <span className="text-xs text-gray-300">{files.length}/{MAX_FILES} ไฟล์</span>
              </button>
            )}
            {files.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{files.length}/{MAX_FILES} ไฟล์</p>
            )}
            {errors.files && <p className="text-[#DC2626] text-xs mt-1">{errors.files}</p>}
          </div>

          {/* ผู้บันทึก */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                ชื่อผู้บันทึก <span className="text-[#DC2626]">*</span>
              </label>
              <input
                type="text"
                value={createdBy}
                onChange={(e) => { setCreatedBy(e.target.value); setErrors((p: FormErrors) => ({ ...p, createdBy: '' })) }}
                placeholder="ชื่อเล่น"
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
              {errors.createdBy && <p className="text-[#DC2626] text-xs mt-1">{errors.createdBy}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#374151] mb-1.5">
                แผนก <span className="text-[#DC2626]">*</span>
              </label>
              <select
                value={createdDept}
                onChange={(e) => { setCreatedDept(e.target.value); setErrors((p: FormErrors) => ({ ...p, createdDept: '' })) }}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white"
              >
                <option value="">เลือก</option>
                <option value="บุคคล">บุคคล (HR)</option>
                <option value="ผู้จัดการไลฟ์สด">ผู้จัดการไลฟ์สด</option>
              </select>
              {errors.createdDept && <p className="text-[#DC2626] text-xs mt-1">{errors.createdDept}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={() => { if (validate()) setShowConfirm(true) }}
            className="w-full bg-[#DC2626] text-white py-4 rounded-xl font-bold text-base shadow-md active:opacity-90"
          >
            บันทึกหลักฐาน
          </button>
        </div>

        {/* Records list */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h2 className="text-base font-bold text-[#1E3A5F]">หลักฐานที่บันทึกแล้ว</h2>
            <button onClick={fetchRows} className="text-xs text-[#1E3A5F] font-semibold hover:underline">รีเฟรช</button>
          </div>
          {loadingRows ? (
            <div className="py-10 text-center text-gray-400 text-sm">กำลังโหลด...</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">ยังไม่มีหลักฐาน</div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {rows.map((r) => {
                let evidenceFiles: EvidenceFile[] = []
                try { evidenceFiles = JSON.parse(r.evidence_data) } catch { /* */ }
                const imgCount = evidenceFiles.filter((f) => f.type === 'image').length
                const vidCount = evidenceFiles.filter((f) => f.type === 'video').length

                return (
                  <div key={r.id} className="px-5 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#374151] text-sm">{r.employee_name}</p>
                        {r.incident_date && (
                          <p className="text-xs text-[#1E3A5F] font-semibold mt-0.5">
                            {r.incident_date}{r.time_start ? ` · ${r.time_start}${r.time_end && r.time_end !== r.time_start ? `–${r.time_end}` : ''}` : ''}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{r.incident}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-gray-400">{r.created_dept}</p>
                        <p className="text-[10px] text-gray-400">โดย {r.created_by}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{formatThaiDateTime(r.created_at)}</span>
                        <span>·</span>
                        {imgCount > 0 && <span>🖼 {imgCount} รูป</span>}
                        {vidCount > 0 && <span>🎬 {vidCount} วีดีโอ</span>}
                      </div>
                      <button
                        onClick={() => downloadAll(r)}
                        disabled={downloading === r.id}
                        className="flex items-center gap-1.5 bg-[#1E3A5F] text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 active:opacity-80"
                      >
                        {downloading === r.id ? (
                          <span>กำลังดาวน์โหลด...</span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            ดาวน์โหลดหลักฐาน
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="bg-[#DC2626] text-white px-5 py-4">
              <h3 className="font-bold text-lg">ยืนยันการบันทึกหลักฐาน</h3>
              <p className="text-sm opacity-80 mt-0.5">ตรวจสอบข้อมูลก่อนบันทึก</p>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">ชื่อพนักงาน</p>
                <p className="font-semibold text-[#374151]">{employeeName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">วันที่/เวลาเกิดเหตุ</p>
                <p className="font-semibold text-[#374151]">{incidentDate} · {timeStart}{timeEnd && timeEnd !== timeStart ? `–${timeEnd}` : ''}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">เหตุการณ์</p>
                <p className="text-[#374151] line-clamp-3">{incident}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">หลักฐาน</p>
                <p className="font-semibold text-[#374151]">{files.length} ไฟล์ ({files.filter((f) => f.type === 'image').length} รูป, {files.filter((f) => f.type === 'video').length} วีดีโอ)</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">บันทึกโดย</p>
                <p className="font-semibold text-[#374151]">{createdBy} · {createdDept}</p>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
                className="flex-1 border border-[#E2E8F0] text-[#374151] py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
              >
                แก้ไข
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 bg-[#DC2626] text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
              >
                {submitting ? 'กำลังบันทึก...' : 'ยืนยันบันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
