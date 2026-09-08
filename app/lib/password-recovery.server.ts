import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'
import { parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

const PASSWORD_RECOVERY_COOKIE = 'holdly-password-recovery-grant'
const PASSWORD_RECOVERY_MAX_AGE_SECONDS = 15 * 60

interface PasswordRecoveryGrant {
  sub: string
  exp: number
}

function getSigningSecret() {
  const secret = process.env.PASSWORD_RECOVERY_SECRET
  if (!secret || secret.length < 32)
    throw new Error('PASSWORD_RECOVERY_SECRET must contain at least 32 characters')
  return secret
}

export function assertPasswordRecoveryConfigured() {
  getSigningSecret()
}

function sign(payload: string) {
  return createHmac('sha256', getSigningSecret()).update(payload).digest('base64url')
}

function cookieOptions(request: Request) {
  return {
    httpOnly: true,
    maxAge: PASSWORD_RECOVERY_MAX_AGE_SECONDS,
    path: '/account/update-password',
    sameSite: 'lax' as const,
    secure: new URL(request.url).protocol === 'https:',
  }
}

export function getPasswordRecoveryGrant(request: Request): PasswordRecoveryGrant | null {
  const cookies = parseCookieHeader(request.headers.get('Cookie') ?? '')
  const value = cookies.find(cookie => cookie.name === PASSWORD_RECOVERY_COOKIE)?.value
  if (!value)
    return null

  const [encodedPayload, suppliedSignature] = value.split('.')
  if (!encodedPayload || !suppliedSignature)
    return null

  try {
    const expected = Buffer.from(sign(encodedPayload))
    const supplied = Buffer.from(suppliedSignature)
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
      return null

    const grant = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as PasswordRecoveryGrant
    if (!grant.sub || !Number.isFinite(grant.exp) || grant.exp <= Date.now())
      return null
    return grant
  }
  catch {
    return null
  }
}

export function setPasswordRecoveryGrant(headers: Headers, request: Request, userId: string) {
  const grant: PasswordRecoveryGrant = {
    sub: userId,
    exp: Date.now() + PASSWORD_RECOVERY_MAX_AGE_SECONDS * 1000,
  }
  const encodedPayload = Buffer.from(JSON.stringify(grant)).toString('base64url')
  const value = `${encodedPayload}.${sign(encodedPayload)}`
  headers.append('Set-Cookie', serializeCookieHeader(PASSWORD_RECOVERY_COOKIE, value, cookieOptions(request)))
}

export function clearPasswordRecoveryGrant(headers: Headers, request: Request) {
  headers.append('Set-Cookie', serializeCookieHeader(
    PASSWORD_RECOVERY_COOKIE,
    '',
    { ...cookieOptions(request), maxAge: 0 },
  ))
}
