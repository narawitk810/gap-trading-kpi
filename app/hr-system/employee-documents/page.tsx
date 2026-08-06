'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Employee = {
  id: string
  name: string
  rank_name: string
  rank_emoji: string
  department: string
  start_date: string | null
  days_worked: number | null
  days_until_180: number | null
}

function formatThaiDate(iso: string) {
  const d = new Date(iso)
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`
}

function getCountdownColor(days_until_180: number | null) {
  if (days_until_180 === null) return '#374151'
  if (days_until_180 <= 0) return '#16A34A'
  if (days_until_180 <= 30) return '#DC2626'
  return '#1E3A5F'
}

function getCountdownText(days_worked: number | null, days_until_180: number | null) {
  if (days_until_180 === null) return 'ยังไม่ได้ตั้งค่าวันเริ่มงาน'
  if (days_until_180 <= 0) return '🔔 ถึงเวลาประเมิน & ปรับเงินเดือน'
  if (days_until_180 <= 30) return `⚠️ เหลืออีก ${days_until_180} วัน`
  return `เหลืออีก ${days_until_180} วัน`
}

function getProgressPercent(days_worked: number | null) {
  if (days_worked === null) return 0
  return Math.min(100, Math.round((days_worked / 180) * 100))
}

export default function EmployeeDocumentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [deptFilter, setDeptFilter] = useState('ทั้งหมด')
  const [editTarget, setEditTarget] = useState<Employee | null>(null)
  const [inputDate, setInputDate] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/hr/employee-documents')
    const data = await res.json()
    setEmployees(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchEmployees() }, [fetchEmployees])

  const departments = ['ทั้งหมด', ...Array.from(new Set(employees.map((e) => e.department)))]
  const filtered = deptFilter === 'ทั้งหมด' ? employees : employees.filter((e) => e.department === deptFilter)

  function openEdit(emp: Employee) {
    setEditTarget(emp)
    setInputDate(emp.start_date ?? '')
    setConfirmOpen(false)
  }

  async function handleSave() {
    if (!editTarget || !inputDate) return
    setSaving(true)
    await fetch('/api/hr/employee-documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editTarget.id, start_date: inputDate }),
    })
    setSaving(false)
    setEditTarget(null)
    setConfirmOpen(false)
    fetchEmployees()
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif" }}>

      {/* Header */}
      <header className="bg-[#1E3A5F] text-white px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/hr-system" className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white text-lg">
          ←
        </Link>
        <div>
          <h1 className="text-base font-bold leading-tight">เอกสารพนักงาน</h1>
          <p className="text-[11px] text-blue-200">ติดตามวันเริ่มงาน &amp; กำหนดปรับเงินเดือน</p>
        </div>
        <div className="ml-auto text-[11px] text-blue-200">{employees.length} คน</div>
      </header>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* Dept filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setDeptFilter(dept)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                deptFilter === dept
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                  : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'ทั้งหมด', value: employees.length, color: '#1E3A5F' },
            { label: 'ถึงเวลาปรับเงินเดือน', value: employees.filter(e => (e.days_until_180 ?? 1) <= 0).length, color: '#16A34A' },
            { label: 'ใกล้ครบ (≤30 วัน)', value: employees.filter(e => e.days_until_180 !== null && e.days_until_180 > 0 && e.days_until_180 <= 30).length, color: '#DC2626' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-3 border border-[#E2E8F0] text-center">
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[11px] text-[#374151] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Employee list */}
        {loading ? (
          <div className="text-center py-12 text-[#374151]">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#374151]">ไม่พบพนักงาน</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((emp) => {
              const color = getCountdownColor(emp.days_until_180)
              const progress = getProgressPercent(emp.days_worked)
              return (
                <div key={emp.id} className="bg-white rounded-xl border border-[#E2E8F0] p-4 space-y-3">
                  {/* Row 1: Name + badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#1E3A5F] text-base">
                        {emp.rank_emoji} {emp.name}
                      </p>
                      <p className="text-xs text-[#374151] mt-0.5">{emp.rank_name} · {emp.department}</p>
                    </div>
                    {emp.days_until_180 !== null && emp.days_until_180 <= 0 && (
                      <span className="shrink-0 text-[11px] font-semibold text-[#16A34A] bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        ถึงเวลาประเมิน &amp; ปรับเงินเดือน
                      </span>
                    )}
                  </div>

                  {/* Row 2: Start date + days worked */}
                  <div className="flex gap-4 text-sm">
                    <div>
                      <p className="text-[11px] text-gray-400">วันเริ่มงาน</p>
                      <p className="font-medium text-[#374151]">
                        {emp.start_date ? formatThaiDate(emp.start_date) : <span className="text-gray-400 italic">ยังไม่ได้ตั้งค่า</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400">ทำงานมาแล้ว</p>
                      <p className="font-medium text-[#374151]">
                        {emp.days_worked !== null ? `${emp.days_worked} วัน` : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Progress bar */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[11px] text-gray-400">นับถอยหลังปรับเงินเดือน (180 วัน)</p>
                      <p className="text-[11px] font-semibold" style={{ color }}>
                        {getCountdownText(emp.days_worked, emp.days_until_180)}
                      </p>
                    </div>
                    <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, backgroundColor: color }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 text-right">{progress}%</p>
                  </div>

                  {/* Row 4: Edit button */}
                  <button
                    onClick={() => openEdit(emp)}
                    className="w-full py-2 rounded-lg border border-[#1E3A5F] text-[#1E3A5F] text-sm font-medium hover:bg-[#1E3A5F] hover:text-white transition-colors"
                  >
                    ✏️ แก้ไขวันเริ่มงาน
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editTarget && !confirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div>
              <h2 className="font-bold text-[#1E3A5F] text-base">แก้ไขวันเริ่มงาน</h2>
              <p className="text-sm text-[#374151] mt-0.5">
                {editTarget.rank_emoji} {editTarget.name}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#374151] block mb-1.5">วันเริ่มงาน</label>
              <input
                type="date"
                value={inputDate}
                onChange={(e) => setInputDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm font-medium"
              >
                ยกเลิก
              </button>
              <button
                disabled={!inputDate}
                onClick={() => setConfirmOpen(true)}
                className="flex-1 py-2.5 rounded-lg bg-[#1E3A5F] text-white text-sm font-medium disabled:opacity-40"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {editTarget && confirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">📅</div>
              <h2 className="font-bold text-[#1E3A5F] text-base">ยืนยันการบันทึก</h2>
              <p className="text-sm text-[#374151] mt-1">
                ตั้งวันเริ่มงานของ <span className="font-semibold">{editTarget.name}</span>
              </p>
              <p className="text-sm font-bold text-[#1E3A5F] mt-1">
                {formatThaiDate(inputDate)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-lg border border-[#E2E8F0] text-[#374151] text-sm font-medium"
              >
                แก้ไข
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-[#16A34A] text-white text-sm font-medium disabled:opacity-60"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
