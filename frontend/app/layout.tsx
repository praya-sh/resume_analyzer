import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Resume Analyzer - AI-Powered Feedback',
  description: 'Get instant AI-powered feedback on your resume. Analyze your resume against job descriptions for free using advanced AI.',
  keywords: 'resume analyzer, AI resume review, job application, ATS optimization, career tools',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}