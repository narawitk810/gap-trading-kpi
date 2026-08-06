'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const NAV_ITEMS = [
  { label: 'หน้าหลัก', icon: '🏠', badge: 0, active: true, href: '/hr-system' },
  { label: 'เอกสาร HR', icon: '📁', badge: 0, active: false, href: '#' },
  { label: 'เอกสารพนักงาน', icon: '👤', badge: 0, active: false, href: '/hr-system/employee-documents' },
  { label: 'ศูนย์อบรม (Training)', icon: '🎓', badge: 0, active: false, href: '#' },
  { label: 'นโยบายและระเบียบ', icon: '🛡️', badge: 0, active: false, href: '#' },
  { label: 'แบบฟอร์ม', icon: '📝', badge: 0, active: false, href: '#' },
  { label: 'ประกาศข่าวสาร', icon: '📢', badge: 3, active: false, href: '#' },
  { label: 'รายงาน', icon: '📊', badge: 0, active: false, href: '#' },
  { label: 'การอนุมัติเอกสาร', icon: '✅', badge: 5, active: false, href: '#' },
  { label: 'ตั้งค่า', icon: '⚙️', badge: 0, active: false, href: '#' },
  { label: 'ผู้ใช้งานระบบ', icon: '👥', badge: 0, active: false, href: '#' },
  { label: 'Audit Log', icon: '🔍', badge: 0, active: false, href: '#' },
]

const RECENT_DOCS = [
  { icon: '📄', name: 'นโยบายการลาทุกประเภท.pdf', category: 'นโยบายและระเบียบ', version: '2.0', updated: '27/05/2025 09:15', by: 'กานต์พิชชา ใจดี', access: 'ทุกคน', accessColor: '#16A34A' },
  { icon: '📝', name: 'แบบฟอร์มขอเบิกล่วงเวลา.docx', category: 'แบบฟอร์ม', version: '1.1', updated: '26/05/2025 16:20', by: 'กานต์พิชชา ใจดี', access: 'HR', accessColor: '#1E3A5F' },
  { icon: '📊', name: 'ตารางเงินเดือนพนักงาน.xlsx', category: 'Payroll', version: '1.0', updated: '26/05/2025 14:10', by: 'อารีย์ วรรณดี', access: 'HR, Finance', accessColor: '#D97706' },
  { icon: '📄', name: 'คู่มือความปลอดภัยในการทำงาน.pdf', category: 'SOP', version: '3.0', updated: '25/05/2025 11:05', by: 'ณัฐวุฒิ ศรีสุข', access: 'ทุกคน', accessColor: '#16A34A' },
  { icon: '📊', name: 'การปฐมนิเทศพนักงานใหม่.pptx', category: 'การอบรม', version: '1.0', updated: '24/05/2025 10:30', by: 'กานต์พิชชา ใจดี', access: 'เฉพาะแผนก', accessColor: '#7C3AED' },
]

const TRAININGS = [
  { title: 'ความปลอดภัยในการทำงาน', type: 'อบรมภายในองค์กร', progress: 75, status: 'ทำแบบทดสอบแล้ว', color: '#1E3A5F' },
  { title: 'PDPA สำหรับพนักงาน', type: 'อบรมภายในองค์กร', progress: 50, status: 'กำลังเรียน', color: '#1E3A5F' },
  { title: 'จรรยาบรรณในการทำงาน', type: 'อบรมภายในองค์กร', progress: 100, status: 'ผ่านการอบรม', color: '#16A34A' },
  { title: 'การปฐมนิเทศพนักงานใหม่', type: 'อบรมภายในองค์กร', progress: 25, status: 'ยังไม่ได้เริ่ม', color: '#1E3A5F' },
]

const NOTIFICATIONS = [
  { icon: '🆕', title: 'อัปเดตเอกสารใหม่', desc: 'นโยบายการลาทุกประเภท (เวอร์ชัน 2.0)', time: 'วันนี้, 09:15', color: '#16A34A' },
  { icon: '⏰', title: 'เอกสารใกล้หมดอายุ', desc: 'คู่มือความปลอดภัยในการทำงาน หมดอายุวันที่ 15/06/2025', time: 'เมื่อวาน, 16:30', color: '#D97706' },
  { icon: '🎓', title: 'หลักสูตรอบรมใหม่', desc: 'การบริหารเวลาอย่างมีประสิทธิภาพ', time: '26/05/2025', color: '#7C3AED' },
  { icon: '📢', title: 'ประกาศบริษัท', desc: 'ปิดระบบในวันที่ 31/05/2025 เวลา 00:00–02:00', time: '25/05/2025', color: '#1E3A5F' },
]

