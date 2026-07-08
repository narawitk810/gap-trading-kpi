import type { Metadata, Viewport } from 'next'
import { Sarabun } from 'next/font/google'
import './globals.css'
import InstallPrompt from '@/components/InstallPrompt'

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#1E3A5F',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'KPI รายวัน — GAP TRADING',
  description: 'ระบบบันทึก KPI การทำงานรายวัน',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'GAP KPI' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={`${sarabun.className} bg-[#F5F6F8] min-h-screen`}>
        {children}
        <InstallPrompt />
      </body>
    </html>
  )
}
