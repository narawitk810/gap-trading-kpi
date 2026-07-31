'use client'

import { useState, useMemo } from 'react'

const today = new Date().toLocaleDateString('sv-SE')

const LEAVE_TYPES = [
  { key: 'paid_personal', icon: '💼', label: 'ลากิจ', sub2: 'รับค่าจ้าง', desc: 'มีหลักฐานประกอบการลา', color: '#1E3A5F' },
  { key: 'emergency', icon: '⚠️', label: 'ลากิจ', sub2: 'ไม่รับค่าจ้าง (ลาฉุกเฉิน)', desc: 'พร้อมยืนดีดชดเชยค่าปรับ', color: '#D97706' },
  { key: 'paid_sick', icon: '🏥', label: 'ลาป่วย', sub2: 'รับค่าจ้าง', desc: 'มีใบรับรองแพทย์', color: '#16A34A' },
  { key: 'unpaid_sick', icon: '🛏️', label: 'ลาป่วย', sub2: 'ไม่รับค่าจ้าง', desc: 'ไม่มีใบรับรองแพทย์', color: '#7C3AED' },
  { key: 'vacation', icon: '🏖️', label: 'ลาพักร้อน', sub2: '', desc: 'ใช้สิทธิ์หยุดพร้อมเหตุผล', color: '#0369A1' },
]

const LEAVE_BALANCE = [
  { icon: '🏖️', label: 'ลาพักร้อนคงเหลือ', value: '15.5', color: '#0369A1' },
  { icon: '💼', label: 'ลากิจคงเหลือ', value: '10', color: '#D97706' },
  { icon: '🏥', label: 'ลาป่วยคงเหลือ', value: '30', color: '#16A34A' },
  { icon: '🤱', label: 'ลาคลอดคงเหลือ', value: '90', color: '#7C3AED' },
]

const NAV_ITEMS = [
  { label: 'หน้าหลัก', icon: '🏠', badge: 0, active: false },
  { label: 'ขอแจ้งลา', icon: '📅', badge: 0, active: true },
  { label: 'รายการลาของฉัน', icon: '📋', badge: 0, active: false },
  { label: 'ปฏิทินการลา', icon: '🗓️', badge: 0, active: false },
  { label: 'รายการรออนุมัติ', icon: '✅', badge: 5, active: false },
  { label: 'ประวัติการลา', icon: '📜', badge: 0, active: false },
  { label: 'รายงาน', icon: '📊', badge: 0, active: false },
  { label: 'ตั้งค่า', icon: '⚙️', badge: 0, active: false },
]

function calcDays(start: string, end: string) {
  if (!start || !end) return 1
  const s = new Date(start), e = new Date(end)
  const diff = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1
  return Math.max(1, diff)
}

