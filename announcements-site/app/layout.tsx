import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'เว็บไซต์ประกาศ — GAP TRADING',
  description: 'ประกาศสำคัญของบริษัท + สินค้าเข้า',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`body { font-family: 'Noto Sans Thai', sans-serif; }`}</style>
      </head>
      <body className="bg-[#F5F6F8] text-[#374151]">{children}</body>
    </html>
  )
}
