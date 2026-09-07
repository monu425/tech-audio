import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import { env } from '../../config/env.js'
import { BadRequestError } from '../../utils/errors.js'

export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

const SNIFFERS = [
  {
    ext: 'jpg',
    mime: 'image/jpeg',
    match: (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  },
  {
    ext: 'png',
    mime: 'image/png',
    match: (b) =>
      b.length > 7 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    match: (b) =>
      b.length > 11 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
  },
  {
    ext: 'gif',
    mime: 'image/gif',
    match: (b) =>
      b.length > 5 &&
      (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a')
  }
]

export function detectImageType(buffer) {
  return SNIFFERS.find((sniffer) => sniffer.match(buffer)) ?? null
}

export function resolveUploadsDir() {
  return path.resolve(env.mediaUploadDir)
}

async function ensureUploadsDir() {
  await fs.mkdir(resolveUploadsDir(), { recursive: true })
}

export async function storeImageFile({ originalname: _originalname, buffer }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new BadRequestError('Empty file received', 'MEDIA_EMPTY_FILE')
  }
  if (buffer.length > env.mediaMaxUploadBytes) {
    throw new BadRequestError('File exceeds the size limit', 'MEDIA_TOO_LARGE')
  }
  const detected = detectImageType(buffer)
  if (!detected) {
    throw new BadRequestError(
      'File content does not match a supported image type',
      'MEDIA_INVALID_CONTENT'
    )
  }
  await ensureUploadsDir()
  const filename = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${detected.ext}`
  await fs.writeFile(path.join(resolveUploadsDir(), filename), buffer, { flag: 'wx' })
  return { url: `/uploads/${filename}`, mime: detected.mime, size: buffer.length }
}
