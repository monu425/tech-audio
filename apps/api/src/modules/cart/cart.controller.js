import crypto from 'node:crypto'
import { sendSuccess } from '../../utils/respond.js'
import { env } from '../../config/env.js'
import {
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCartContents,
  setCartCoupon,
  removeCartCoupon,
  getCartByUser,
  getCartByGuest,
  mergeGuestCartIntoUser,
  GUEST_CART_COOKIE,
  GUEST_CART_MAX_AGE,
  emptyCartDto
} from './cart.service.js'

function guestTokenFrom(req) {
  return req.cookies?.[GUEST_CART_COOKIE] ?? req.cartToken ?? null
}

function issueGuestToken(res) {
  const token = crypto.randomBytes(24).toString('base64url')
  res.cookie(GUEST_CART_COOKIE, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
    maxAge: GUEST_CART_MAX_AGE
  })
  return token
}

export function clearGuestCartCookie(res) {
  res.clearCookie(GUEST_CART_COOKIE, { path: '/' })
}

// Middleware: ensures req.cartToken is set, generating + storing a cookie for guests.
export function attachGuestCartToken(req, res, next) {
  let token = guestTokenFrom(req)
  if (!token && !req.user) {
    token = issueGuestToken(res)
  }
  req.cartToken = token
  next()
}

// Middleware: authenticated visitors with a leftover guest cart get it merged once.
export async function maybeMergeGuestCart(req, _res, next) {
  if (req.user && req.cartToken) {
    try {
      await mergeGuestCartIntoUser(req.user, req.cartToken)
      clearGuestCartCookie(_res)
      req.cartToken = null
    } catch {
      // Guest cart is best-effort; a merge failure should never break authenticated requests.
    }
  }
  next()
}

function parseActionContext(req) {
  return {
    user: req.user?._id ?? null,
    guestToken: req.user ? null : req.cartToken
  }
}

export async function getCartHandler(req, res, next) {
  try {
    const ctx = parseActionContext(req)
    const data = ctx.user
      ? await getCartByUser(ctx.user)
      : ctx.guestToken
        ? await getCartByGuest(ctx.guestToken)
        : emptyCartDto()
    return sendSuccess(res, { message: 'Cart fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function addItemHandler(req, res, next) {
  try {
    const ctx = parseActionContext(req)
    if (!ctx.user && !ctx.guestToken) {
      ctx.guestToken = issueGuestToken(res)
    }
    const data = await addToCart({
      user: ctx.user,
      guestToken: ctx.guestToken,
      productId: req.body.productId,
      variantId: req.body.variantId ?? null,
      quantity: req.body.quantity
    })
    return sendSuccess(res, { message: 'Added to cart', data })
  } catch (err) {
    next(err)
  }
}

export async function updateItemHandler(req, res, next) {
  try {
    const ctx = parseActionContext(req)
    const data = await updateCartItem({
      user: ctx.user,
      guestToken: ctx.guestToken,
      productId: req.body.productId,
      variantId: req.body.variantId ?? null,
      quantity: req.body.quantity
    })
    return sendSuccess(res, { message: 'Cart updated', data })
  } catch (err) {
    next(err)
  }
}

export async function removeItemHandler(req, res, next) {
  try {
    const ctx = parseActionContext(req)
    const data = await removeCartItem({
      user: ctx.user,
      guestToken: ctx.guestToken,
      productId: req.body.productId,
      variantId: req.body.variantId ?? null
    })
    return sendSuccess(res, { message: 'Item removed from cart', data })
  } catch (err) {
    next(err)
  }
}

export async function clearCartHandler(req, res, next) {
  try {
    const ctx = parseActionContext(req)
    await clearCartContents({ user: ctx.user, guestToken: ctx.guestToken })
    return sendSuccess(res, { message: 'Cart cleared', data: emptyCartDto() })
  } catch (err) {
    next(err)
  }
}

export async function applyCouponHandler(req, res, next) {
  try {
    const ctx = parseActionContext(req)
    const data = await setCartCoupon({
      user: ctx.user,
      guestToken: ctx.guestToken,
      code: req.body.code
    })
    return sendSuccess(res, { message: 'Coupon applied', data })
  } catch (err) {
    next(err)
  }
}

export async function removeCouponHandler(req, res, next) {
  try {
    const ctx = parseActionContext(req)
    const data = await removeCartCoupon({ user: ctx.user, guestToken: ctx.guestToken })
    return sendSuccess(res, { message: 'Coupon removed', data })
  } catch (err) {
    next(err)
  }
}
