import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Match Making TCG — GAP7 CARD SHOP',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'GAP7 TCG' },
  manifest: '/api/tcg-manifest',
}

export default function TcgLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
