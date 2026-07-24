'use client'

import { useEffect, useState, useCallback } from 'react'

type MarketingRow = {
  nickname: string
  channel: string
  isLowRoi: boolean
  isBestRoi: boolean
  live_staff_name: string
  ads_cost: string
  gross_revenue: string
  roi: string
  cost_per_order: string
  cost_per_10sec_view: string
  avg_view_duration: string
  new_followers: string
}

type LiveRow = {
  nickname: string
  time: string
  channels: string[]
  live_hours: string
  sales_amount: string
  obstacles: string
}

function formatThaiDate(dateStr: string) {
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${parseInt(y) + 543}`
}

function fmt(val: string) {
  if (!val) return '—'
  const n = Number(val)
  return isNaN(n) ? val : n.toLocaleString('th-TH')
}

export default function ManagerPage() {
  const [activeTab, setActiveTab] = useState<'marketing' | 'live'>('marketing')
  const [marketingRows, setMarketingRows] = useState<MarketingRow[]>([])
  const [liveRows, setLiveRows] = useState<LiveRow[]>([])
  const [date, setDate] = useState(new Date().toLocaleDateString('sv-SE'))
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [countdown, setCountdown] = useState(60)

  const fetchMarketing = useCallback(async (d: string) => {
    const res = await fetch(`/api/marketing-summary?date=${d}`)
    const data = await res.json()
    setMarketingRows(data.rows || [])
  }, [])

  const fetchLive = useCallback(async (d: string) => {
    const res = await fetch(`/api/live-summary?date=${d}`)
    const data = await res.json()
    setLiveRows(data.rows || [])
  }, [])

  const fetchData = useCallback(async (d: string) => {
    setLoading(true)
    try {
      await Promise.all([fetchMarketing(d), fetchLive(d)])
      setLastUpdated(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }))
      setCountdown(60)
    } finally {
      setLoading(false)
    }
  }, [fetchMarketing, fetchLive])

  useEffect(() => {
    fetchData(date)
  }, [date, fetchData])

  useEffect(() => {
    const fetchInterval = setInterval(() => fetchData(date), 60_000)
    const uiInterval = setInterval(() => setCountdown((c) => (c <= 1 ? 60 : c - 1)), 1_000)
    return () => {
      clearInterval(fetchInterval)
      clearInterval(uiInterval)
    }
  }, [date, fetchData])

  const marketingCols = [
    { key: 'ads_cost', label: 'ต้นทุน ads', unit: 'บาท' },
    { key: 'gross_revenue', label: 'รายได้ขั้นต้น', unit: 'บาท' },
    { key: 'roi', label: 'ROI', unit: 'บาท' },
    { key: 'cost_per_order', label: 'ต้นทุน/คำสั่ง', unit: 'บาท' },
    { key: 'cost_per_10sec_view', label: 'ดู 10 วิ', unit: 'บาท' },
    { key: 'avg_view_duration', label: 'ระยะดู', unit: 'วิ' },
    { key: 'new_followers', label: 'follower', unit: '' },
  ]

  const totalSales = liveRows.reduce((sum, r) => sum + (Number(r.sales_amount) || 0), 0)
  const totalHours = liveRows.reduce((sum, r) => sum + (Number(r.live_hours) || 0), 0)

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-4">
        <h1 className="text-lg font-bold">รายงานผู้จัดการไลฟ์สด</h1>
        <p className="text-sm text-blue-200 mt-0.5">{formatThaiDate(date)}</p>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-4 space-y-4">
        {/* Controls */}
        <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-[#374151]">
            <span className="text-xs text-gray-400 font-semibold">วันที่</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-[#E2E8F0] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-400">อัปเดต {lastUpdated} · รีเฟรชใน {countdown} วิ</span>
            )}
            <button
              onClick={() => fetchData(date)}
              disabled={loading}
              className="bg-[#1E3A5F] text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
            >
              {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('marketing')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'marketing'
                ? 'bg-[#1E3A5F] text-white shadow-sm'
                : 'bg-white text-[#374151] shadow-sm hover:bg-[#F5F6F8]'
            }`}
          >
            การตลาด
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeTab === 'live'
                ? 'bg-[#1E3A5F] text-white shadow-sm'
                : 'bg-white text-[#374151] shadow-sm hover:bg-[#F5F6F8]'
            }`}
          >
            ไลฟ์สด
          </button>
        </div>

        {/* Marketing Tab */}
        {activeTab === 'marketing' && (
          <>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-[#DC2626] font-semibold px-2.5 py-1 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-[#DC2626] inline-block" /> ROI ต่ำกว่า 15
              </span>
              <span className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-[#16A34A] font-semibold px-2.5 py-1 rounded-lg">
                ⭐ ROI สูงสุด
              </span>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : marketingRows.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm py-16 text-center">
                <p className="text-gray-400 text-sm">รอข้อมูลจากทีมการตลาด...</p>
                <p className="text-gray-300 text-xs mt-1">รีเฟรชอัตโนมัติทุก 60 วินาที</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[860px]">
                    <thead>
                      <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                        <th className="text-left px-4 py-3 sticky left-0 bg-[#F5F6F8]">ช่อง</th>
                        <th className="text-left px-4 py-3">โดย</th>
                        <th className="text-left px-4 py-3">พนักงานไลฟ์</th>
                        {marketingCols.map((c) => (
                          <th key={c.key} className="text-right px-4 py-3">
                            {c.label}
                            {c.unit && <span className="font-normal text-gray-400"> ({c.unit})</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {marketingRows.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-t border-[#E2E8F0] ${
                            row.isBestRoi ? 'bg-green-50' : row.isLowRoi ? 'bg-red-50' : 'bg-white'
                          }`}
                        >
                          <td className={`px-4 py-3 font-semibold whitespace-nowrap sticky left-0 ${
                            row.isBestRoi ? 'bg-green-50 text-[#16A34A]' : row.isLowRoi ? 'bg-red-50 text-[#DC2626]' : 'bg-white text-[#1E3A5F]'
                          }`}>
                            {row.isBestRoi ? '⭐ ' : ''}{row.channel}
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.nickname}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.live_staff_name || '—'}</td>
                          {marketingCols.map((c) => (
                            <td key={c.key} className="px-4 py-3 text-right text-[#374151] whitespace-nowrap">
                              {fmt(row[c.key as keyof MarketingRow] as string)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-[#E2E8F0] text-xs text-gray-400">
                  {marketingRows.length} ช่อง · {marketingRows.filter((r) => r.isLowRoi).length} ช่อง ROI &lt; 15 · {marketingRows.filter((r) => r.isBestRoi).length} ช่อง ROI สูงสุด
                </div>
              </div>
            )}
          </>
        )}

        {/* Live Tab */}
        {activeTab === 'live' && (
          <>
            {loading ? (
              <div className="bg-white rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">กำลังโหลด...</div>
            ) : liveRows.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm py-16 text-center">
                <p className="text-gray-400 text-sm">รอข้อมูลจากทีมไลฟ์สด...</p>
                <p className="text-gray-300 text-xs mt-1">รีเฟรชอัตโนมัติทุก 60 วินาที</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-[#F5F6F8] text-xs text-gray-500 font-semibold uppercase tracking-wider">
                        <th className="text-left px-4 py-3">ช่อง</th>
                        <th className="text-left px-4 py-3">โดย</th>
                        <th className="text-left px-4 py-3">เวลา</th>
                        <th className="text-right px-4 py-3">ชั่วโมงไลฟ์</th>
                        <th className="text-right px-4 py-3">ยอดขาย (บาท)</th>
                        <th className="text-left px-4 py-3">ปัญหา/อุปสรรค</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveRows.map((row, i) => (
                        <tr key={i} className={`border-t border-[#E2E8F0] ${row.obstacles ? 'bg-amber-50' : 'bg-white'}`}>
                          <td className="px-4 py-3 text-[#1E3A5F] font-semibold">
                            {row.channels.length > 0 ? row.channels.join(', ') : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.nickname}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.time || '—'}</td>
                          <td className="px-4 py-3 text-right text-[#374151]">{fmt(row.live_hours)}</td>
                          <td className="px-4 py-3 text-right text-[#374151] font-semibold">{fmt(row.sales_amount)}</td>
                          <td className="px-4 py-3 text-sm text-[#374151] max-w-[240px]">
                            {row.obstacles ? (
                              <span className="text-amber-700">{row.obstacles}</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 border-t border-[#E2E8F0] text-xs text-gray-400">
                  {liveRows.length} รายการ · รวมยอด {totalSales.toLocaleString('th-TH')} บาท · รวม {totalHours.toLocaleString('th-TH')} ชั่วโมง
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
