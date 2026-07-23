import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'GAP TRADING — ระบบ KPI',
    short_name: 'GAP KPI',
    description: 'ระบบบันทึก KPI การทำงานรายวัน และเครื่องมือสำหรับพนักงาน GAP TRADING',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F5F6F8',
    theme_color: '#1E3A5F',
    icons: [
      { src: '/api/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/api/icons/512', sizes: '512x512', type: 'image/png' },
    ],
  })
}
