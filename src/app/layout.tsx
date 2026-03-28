import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Yori（より）',
  description: '障害のある子を育てる親に寄り添うAI',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-yori-bg min-h-screen font-sans text-yori-text">
        {children}
      </body>
    </html>
  )
}
