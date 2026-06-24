import { Suspense } from 'react'
import AdminDashboard from './AdminDashboard'

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
