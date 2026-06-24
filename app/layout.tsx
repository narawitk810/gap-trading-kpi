import type { Metadata } from 'next'
import { Sarabun } from 'next/font/google'
import './globals.css'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'KPI รายวัน — GAP TRADING',
  description: 'ระบบบันทึก KPI การทำงานรายวัน',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${sarabun.className} bg-[#F5F6F8] min-h-screen`}>{children}</body>
    </html>
  )
}
