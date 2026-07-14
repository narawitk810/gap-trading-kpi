'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORES = [
  { id: 'gap7card', label: 'gap7card' },
  { id: 'catramen', label: 'catramen card&boardgame cafe' },
  { id: 'ninjabear', label: 'ninjabear card shop' },
]

const DEFAULT_LINKS = {
  store_bandai: 'https://distributor.bandai-tcg-plus.com/#/event_series_detail/home',
  store_pokemon: 'https://event.asia.pokemon-card.com/login/th',
  store_liftbound: 'https://www.carde.io/',
}

const SYSTEMS = [
  { key: 'store_bandai', emoji: '🎮', label: 'Bandai TCG+' },
  { key: 'store_pokemon', emoji: '🎴', label: 'Pokemon' },
  { key: 'store_liftbound', emoji: '⚡', label: 'Liftbound & Lorcana' },
] as const

export default function StoreManagementPage() {
  const [selectedStore, setSelectedStore] = useState('')
  const [links, setLinks] = useState(DEFAULT_LINKS)

  useEffect(() => {
    fetch('/api/system-links')
      .then((r) => r.json())
      .then((data) => {
        if (data.links) {
          const map: Record<string, string> = {}
          ;(data.links as { key: string; url: string }[]).forEach((l) => { map[l.key] = l.url })
          setLinks((prev) => ({ ...prev, ...map }))
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F6F8]" style={{ fontFamily: "'Sarabun', sans-serif" }}>
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-4 flex items-center gap-3">
        <Link href="/" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F5F6F8]">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#374151]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <p className="font-bold text-[#1E3A5F]">ระบบจัดการหน้าร้าน</p>
          <p className="text-xs text-gray-400">เลือกร้านค้า แล้วเข้าระบบทัวร์นาเมนต์</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
          <p className="text-sm font-bold text-[#374151] mb-3">เลือกร้านค้า</p>
          <div className="flex flex-col gap-2">
            {STORES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStore(s.id === selectedStore ? '' : s.id)}
                className={`px-4 py-3 rounded-xl text-sm font-semibold border text-left transition-colors ${
                  selectedStore === s.id
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]'
                    : 'bg-white text-[#374151] border-[#E2E8F0] hover:border-[#1E3A5F]'
                }`}
              >
                🏪 {s.label}
              </button>
            ))}
          </div>
        </div>

        {selectedStore && (
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0]">
            <p className="text-sm font-bold text-[#374151] mb-3">เข้าระบบ</p>
            <div className="flex flex-col gap-2">
              {SYSTEMS.map((sys) => (
                <a
                  key={sys.key}
                  href={links[sys.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#F5F6F8] hover:bg-[#1E3A5F]/10 rounded-xl px-4 py-3 transition-colors"
                >
                  <span className="text-xl">{sys.emoji}</span>
                  <span className="text-sm font-semibold text-[#1E3A5F] flex-1">ระบบ {sys.label}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
