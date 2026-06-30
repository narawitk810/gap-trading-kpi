import { Suspense } from 'react'
import type { Metadata } from 'next'
import AdminDashboard from './AdminDashboard'

export const metadata: Metadata = {
  title: 'G ADMIN — GAP TRADING',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'G ADMIN' },
  manifest: '/api/admin-manifest',
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6F8] flex items-center justify-center">
          <p className="text-gray-400 text-sm">กำลังโหลด...</p>
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  )
}