export default function LeavePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [leaveType, setLeaveType] = useState('paid_personal')
  const [requestType, setRequestType] = useState<'advance' | 'emergency'>('advance')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [reason, setReason] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const days = useMemo(() => calcDays(startDate, endDate), [startDate, endDate])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-6" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>
        <div className="bg-white rounded-2xl p-10 text-center max-w-sm w-full shadow-sm border border-[#E2E8F0]">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-[#16A34A] mb-2">ส่งคำขอสำเร็จ</h2>
          <p className="text-sm text-gray-500 mb-6">คำขอลาของคุณถูกส่งไปยัง HR แล้ว กรุณารอการอนุมัติ</p>
          <button onClick={() => setSubmitted(false)} className="bg-[#1E3A5F] text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
            ยื่นคำขอใหม่
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-56 bg-[#1E3A5F] text-white flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center text-lg shrink-0">📅</div>
            <div>
              <p className="text-sm font-bold leading-tight">ระบบขอแจ้งลา</p>
              <p className="text-[10px] text-blue-200 leading-tight mt-0.5">Leave Management</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <a key={item.label} href="#"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                item.active ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10'
              }`}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge > 0 && (
                <span className="bg-[#DC2626] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 text-[11px] text-blue-200 space-y-1">
          <p className="font-semibold text-white text-xs">ต้องการความช่วยเหลือ?</p>
          <p>ติดต่อ HR</p>
          <p>📞 02-123-4567 ต่อ 100</p>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F5F6F8] text-[#374151]">☰</button>
          <div className="ml-auto flex items-center gap-2">
            <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F6F8]">
              🔔
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#DC2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center">3</span>
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0]">
              <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center text-white text-sm font-bold">ก</div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-[#374151]">น.ส. กานต์พิชชา ใจดี</p>
                <p className="text-[10px] text-gray-400">พนักงาน</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex flex-1 min-w-0">
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mb-5">
              <h1 className="text-xl font-bold text-[#1E3A5F]">ขอแจ้งลา</h1>
              <p className="text-xs text-gray-400 mt-0.5">หน้าหลัก &gt; ขอแจ้งลา</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Section 1 */}
              <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
                <p className="text-sm font-bold text-[#374151] mb-4">1. เลือกประเภทการลา</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {LEAVE_TYPES.map((lt) => {
                    const isActive = leaveType === lt.key
                    return (
                      <button
                        key={lt.key}
                        type="button"
                        onClick={() => setLeaveType(lt.key)}
                        className={`flex flex-col items-center text-center p-3 rounded-xl border-2 transition-all ${
                          isActive ? 'border-[#1E3A5F] bg-[#1E3A5F]/5' : 'border-[#E2E8F0] bg-white hover:border-[#1E3A5F]/40'
                        }`}
                      >
                        <span className="text-2xl mb-2">{lt.icon}</span>
                        <p className="text-xs font-bold text-[#374151] leading-tight">{lt.label}</p>
                        {lt.sub2 && <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{lt.sub2}</p>}
                        <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">{lt.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Section 2 */}
              <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0]">
                <p className="text-sm font-bold text-[#374151] mb-4">2. ประเภทการยื่นคำขอ</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  {[
                    { val: 'advance' as const, label: 'ลาล่วงหน้า', desc: 'ยื่นคำขอล่วงหน้าก่อนวันลา' },
                    { val: 'emergency' as const, label: 'ลาฉุกเฉิน', desc: 'ยื่นคำขอในกรณีเร่งด่วน' },
                  ].map((opt) => (
                    <label key={opt.val}
                      className={`flex items-center gap-3 flex-1 border-2 rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                        requestType === opt.val ? 'border-[#1E3A5F] bg-[#1E3A5F]/5' : 'border-[#E2E8F0]'
                      }`}
                    >
                      <input type="radio" className="accent-[#1E3A5F]" checked={requestType === opt.val} onChange={() => setRequestType(opt.val)} />
                      <div>
                        <p className="text-sm font-bold text-[#374151]">{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 3 */}
              <div className="bg-white rounded-2xl p-5 border border-[#E2E8F0] space-y-4">
                <p className="text-sm font-bold text-[#374151]">3. รายละเอียดการลา</p>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">วันที่ลาเริ่มต้น <span className="text-[#DC2626]">*</span></label>
                    <input
                      type="date" required value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value) }}
                      className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">วันที่ลาสิ้นสุด <span className="text-[#DC2626]">*</span></label>
                    <input
                      type="date" required value={endDate} min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#374151] mb-1.5">จำนวนวันลา</label>
                    <div className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-[#F5F6F8] flex items-center gap-2">
                      <span className="font-bold text-[#1E3A5F] text-base">{days}</span>
                      <span className="text-gray-400">วัน</span>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5">เหตุผลการลา <span className="text-[#DC2626]">*</span></label>
                  <textarea
                    required value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="กรอกเหตุผลการลา"
                    rows={3}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] resize-none"
                  />
                </div>

                {/* File upload */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1.5">แนบเอกสาร/หลักฐาน</label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false) }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                      dragOver ? 'border-[#1E3A5F] bg-[#1E3A5F]/5' : 'border-[#E2E8F0] hover:border-[#1E3A5F]/50'
                    }`}
                  >
                    <span className="text-xl">☁️</span>
                    <p className="text-sm text-[#374151] font-semibold mt-1">คลิกหรือลากไฟล์มาวางที่นี่</p>
                    <p className="text-xs text-gray-400 mt-0.5">รองรับไฟล์ .pdf, .jpg, .jpeg, .png ขนาดไม่เกิน 10 MB</p>
                  </div>
                  <p className="text-xs text-[#DC2626] mt-1.5">* เงื่อนไขการแนบเอกสาร: ประเภทการลาที่ต้องแนบหลักฐานจะขึ้นอยู่กับประเภทการลาที่เลือก</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setReason(''); setStartDate(today); setEndDate(today); setLeaveType('paid_personal') }}
                    className="flex-1 sm:flex-none sm:px-8 py-2.5 border border-[#E2E8F0] rounded-xl text-sm font-semibold text-[#374151] hover:bg-[#F5F6F8] transition-colors">
                    ยกเลิก
                  </button>
                  <button type="submit"
                    className="flex-1 sm:flex-none sm:px-8 py-2.5 bg-[#1E3A5F] text-white rounded-xl text-sm font-semibold hover:bg-[#1E3A5F]/90 transition-colors flex items-center justify-center gap-2">
                    <span>📤</span> บันทึกและส่งคำขอ
                  </button>
                </div>
              </div>
            </form>
          </main>

          {/* Right panel */}
          <aside className="hidden lg:block w-72 border-l border-[#E2E8F0] bg-white overflow-y-auto p-4 space-y-5">

            {/* Leave balance */}
            <div>
              <p className="text-sm font-bold text-[#374151] mb-3">📊 ข้อมูลสิทธิ์การลา</p>
              <div className="space-y-2.5">
                {LEAVE_BALANCE.map((b) => (
                  <div key={b.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>{b.icon}</span> {b.label}
                    </span>
                    <span className="text-sm font-bold" style={{ color: b.color }}>{b.value} <span className="text-xs font-normal text-gray-400">วัน</span></span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-3">ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            {/* Conditions */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-bold text-[#1E3A5F] mb-2">ℹ️ เงื่อนไขการลา</p>
              <ul className="text-[11px] text-[#1E3A5F] space-y-1.5 list-disc list-inside">
                <li>ลาล่วงหน้า: ยื่นคำขอก่อนวันลาอย่างน้อย 1 วันทำการ</li>
                <li>ลาฉุกเฉิน: ยื่นคำขอภายใน 3 วันทำการนับจากวันที่ลา</li>
                <li>การลาเกิน 3 วันทำการ ต้องแนบเอกสารประกอบ</li>
                <li>การลาพักร้อนต้องได้รับอนุมัติจากหัวหน้าก่อน</li>
              </ul>
            </div>

            {/* Warning */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs font-bold text-[#DC2626] mb-2">⚠️ หมายเหตุ</p>
              <p className="text-[11px] text-[#DC2626] leading-relaxed">
                กรณีลาฉุกเฉินไม่รับค่าจ้าง<br />
                ท่านต้องยืนยันดีดชดเชยค่าปรับ<br />
                ตามระเบียบของบริษัท
              </p>
            </div>

          </aside>
        </div>

        <footer className="bg-white border-t border-[#E2E8F0] px-6 py-3 flex items-center justify-between text-[11px] text-gray-400">
          <span>© 2025 Company Name Co., Ltd. All rights reserved.</span>
          <span>Version 1.0.0</span>
        </footer>
      </div>
    </div>
  )
}
