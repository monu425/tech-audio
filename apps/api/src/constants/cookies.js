import { env } from '../config/env.js'

export const ACCESS_COOKIE = 'access_token'
export const REFRESH_COOKIE = 'refresh_token'
export const CSRF_COOKIE = 'csrf_token'

function baseCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
    maxAge: maxAgeMs
  }
}

export function accessTokenMaxAgeMs() {
  const expiresIn = env.accessTokenExpiresIn
  if (/^\d+[m]$/.test(expiresIn)) return Number.parseInt(expiresIn, 10) * 60_000
  return 15 * 60_000
}

export function refreshTokenMaxAgeMs() {
  const expiresIn = env.refreshTokenExpiresIn
  if (/^\d+[m]$/.test(expiresIn)) return Number.parseInt(expiresIn, 10) * 60_000
  if (/^\d+[d]$/.test(expiresIn)) return Number.parseInt(expiresIn, 10) * 86_400_000
  return 7 * 86_400_000
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, baseCookieOptions(accessTokenMaxAgeMs()))
  res.cookie(REFRESH_COOKIE, refreshToken, baseCookieOptions(refreshTokenMaxAgeMs()))
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, baseCookieOptions(refreshTokenMaxAgeMs()))
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' })
  res.clearCookie(REFRESH_COOKIE, { path: '/' })
}
