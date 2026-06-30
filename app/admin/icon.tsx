import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: '2px solid #1E3A5F',
        }}
      >
        <span style={{ color: '#1E3A5F', fontSize: 16, fontWeight: 700, fontFamily: 'sans-serif' }}>
          G
        </span>
      </div>
    ),
    { ...size }
  )
}
