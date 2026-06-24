'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { DEPARTMENTS } from '@/types/kpi'
import type { KPIEntry } from '@/types/kpi'

const ADMIN_KEY = 'GAPtrading2024admin'

function getTodayDate() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#374151]">{value || '—'}</p>
    </div>
  )
}

function ExtraDataSection({ entry }: { entry: KPIEntry }) {
  if (!entry.extra_data) return null
  let ex: Record<string, unknown> = {}
  try {
    ex = JSON.parse(entry.extra_data)
  } catch {
    return null
  }
  const dept = entry.department

  if (dept === 'ไลฟ์สด' && (ex.live_hours || ex.sales_amount)) {
    return (
      <div className="bg-blue-50 rounded-xl p-3 space-y-2">
        <p className="text-xs font-bold text-[#1E3A5F]">ข้อมูลไลฟ์สด</p>
        <div className="grid grid-cols-2 gap-3">
          {ex.live_hours && (
            <DetailRow label="ชั่วโมงไลฟ์" value={`${ex.live_hours} ชั่วโมง`} />
          )}
          {ex.sales_amount && (
            <DetailRow
              label="ยอดขาย"
              value={`${Number(ex.sales_amount).toLocaleString()} บาท`}
            />
          )}
        </div>
      </div>
    )
  }

  if (dept === 'Creative') {
    const links = (ex.clip_links as string[] | undefined) || []
    if (links.length === 0) return null
    return (
      <div className="bg-blue-50 rounded-xl p-3">
        <p className="text-xs font-bold text-[#1E3A5F] mb-2">
          ลิ้งคลิปที่ทำเสร็จ ({links.length} คลิป)
        </p>
        <ul className="space-y-1">
          {links.map((link, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="text-gray-400 shrink-0">{i + 1}.</span>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A5F] underline truncate"
              >
                {link}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (dept === 'การตลาด') {
    const platforms = [
      { k: 'ads_shopee', l: 'Shopee' },
      { k: 'ads_lazada', l: 'Lazada' },
      { k: 'ads_tiktok', l: 'TikTok' },
      { k: 'ads_facebook', l: 'Facebook' },
    ].filter(({ k }) => ex[k])
    if (platforms.length === 0) return null
    const total = platforms.reduce((s, { k }) => s + Number(ex[k] || 0), 0)
    return (
      <div className="bg-blue-50 rounded-xl p-3">
        <p className="text-xs font-bold text-[#1E3A5F] mb-2">
          ค่า Ads วันนี้ (รวม {total.toLocaleString()} บาท)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {platforms.map(({ k, l }) => (
            <DetailRow key={k} label={l} value={`${Number(ex[k]).toLocaleString()} บาท`} />
          ))}
        </div>
      </div>
    )
  }

  return null
}

export default function AdminDashboard() {
  const searchParams = useSearchParams()
  const key = searchParams.get('key')
  const isAuthorized = key === ADMIN_KEY

  const [entries, setEntries] = useState<KPIEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntry, setSelectedEntry] = useState<KPIEntry | null>(null)
  const [filters, setFilters] = useState({
    department: '',
    dateFrom: '',
    dateTo: '',
    nickname: '',
  })

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/kpi?key=${ADMIN_KEY}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthorized) fetchEntries()
  }, [isAuthorized, fetchEntries])

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-[#1E3A5F] mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-gray-500 text-sm">กรุณาตรวจสอบ URL ที่ได้รับจาก HR หรือผู้ดูแลระบบ</p>
        </div>
      </div>
    )
  }

  const today = getTodayDate()
  const todayEntries = entries.filter((e) => e.date === today)
  const todayByDept = DEPARTMENTS.reduce<Record<string, number>>((acc, dept) => {
    acc[dept] = todayEntries.filter((e) => e.department === dept).length
    return acc
  }, {})

  const filteredEntries = entries.filter((entry) => {
    if (filters.department && entry.department !== filters.department) return false
    if (filters.dateFrom && entry.date < filters.dateFrom) return false
    if (filters.dateTo && entry.date > filters.dateTo) return false
    if (filters.nickname && !entry.nickname.toLowerCase().includes(filters.nickname.toLowerCase()))
      return false
    return true
  })

  const hasFilters = filters.department || filters.dateFrom || filters.dateTo || filters.nickname

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
            <p className="text-sm mt-0.5" style={{ opacity: 0.75 }}>
              แดชบอร์ด KPI รายวัน
            </p>
          </div>
          <button
            onClick={fetchEntries}
            className="text-xs text-white/70 border border-white/30 rounded-lg px-3 py-1.5 hover:bg-white/10"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Today Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-bold text-[#1E3A5F] mb-4">
            สรุปวันนี้ — {formatDate(today)}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-center min-w-[60px]">
              <div className="text-3xl font-bold text-[#1E3A5F]">{todayEntries.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">รายการ</div>
            </div>
            <div className="w-px h-10 bg-[#E2E8F0] hidden sm:block" />
            <div className="flex flex-wrap gap-2">
              {DEPARTMENTS.filter((d) => todayByDept[d] > 0).map((dept) => (
                <span
                  key={dept}
                  className="inline-flex items-center gap-1.5 bg-[#F5F6F8] border border-[#E2E8F0] rounded-full px-3 py-1 text-xs font-medium text-[#374151]"
                >
                  {dept}
                  <span className="font-bold text-[#1E3A5F]">{todayByDept[dept]}</span>
                </span>
              ))}
              {todayEntries.length === 0 && (
                <p className="text-gray-400 text-sm">ยังไม่มีข้อมูลสำหรับวันนี้</p>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">ตัวกรอง</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select
              value={filters.department}
              onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}
              className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            >
              <option value="">ทุกแผนก</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="relative">
              <label className="absolute -top-2 left-3 text-[10px] text-gray-400 bg-white px-1">
                จากวันที่
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <div className="relative">
              <label className="absolute -top-2 left-3 text-[10px] text-gray-400 bg-white px-1">
                ถึงวันที่
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
              />
            </div>
            <input
              type="text"
              value={filters.nickname}
              onChange={(e) => setFilters((prev) => ({ ...prev, nickname: e.target.value }))}
              placeholder="ค้นหาชื่อเล่น..."
              className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
          </div>
          {hasFilters && (
            <button
              onClick={() =>
                setFilters({ department: '', dateFrom: '', dateTo: '', nickname: '' })
              }
              className="mt-3 text-xs text-[#DC2626] font-semibold hover:underline"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <h3 className="font-bold text-[#1E3A5F]">
              รายการทั้งหมด
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({filteredEntries.length} รายการ)
              </span>
            </h3>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">ไม่พบข้อมูล</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                    <th className="text-left px-4 py-3">วันที่</th>
                    <th className="text-left px-4 py-3">เวลา</th>
                    <th className="text-left px-4 py-3">แผนก</th>
                    <th className="text-left px-4 py-3">ชื่อเล่น</th>
                    <th className="text-left px-4 py-3">ช่องที่ดูแล</th>
                    <th className="text-left px-4 py-3">สิ่งที่ทำ</th>
                    <th className="text-left px-4 py-3">อุปสรรค</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={`cursor-pointer hover:bg-blue-50 transition-colors border-t border-[#E2E8F0] ${
                        idx % 2 === 1 ? 'bg-[#FAFBFC]' : 'bg-white'
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">{entry.time}</td>
                      <td className="px-4 py-3">
                        <span className="bg-[#1E3A5F]/10 text-[#1E3A5F] text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap">
                          {entry.department}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#374151] whitespace-nowrap">
                        {entry.nickname}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {entry.channel_name}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <span className="block truncate text-[#374151]">
                          {entry.tasks[0]}
                          {entry.tasks.length > 1 && (
                            <span className="text-gray-400 ml-1.5 text-xs">
                              +{entry.tasks.length - 1}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <span className="block truncate text-gray-400 text-xs">
                          {entry.obstacles || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setSelectedEntry(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-start justify-between">
              <div>
                <h3 className="font-bold text-[#1E3A5F] text-lg">{selectedEntry.nickname}</h3>
                <p className="text-xs text-gray-400 mt-0.5">#{selectedEntry.id}</p>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-400 text-2xl w-8 h-8 flex items-center justify-center hover:text-gray-600 shrink-0"
                aria-label="ปิด"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <DetailRow label="แผนก" value={selectedEntry.department} />
                <DetailRow
                  label="วันที่ / เวลา"
                  value={`${formatDate(selectedEntry.date)}  ${selectedEntry.time} น.`}
                />
                <DetailRow label="ชื่อเล่น" value={selectedEntry.nickname} />
                <DetailRow label="ช่องที่ดูแล" value={selectedEntry.channel_name} />
              </div>

              {/* Department-specific extra data */}
              <ExtraDataSection entry={selectedEntry} />

              <div>
                <p className="text-xs text-gray-500 mb-2">สิ่งที่ทำวันนี้</p>
                <ul className="space-y-2">
                  {selectedEntry.tasks.map((task, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-sm bg-[#F5F6F8] rounded-xl px-3 py-2"
                    >
                      <span className="text-gray-400 shrink-0">{i + 1}.</span>
                      <span className="text-[#374151]">{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {selectedEntry.obstacles ? (
                <div>
                  <p className="text-xs text-gray-500 mb-2">อุปสรรคที่เจอ</p>
                  <p className="text-sm text-[#374151] bg-[#FFF8F0] border border-orange-100 rounded-xl p-3">
                    {selectedEntry.obstacles}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-1">อุปสรรคที่เจอ</p>
                  <p className="text-sm text-gray-400">ไม่มี</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-full py-3 rounded-xl bg-[#1E3A5F] text-white font-semibold"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
