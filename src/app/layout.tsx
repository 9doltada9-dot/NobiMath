import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nobi Skill — ฝึกคณิตสนุก!',
  description: 'ฝึกทักษะคณิตศาสตร์สำหรับเด็ก แบบ Kumon + AI',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#7c3aed',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body className="font-nunito antialiased">{children}</body>
    </html>
  )
}
