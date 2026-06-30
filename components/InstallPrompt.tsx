'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa_install_dismissed'

export default function InstallPrompt() {
  const [visible, setVisible] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    if (isStandalone) return

    const ua = window.navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(ua)
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)

    if (iOS && isSafari) {
      setIsIOS(true)
      setVisible(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm bg-white border border-[#E2E8F0] rounded-2xl shadow-lg p-4 flex items-start gap-3">
      <div className="w-10 h-10 bg-[#1E3A5F] rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold">
        G7
      </div>
      <div className="flex-1 min-w-0">
        {isIOS ? (
          <>
            <p className="text-sm font-bold text-[#374151]">เพิ่มหน้าจอโฮม</p>
            <p className="text-xs text-gray-400 mt-0.5">
              กดปุ่มแชร์ 📤 แล้วเลือก &quot;เพิ่มไปยังหน้าจอโฮม&quot; เพื่อเข้าใช้งานได้เร็วขึ้นในครั้งต่อไป
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-[#374151]">เพิ่มหน้าจอโฮม</p>
            <p className="text-xs text-gray-400 mt-0.5">เข้าใช้งานได้เร็วขึ้น ไม่ต้องหาลิงก์อีก</p>
            <button
              onClick={install}
              className="mt-2 px-3 py-1.5 bg-[#1E3A5F] text-white text-xs font-bold rounded-xl"
            >
              📲 เพิ่มหน้าจอโฮม
            </button>
          </>
        )}
      </div>
      <button onClick={dismiss} className="text-gray-300 shrink-0 text-lg leading-none px-1" aria-label="ปิด">
        ×
      </button>
    </div>
  )
}
