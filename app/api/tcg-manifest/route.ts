import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'GAP7 CARD SHOP — Match Making',
    short_name: 'GAP7 TCG',
    description: 'ระบบจับคู่เกมการ์ด GAP7 CARD SHOP',
    start_url: '/tcg',
    display: 'standalone',
    background_color: '#F5F6F8',
    theme_color: '#1E3A5F',
    icons: [
      { src: '/IMG_3291.JPG', sizes: 'any', type: 'image/jpeg' },
    ],
  })
}
