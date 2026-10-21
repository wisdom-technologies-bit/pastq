import { Analytics } from '@vercel/analytics/next'
import { Bricolage_Grotesque, Figtree, Literata } from 'next/font/google'
import type { Metadata, Viewport } from 'next'

const heading = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-heading' })
const ui = Figtree({ subsets: ['latin'], variable: '--font-ui' })
const reading = Literata({ subsets: ['latin'], variable: '--font-reading' })
import './globals.css'

export const metadata: Metadata = { title: { default: 'PastQ — Practice with purpose', template: '%s · PastQ' }, description: 'Focused preparation for Nigerian students preparing for JAMB, WAEC, NECO and Post-UTME.', generator: 'PastQ', metadataBase: new URL('https://pastq.app'), openGraph: { title: 'PastQ — Practice with purpose', description: 'Focused preparation for Nigerian students.', type: 'website', siteName: 'PastQ' }, appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'PastQ' }, icons: { icon: '/brand/favicon.svg', apple: '/brand/favicon.svg' } }
export const viewport: Viewport = { colorScheme: 'light dark', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#FBF9F5' }, { media: '(prefers-color-scheme: dark)', color: '#0A1930' }], viewportFit: 'cover', userScalable: false }

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${ui.variable} ${reading.variable} antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
