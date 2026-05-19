import type { Metadata } from 'next'
import { Poppins } from 'next/font/google'
import ThemeProvider from '@/components/layout/ThemeProvider'
import './globals.css'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CBBA Inbox',
  description: 'Internal customer communications platform for City of Blacktown Basketball Association',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <body className="font-sans bg-cbba-navy text-white antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
