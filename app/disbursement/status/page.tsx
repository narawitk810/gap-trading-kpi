'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

type DisbursementStatus = 'pending_approval' | 'approved' | 'ordered' | 'payment_recorded' | 'monthly_closed'

type Disbursement = {
  id: string
  requester: string
  item_list: string
  requested_amount: number
  request_date: string
  status: DisbursementStatus
  created_at: string
}

const STATUS_CONFIG: Record<DisbursementStatus, { icon: string; label: string; badgeClass: string }> = {
  pending_approval: { icon: '📋', label: 'รอดำเนินการ', badgeClass: 'bg-amber-100 text-amber-700' },
  approved:         { icon: '✅', label: 'อนุมัติแล้ว',  badgeClass: 'bg-green-100 text-green-700' },
  ordered:          { icon: '🛒', label: 'สั่งซื้อแล้ว', badgeClass: 'bg-blue-100 text-blue-700' },
  payment_recorded: { icon: '💳', label: 'บันทึกจ่ายแล้ว', badgeClass: 'bg-indigo-100 text-indigo-700' },
  monthly_closed:   { icon: '🔒', label: 'ปิดงบแล้ว',   badgeClass: 'bg-gray-100 text-gray-600' },
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

function StatusContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialNickname = searchParams.get('nickname') || ''

  const [nickname, setNickname] = useState(initialNickname)
  const [searchedNickname, setSearchedNickname] = useState(initialNickname)
  const [items, setItems] = useState<Disbursement[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(!!initialNickname)
  const [publicItems, setPublicItems] = useState<Disbursement[]>([])

  useEffect(() => {
    if (initialNickname) fetchItems(initialNickname)
  }, [initialNickname])

  useEffect(() => {
    fetch('/api/disbursements?public=true')
      .then(r => r.json())
      .then(d => setPublicItems(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  async function fetchItems(name: string) {
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/disbursements?requester=${encodeURIComponent(name.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setItems(Array.isArray(data) ? data : [])
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  function handleSearch() {
    setSearchedNickname(nickname)
    fetchItems(nickname)
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      {/* Header */}
      <div className="bg-[#1E3A5F] text-white px-4 py-5 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="text-white/70 hover:text-white p-1 -ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
            <p className="text-sm mt-0.5 opacity-75">ติดตามสถานะการเบิก</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Search */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block text-sm font-semibold text-[#374151] mb-2">
            กรอกชื่อเล่นของคุณ
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="ชื่อเล่น..."
              className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
            />
            <button
              onClick={handleSearch}
              disabled={!nickname.trim() || loading}
              className="bg-[#1E3A5F] text-white px-5 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {loading ? '...' : 'ค้นหา'}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {searched && !loading && (
          <div>
            {items.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm text-center text-gray-400 text-sm">
                ไม่พบรายการสำหรับชื่อเล่น &ldquo;{searchedNickname}&rdquo;
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 font-semibold px-1">
                  คำขอของ {searchedNickname} ({items.length} รายการ)
                </p>
                {items.map((item) => {
                  const cfg = STATUS_CONFIG[item.status] ?? { icon: '❓', label: item.status, badgeClass: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#374151] leading-snug">{item.item_list}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(item.request_date)}
                            {item.requested_amount > 0 && (
                              <> · {item.requested_amount.toLocaleString('th-TH', { minimumFractionDigits: 0 })} บาท</>
                            )}
                          </p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badgeClass}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-300 mt-2">#{item.id}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Public History */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <p className="font-bold text-[#374151]">ประวัติคำขอแจ้งเบิก</p>
              <p className="text-xs text-gray-400 mt-0.5">ทุกคนมองเห็น</p>
            </div>
            <span className="text-xs bg-[#F5F6F8] text-gray-500 px-2 py-1 rounded-full font-semibold">
              {publicItems.length} รายการ
            </span>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {publicItems.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">ยังไม่มีรายการ</p>
            ) : (
              publicItems.map((item) => {
                const cfg = STATUS_CONFIG[item.status] ?? { icon: '❓', label: item.status, badgeClass: 'bg-gray-100 text-gray-600' }
                return (
                  <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#374151] truncate">{item.item_list}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.requester} · {formatDate(item.request_date)}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${cfg.badgeClass}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DisbursementStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
        <p className="text-gray-400">กำลังโหลด...</p>
      </div>
    }>
      <StatusContent />
    </Suspense>
  )
}
