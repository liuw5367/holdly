import type { Route } from './+types/root'
import { ThemeProvider } from 'next-themes'
import NProgress from 'nprogress'
import { useEffect, useState } from 'react'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
  useNavigation,
  useRouteError,
} from 'react-router'
import { Button } from '~/components/ui/button'
import { Toaster } from '~/components/ui/sonner'
import 'nprogress/nprogress.css'
import './app.css'

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  { rel: 'manifest', href: '/manifest.webmanifest' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="theme-color" content="#cc785c" />
        <title>Holdly</title>
        <Meta />
        <Links />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"
          media={hydrated ? 'all' : 'print'}
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const navigation = useNavigation()
  const isNavigating = navigation.state !== 'idle'

  useEffect(() => {
    if (isNavigating) {
      NProgress.start()
    }
    else {
      NProgress.done()
    }
  }, [isNavigating])

  useEffect(() => {
    let cancelled = false
    const register = async () => {
      const { registerSW } = await import('virtual:pwa-register')
      if (!cancelled) {
        registerSW({ immediate: true })
      }
    }
    void register().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return <Outlet />
}

export function ErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1
          className="mb-2 font-[family-name:var(--font-display)] text-4xl"
          style={{ color: 'var(--color-primary)' }}
        >
          {isRouteErrorResponse(error) ? error.status : 'Error'}
        </h1>
        <p className="mb-6" style={{ color: 'var(--color-muted)' }}>
          {isRouteErrorResponse(error)
            ? error.statusText
            : 'Something went wrong'}
        </p>
        <Button
          type="button"
          variant="default"
          onClick={() => navigate('/')}
          className="h-11 px-5 text-sm font-semibold"
        >
          Back to Home
        </Button>
      </div>
    </div>
  )
}
