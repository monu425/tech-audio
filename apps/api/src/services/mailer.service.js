import nodemailer from 'nodemailer'

import { env } from '../config/env.js'
import { createLogger } from '../config/logger.js'

const logger = createLogger('mailer')

let transporter = null

function getTransporter() {
  if (transporter) return transporter
  if (env.mailTransport === 'smtp') {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPassword } : undefined
    })
  } else {
    transporter = {
      sendMail: async (_message) => ({ messageId: 'console' })
    }
  }
  return transporter
}

async function deliver(message) {
  if (env.mailTransport === 'console') {
    logger.info(
      {
        to: message.to,
        subject: message.subject,
        transport: 'console'
      },
      'mail (console transport)'
    )
    console.log('------------ MAIL ------------')
    console.log(`To: ${message.to}`)
    console.log(`Subject: ${message.subject}`)
    console.log(message.text ?? '(html only)')
    console.log('------------------------------')
    return { messageId: 'console' }
  }
  return getTransporter().sendMail(message)
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

function wrapEmail({ title, preview, body }) {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
        <div style="background:#111111;color:#ffffff;padding:20px 24px;font-size:18px;font-weight:bold">${preview ?? 'Voltify'}</div>
        <div style="padding:24px;color:#27272a;font-size:14px;line-height:1.6">
          <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
          ${body}
        </div>
      </div>
    </div>
  </body>
</html>`
}

export async function sendVerificationOtp({ to, name, otp, ttlMinutes }) {
  const safeName = escapeHtml(name)
  const body = `
    <p>Hi ${safeName},</p>
    <p>Your verification code is:</p>
    <div style="text-align:center;margin:20px 0">
      <span style="display:inline-block;font-size:28px;font-weight:bold;letter-spacing:6px;background:#f4f4f5;padding:12px 20px;border-radius:8px">${otp}</span>
    </div>
    <p>This code expires in ${ttlMinutes} minutes. If you did not create an account, you can safely ignore this email.</p>`
  return deliver({
    to,
    subject: 'Verify your email address',
    html: wrapEmail({ title: 'Email verification', body }),
    text: `Hi ${name},\n\nYour verification code is ${otp}. It expires in ${ttlMinutes} minutes.`
  })
}

export async function sendPasswordResetOtp({ to, name, otp, ttlMinutes }) {
  const safeName = escapeHtml(name)
  const body = `
    <p>Hi ${safeName},</p>
    <p>We received a request to reset your password. Use this code:</p>
    <div style="text-align:center;margin:20px 0">
      <span style="display:inline-block;font-size:28px;font-weight:bold;letter-spacing:6px;background:#f4f4f5;padding:12px 20px;border-radius:8px">${otp}</span>
    </div>
    <p>This code expires in ${ttlMinutes} minutes. If you did not request this, you can safely ignore this email.</p>`
  return deliver({
    to,
    subject: 'Reset your password',
    html: wrapEmail({ title: 'Password reset', body }),
    text: `Hi ${name},\n\nYour password reset code is ${otp}. It expires in ${ttlMinutes} minutes.`
  })
}

export async function sendPasswordChangedNotification({ to, name }) {
  return deliver({
    to,
    subject: 'Your password was changed',
    html: wrapEmail({
      title: 'Security notice',
      body: `<p>Hi ${escapeHtml(name)},</p><p>Your password was recently changed. If this was you, no action is needed. Otherwise, please reset your password immediately and contact support.</p>`
    }),
    text: `Hi ${name}, your password was recently changed. If this wasn't you, reset it immediately.`
  })
}

function formatMoneyMinor(minor, currency) {
  const amount = (Number(minor) || 0) / 100
  if (currency === 'EUR') return `€${amount.toFixed(2)}`
  return `$${amount.toFixed(2)}`
}

