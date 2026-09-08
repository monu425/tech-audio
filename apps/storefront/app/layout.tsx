import type { Metadata } from 'next'

import '@/app/globals.css'
import { CartDrawer } from '@/components/cart-drawer'
import { CartProvider } from '@/components/cart-provider'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Voltify — Premium Electronics Store',
    template: '%s | Voltify'
  },
  description:
    'Shop premium phone accessories, earbuds, projectors, keyboards, mice and consumer electronics.',
  keywords: ['electronics', 'earbuds', 'projectors', 'accessories', 'online store'],
  openGraph: {
    type: 'website',
    siteName: 'Voltify',
    title: 'Voltify — Premium Electronics Store',
    description:
      'Shop premium phone accessories, earbuds, projectors, keyboards, mice and consumer electronics.'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Voltify — Premium Electronics Store',
    description:
      'Shop premium phone accessories, earbuds, projectors, keyboards, mice and consumer electronics.'
  }
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/#organization`,
      name: 'Voltify',
      url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    },
    {
      '@type': 'WebSite',
      '@id': `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/#website`,
      url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      name: 'Voltify',
      publisher: {
        '@id': `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/#organization`
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${
            process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
          }/products?q={search_term_string}`
        },
        'query-input': 'required name=search_term_string'
      }
    }
  ]
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background flex min-h-screen flex-col font-sans text-foreground antialiased">
        <CartProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="border-t py-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
              <span>© {new Date().getFullYear()} Voltify. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <a className="transition-colors hover:text-foreground" href="/categories">
                  Categories
                </a>
                <a className="transition-colors hover:text-foreground" href="/products?onSale=true">
                  Deals
                </a>
              </div>
            </div>
          </footer>
          <CartDrawer />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
          />
        </CartProvider>
      </body>
    </html>
  )
}
