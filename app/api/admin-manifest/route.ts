import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'G ADMIN — GAP TRADING',
    short_name: 'G ADMIN',
    description: 'หน้าจัดการระบบสำหรับผู้ดูแล GAP TRADING',
    start_url: '/admin?key=GAPtrading2024admin',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#1E3A5F',
    icons: [
      { src: '/api/icons/admin/192', sizes: '192x192', type: 'image/png' },
      { src: '/api/icons/admin/512', sizes: '512x512', type: 'image/png' },
    ],
  })
}
