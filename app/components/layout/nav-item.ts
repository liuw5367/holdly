export function isNavItemActive(to: string, pathname: string) {
  if (to === '/assets')
    return pathname === '/assets' || pathname.startsWith('/assets/') || pathname.startsWith('/subscriptions')
  return pathname === to || pathname.startsWith(`${to}/`)
}