const STATS = [
  { label: 'เอกสารที่ดาวน์โหลด', value: '1,215', change: '+12%', up: true },
  { label: 'เอกสารที่เข้าดู', value: '3,457', change: '+8%', up: true },
  { label: 'พนักงานที่รับทราบเอกสาร', value: '289', change: '+15%', up: true },
  { label: 'หลักสูตรที่อบรมแล้ว', value: '142', change: '+10%', up: true },
]

const QUICK_MENU = [
  { icon: '📤', label: 'อัปโหลดเอกสาร' },
  { icon: '📂', label: 'สร้างโฟลเดอร์' },
  { icon: '📝', label: 'สร้างแบบฟอร์ม' },
  { icon: '🎓', label: 'เพิ่มหลักสูตรอบรม' },
]

function formatThaiDate() {
  const now = new Date()
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543}`
}

function formatTime() {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
}

export default function HRSystemPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [time, setTime] = useState(formatTime())

  useEffect(() => {
    const t = setInterval(() => setTime(formatTime()), 60_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-30 w-60 bg-[#1E3A5F] text-white flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Sidebar header */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center text-lg shrink-0">📋</div>
            <div>
              <p className="text-sm font-bold leading-tight">ระบบจัดการเอกสาร HR</p>
              <p className="text-[10px] text-blue-200 leading-tight mt-0.5">HR Document Management</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
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
              {!item.active && (
                <svg className="w-3 h-3 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </Link>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="px-4 py-4 border-t border-white/10 text-[11px] text-blue-200 space-y-1">
          <p className="font-semibold text-white">ฝ่ายทรัพยากรบุคคล (HR)</p>
          <p>📞 02-123-4567 ต่อ 100</p>
          <p>✉️ hr@company.com</p>
          <p className="mt-2 text-blue-300">เวอร์ชัน 1.0.0</p>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top header */}
        <header className="bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F5F6F8] text-[#374151]"
          >
            ☰
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <input
              type="text"
              placeholder="ค้นหาเอกสาร, พนักงาน, เนื้อหา..."
              className="w-full pl-9 pr-20 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-[#F5F6F8] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] text-[#374151]"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
            </svg>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">Ctrl + K</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Bell */}
            <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F6F8] text-[#374151]">
              🔔
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#DC2626] text-white text-[9px] font-bold rounded-full flex items-center justify-center">3</span>
            </button>
            {/* Help */}
            <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F5F6F8] text-[#374151] text-lg">❓</button>
            {/* User */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#E2E8F0]">
              <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center text-white text-sm font-bold">ก</div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-[#374151]">น.ส. กานต์พิชชา ใจดี</p>
                <p className="text-[10px] text-gray-400">เจ้าหน้าที่ HR</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex flex-1 min-w-0">
          <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

            {/* Breadcrumb + date */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold text-[#1E3A5F]">หน้าหลัก</h1>
                <p className="text-xs text-gray-400 mt-0.5">หน้าหลัก &gt; Dashboard</p>
              </div>
              <div className="flex items-center gap-3 text-sm text-[#374151]">
                <span className="flex items-center gap-1.5"><span>📅</span>{formatThaiDate()}</span>
                <span className="flex items-center gap-1.5"><span>🕐</span>{time}</span>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { icon: '📋', label: 'เอกสารทั้งหมด', value: '1,248', unit: 'รายการ', color: '#1E3A5F', bg: '#EFF6FF' },
                { icon: '🆕', label: 'เอกสารใหม่', value: '24', unit: 'รายการ', color: '#16A34A', bg: '#F0FDF4' },
                { icon: '⏰', label: 'เอกสารใกล้หมดอายุ', value: '12', unit: 'รายการ', color: '#D97706', bg: '#FFFBEB' },
                { icon: '👥', label: 'พนักงานทั้งหมด', value: '356', unit: 'คน', color: '#7C3AED', bg: '#F5F3FF' },
                { icon: '🎓', label: 'อบรมที่ต้องทำ', value: '18', unit: 'หลักสูตร', color: '#0369A1', bg: '#F0F9FF' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: s.bg }}>
                      {s.icon}
                    </div>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.unit}</p>
                  <p className="text-xs font-semibold text-[#374151] mt-1">{s.label}</p>
                  <a href="#" className="text-[11px] mt-2 inline-flex items-center gap-1" style={{ color: s.color }}>
                    ดูทั้งหมด <span>→</span>
                  </a>
                </div>
              ))}
            </div>

            {/* Recent documents */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
                <p className="font-bold text-[#374151]">เอกสารล่าสุด</p>
                <a href="#" className="text-xs font-semibold text-[#1E3A5F]">ดูทั้งหมด →</a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold">
                      <th className="text-left px-4 py-3">ชื่อเอกสาร</th>
                      <th className="text-left px-4 py-3">หมวดหมู่</th>
                      <th className="text-left px-4 py-3">เวอร์ชัน</th>
                      <th className="text-left px-4 py-3">แก้ไขล่าสุด</th>
                      <th className="text-left px-4 py-3">โดย</th>
                      <th className="text-left px-4 py-3">การเข้าถึง</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_DOCS.map((doc, i) => (
                      <tr key={i} className="border-t border-[#E2E8F0] hover:bg-[#F5F6F8] transition-colors">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span className="text-base">{doc.icon}</span>
                            <span className="font-medium text-[#374151] text-xs">{doc.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{doc.category}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{doc.version}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{doc.updated}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{doc.by}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: doc.accessColor, background: doc.accessColor + '18' }}>
                            {doc.access}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-gray-400 hover:text-[#374151]">⋮</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Training progress */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-[#374151]">ความคืบหน้าการอบรม</p>
                <a href="#" className="text-xs font-semibold text-[#1E3A5F]">ดูทั้งหมด →</a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {TRAININGS.map((t, i) => (
                  <div key={i} className="border border-[#E2E8F0] rounded-xl p-3 hover:shadow-sm transition-shadow">
                    <div className="w-full h-20 bg-[#F5F6F8] rounded-lg mb-3 flex items-center justify-center text-3xl">
                      {['🦺', '🔒', '📖', '🎓'][i]}
                    </div>
                    <p className="text-xs font-bold text-[#374151] leading-tight">{t.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t.type}</p>
                    <div className="mt-2 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${t.progress}%`, background: t.progress === 100 ? '#16A34A' : '#1E3A5F' }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-gray-400">{t.progress}%</span>
                      <span className={`text-[10px] font-semibold ${t.progress === 100 ? 'text-[#16A34A]' : 'text-[#374151]'}`}>{t.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </main>

          {/* Right panel */}
          <aside className="hidden xl:block w-72 border-l border-[#E2E8F0] bg-white overflow-y-auto p-4 space-y-5">

            {/* Notifications */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#374151]">🔔 การแจ้งเตือน</p>
                <a href="#" className="text-xs text-[#1E3A5F] font-semibold">ดูทั้งหมด →</a>
              </div>
              <div className="space-y-3">
                {NOTIFICATIONS.map((n, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: n.color + '18' }}>
                      {n.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[#374151]">{n.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{n.desc}</p>
                      <p className="text-[10px] text-gray-300 mt-1">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage stats */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#374151]">📊 สถิติการใช้งาน</p>
                <a href="#" className="text-xs text-[#1E3A5F] font-semibold">ดูรายงาน →</a>
              </div>
              <div className="space-y-2.5">
                {STATS.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{s.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#374151]">{s.value}</span>
                      <span className="text-[10px] font-semibold text-[#16A34A]">↑ {s.change}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick menu */}
            <div>
              <p className="text-sm font-bold text-[#374151] mb-3">⚡ เมนูด่วน</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_MENU.map((m, i) => (
                  <button key={i} className="flex flex-col items-center gap-1.5 p-3 border border-[#E2E8F0] rounded-xl hover:border-[#1E3A5F] hover:bg-[#1E3A5F]/5 transition-colors">
                    <span className="text-xl">{m.icon}</span>
                    <span className="text-[11px] text-[#374151] font-semibold text-center leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </aside>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-[#E2E8F0] px-6 py-3 flex items-center justify-between text-[11px] text-gray-400">
          <span>© 2025 Company Name Co., Ltd. All rights reserved.</span>
          <span>Version 1.0.0</span>
        </footer>
      </div>
    </div>
  )
}
