import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = { title: { default: 'PastQ — Practice with purpose', template: '%s · PastQ' }, description: 'Focused exam practice for Nigerian students.', generator: 'PastQ', icons: { icon: '/brand/favicon.svg', apple: '/brand/favicon.svg' } }
export const viewport: Viewport = { colorScheme: 'light dark', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#FBF9F5' }, { media: '(prefers-color-scheme: dark)', color: '#0A1930' }], viewportFit: 'cover', userScalable: false }

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