const STATUS_HUMAN = {
  pending: 'is now pending confirmation',
  confirmed: 'has been confirmed',
  processing: 'is being prepared for dispatch',
  packed: 'has been packed and is ready to ship',
  shipped: 'is on its way to you',
  out_for_delivery: 'is out for delivery today',
  delivered: 'has been delivered',
  cancelled: 'has been cancelled',
  return_requested: 'has a return requested',
  returned: 'has been returned',
  refunded: 'has been refunded'
}

const PAYMENT_HUMAN = {
  pending: 'is pending',
  paid: 'has been received',
  failed: 'could not be processed',
  refunded: 'has been refunded',
  partially_refunded: 'has been partially refunded'
}

export async function sendOrderConfirmation({
  to,
  name,
  orderNumber,
  totalMinor,
  currency = 'USD',
  storeUrl = env.storeUrl
}) {
  const safeName = escapeHtml(name)
  const total = formatMoneyMinor(totalMinor, currency)
  const accountUrl = `${storeUrl}/account`
  const body = `
    <p>Hi ${safeName},</p>
    <p>Thanks for your order! We've received it and are getting it ready.</p>
    <div style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:14px 16px">
      <p style="margin:0">Order number: <strong>${escapeHtml(orderNumber)}</strong></p>
      <p style="margin:6px 0 0">Total: <strong>${total}</strong></p>
    </div>
    <p style="margin-top:16px">You can track your order any time from your
      <a href="${accountUrl}" style="color:#111111">account dashboard</a>.</p>`
  return deliver({
    to,
    subject: `Order ${orderNumber} confirmed`,
    html: wrapEmail({ title: 'Order received', body }),
    text: `Hi ${name},\n\nThanks for your order ${orderNumber}. Total: ${total}.\nYou can track it from your account at ${accountUrl}.`
  })
}

export async function sendOrderStatusUpdate({
  to,
  name,
  orderNumber,
  status,
  note,
  storeUrl = env.storeUrl
}) {
  const safeName = escapeHtml(name)
  const sentence = STATUS_HUMAN[status] ?? `status changed to ${escapeHtml(status)}`
  const safeNote = note ? escapeHtml(String(note)) : null
  const accountUrl = `${storeUrl}/account`
  const body = `
    <p>Hi ${safeName},</p>
    <p>Great news — your order <strong>${escapeHtml(orderNumber)}</strong> ${sentence}.</p>
    ${safeNote ? `<p style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:12px 14px">${safeNote}</p>` : ''}
    <p>Follow your order in your
      <a href="${accountUrl}" style="color:#111111">account dashboard</a>.</p>`
  return deliver({
    to,
    subject: `Order ${orderNumber} update`,
    html: wrapEmail({ title: 'Order update', body }),
    text: `Hi ${name},\n\nYour order ${orderNumber} ${sentence}.${note ? `\n\n${note}` : ''}`
  })
}

export async function sendOrderPaymentUpdate({
  to,
  name,
  orderNumber,
  paymentStatus,
  currency = 'USD',
  amountMinor,
  note,
  _storeUrl = env.storeUrl
}) {
  const safeName = escapeHtml(name)
  const sentence = PAYMENT_HUMAN[paymentStatus] ?? `payment status is ${escapeHtml(paymentStatus)}`
  const amount = amountMinor ? ` of ${formatMoneyMinor(amountMinor, currency)}` : ''
  const safeNote = note ? escapeHtml(String(note)) : null
  const body = `
    <p>Hi ${safeName},</p>
    <p>Your payment${amount} for order <strong>${escapeHtml(orderNumber)}</strong> ${sentence}.</p>
    ${safeNote ? `<p style="background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:12px 14px">${safeNote}</p>` : ''}
    <p>If you have any questions, reply to this email and our team will help.</p>`
  return deliver({
    to,
    subject: `Payment update for order ${orderNumber}`,
    html: wrapEmail({ title: 'Payment update', body }),
    text: `Hi ${name},\n\nYour payment${amount} for order ${orderNumber} ${sentence}.${note ? `\n\n${note}` : ''}`
  })
}
