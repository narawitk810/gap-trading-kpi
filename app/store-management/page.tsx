'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORES = [
  { id: 'gap7card', label: 'gap7card' },
  { id: 'catramen', label: 'catramen card&boardgame cafe' },
  { id: 'ninjabear', label: 'ninjabear card shop' },
]

interface SystemLink {
  url: string
  system_id: string
  system_password: string
}

const EMPTY_LINK: SystemLink = { url: '', system_id: '', system_password: '' }

const DEFAULT_LINKS: Record<string, SystemLink> = {
  store_bandai: { url: 'https://distributor.bandai-tcg-plus.com/#/event_series_detail/home', system_id: '', system_password: '' },
  store_pokemon: { url: 'https://event.asia.pokemon-card.com/login/th', system_id: '', system_password: '' },
  store_liftbound: { url: 'https://www.carde.io/', system_id: '', system_password: '' },
  gap7card_bandai: { url: '', system_id: '', system_password: '' },
  gap7card_pokemon: { url: '', system_id: '', system_password: '' },
  gap7card_liftbound: { url: '', system_id: '', system_password: '' },
  catramen_bandai: { url: '', system_id: '', system_password: '' },
  catramen_pokemon: { url: '', system_id: '', system_password: '' },
  catramen_liftbound: { url: '', system_id: '', system_password: '' },
  ninjabear_bandai: { url: '', system_id: '', system_password: '' },
  ninjabear_pokemon: { url: '', system_id: '', system_password: '' },
  ninjabear_liftbound: { url: '', system_id: '', system_password: '' },
}

const SYSTEMS = [
  { key: 'store_bandai', credBase: 'bandai', emoji: '🎮', label: 'Bandai TCG+' },
  { key: 'store_pokemon', credBase: 'pokemon', emoji: '🎴', label: 'Pokemon' },
  { key: 'store_liftbound', credBase: 'liftbound', emoji: '⚡', label: 'Liftbound & Lorcana' },
] as const

export default function StoreManagementPage() {
  const [selectedStore, setSelectedStore] = useState('')
  const [links, setLinks] = useState<Record<string, SystemLink>>(DEFAULT_LINKS)
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/system-links')
      .then((r) => r.json())
      .then((data) => {
        if (data.links) {
          const updated: Record<string, SystemLink> = { ...DEFAULT_LINKS }
          ;(data.links as { key: string; url: string; system_id: string; system_password: string }[]).forEach((l) => {
            if (updated[l.key]) {
              updated[l.key] = {
                url: l.url || updated[l.key].url,
                system_id: l.system_id || '',
                system_password: l.system_password || '',
              }
            }
          })
          setLinks(updated)
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
            <div className="flex flex-col gap-3">
              {SYSTEMS.map((sys) => {
                const urlInfo = links[sys.key] ?? EMPTY_LINK
                const credKey = `${selectedStore}_${sys.credBase}`
                const credInfo = links[credKey] ?? EMPTY_LINK
                return (
                  <div key={sys.key}>
                    <a
                      href={urlInfo.url || '#'}
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
                    <div className="mt-1 bg-[#1E3A5F]/5 rounded-xl px-3 py-2 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 w-10 shrink-0">ID</span>
                        {credInfo.system_id ? (
                          <>
                            <span className="text-xs font-mono text-[#374151] flex-1 break-all">{credInfo.system_id}</span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(credInfo.system_id)}
                              className="text-[10px] text-gray-400 hover:text-[#1E3A5F] shrink-0 px-1.5 py-0.5 border border-gray-200 rounded"
                            >
                              คัดลอก
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-300 flex-1">-</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-400 w-10 shrink-0">รหัส</span>
                        {credInfo.system_password ? (
                          <>
                            <span className="text-xs font-mono text-[#374151] flex-1 break-all">
                              {showPassword[credKey] ? credInfo.system_password : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowPassword((p) => ({ ...p, [credKey]: !p[credKey] }))}
                              className="text-[10px] text-gray-400 hover:text-[#1E3A5F] shrink-0 px-1.5 py-0.5 border border-gray-200 rounded"
                            >
                              {showPassword[credKey] ? 'ซ่อน' : 'ดู'}
                            </button>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(credInfo.system_password)}
                              className="text-[10px] text-gray-400 hover:text-[#1E3A5F] shrink-0 px-1.5 py-0.5 border border-gray-200 rounded"
                            >
                              คัดลอก
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-300 flex-1">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
