'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type ProductRequest = {
  id: string
  nickname: string
  description: string
  image_data: string
  status: string
  created_at: string
  approved_at: string | null
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusContent() {
  const searchParams = useSearchParams()
  const [nickname, setNickname] = useState(searchParams.get('nickname') || '')
  const [searchNickname, setSearchNickname] = useState(searchParams.get('nickname') || '')
  const [requests, setRequests] = useState<ProductRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(!!searchParams.get('nickname'))

  useEffect(() => {
    if (searchParams.get('nickname')) {
      fetchRequests(searchParams.get('nickname')!)
    }
  }, [searchParams])

  async function fetchRequests(name: string) {
    if (!name.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/product-requests?nickname=${encodeURIComponent(name.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  function handleSearch() {
    setSearchNickname(nickname)
    fetchRequests(nickname)
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8]">
      <div className="bg-[#1E3A5F] text-white px-4 py-5 text-center shadow-md">
        <h1 className="text-xl font-bold tracking-wide">GAP TRADING</h1>
        <p className="text-sm mt-1 opacity-75">ตรวจสอบสถานะคำขอสินค้า</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
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

        {searched && !loading && (
          <div>
            {requests.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm text-center text-gray-400 text-sm">
                ไม่พบคำขอสำหรับชื่อเล่น &quot;{searchNickname}&quot;
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-400 font-semibold px-1">
                  คำขอของ {searchNickname} ({requests.length} รายการ)
                </p>
                {requests.map((req) => (
                  <div key={req.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {req.image_data && (
                      <img
                        src={req.image_data}
                        alt="สินค้า"
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-[#374151]">{req.description}</p>
                        {req.status === 'approved' ? (
                          <span className="shrink-0 inline-flex items-center gap-1 bg-[#16A34A]/10 text-[#16A34A] text-xs font-bold px-2.5 py-1 rounded-full">
                            ✅ อนุมัติแล้ว
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-xs font-bold px-2.5 py-1 rounded-full">
                            🟡 รอดำเนินการ
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">ส่งเมื่อ {formatDateTime(req.created_at)}</p>
                      {req.approved_at && (
                        <p className="text-xs text-[#16A34A] mt-0.5">
                          อนุมัติเมื่อ {formatDateTime(req.approved_at)}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-300 mt-1">#{req.id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Link
          href="/request"
          className="block text-center text-sm text-[#1E3A5F] font-semibold hover:underline py-2"
        >
          + ยื่นคำขอสินค้าใหม่
        </Link>
      </div>
    </div>
  )
}

export default function StatusPage() {
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
