import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params
  const s = parseInt(size, 10) || 192

  return new ImageResponse(
    (
      <div
        style={{
          width: s,
          height: s,
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: s * 0.18,
          border: `${Math.max(2, Math.round(s * 0.04))}px solid #1E3A5F`,
        }}
      >
        <span style={{ color: '#1E3A5F', fontSize: s * 0.42, fontWeight: 700, fontFamily: 'sans-serif' }}>
          G
        </span>
      </div>
    ),
    { width: s, height: s }
  )
}
