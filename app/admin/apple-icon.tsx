import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          border: '6px solid #1E3A5F',
        }}
      >
        <span style={{ color: '#1E3A5F', fontSize: 64, fontWeight: 700, fontFamily: 'sans-serif', lineHeight: 1 }}>
          G
        </span>
        <span
          style={{
            color: '#1E3A5F',
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            letterSpacing: 2,
            marginTop: 6,
          }}
        >
          ADMIN
        </span>
      </div>
    ),
    { ...size }
  )
}
