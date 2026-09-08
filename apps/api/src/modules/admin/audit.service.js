import AuditLog from './audit.model.js'
import { BadRequestError } from '../../utils/errors.js'

// Never persist secrets or authentication material of any kind.
const SENSITIVE_KEY = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'otp',
  'code',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'secret',
  'authorization',
  'setCookie'
])

const MAX_META_CHARS = 6000

function sanitizeMeta(value, depth = 0) {
  if (depth > 3) return undefined
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeMeta(item, depth + 1))
  }
  if (typeof value === 'object') {
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      if (SENSITIVE_KEY.has(key)) continue
      const clean = sanitizeMeta(item, depth + 1)
      if (clean !== undefined) out[key] = clean
    }
    return out
  }
  return undefined
}

function truncate(value) {
  if (typeof value !== 'string') return value
  return value.length > MAX_META_CHARS ? `${value.slice(0, MAX_META_CHARS)}…[truncated]` : value
}

export async function writeAuditLog(entry) {
  const doc = {
    actorId: entry.actorId ?? null,
    actorName: entry.actorName ?? null,
    actorRole: entry.actorRole ?? null,
    action: entry.action,
    resource: entry.resource ?? null,
    resourceId: entry.resourceId ?? null,
    method: entry.method ?? null,
    path: entry.path ?? null,
    status: entry.status ?? 200,
    summary: entry.summary ?? null,
    meta: sanitizeMeta(entry.meta) ?? {},
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ? truncate(entry.userAgent) : null
  }
  const stored = await AuditLog.create(doc)
  return stored
}

function toAuditLogDto(log) {
  return {
    id: log._id.toString(),
    actorId: log.actorId ? log.actorId.toString() : null,
    actorName: log.actorName,
    actorRole: log.actorRole,
    action: log.action,
    resource: log.resource,
    resourceId: log.resourceId,
    method: log.method,
    path: log.path,
    status: log.status,
    summary: log.summary,
    meta: log.meta ?? {},
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt
  }
}

export async function listAuditLogs({ page = 1, pageSize = 20, actorId, resource, action }) {
  const filter = {}
  if (actorId) filter.actorId = actorId
  if (resource) filter.resource = resource
  if (action) {
    filter.action = action.endsWith('.*') ? new RegExp(`^${action.replace('.*', '\\..*')}`) : action
  }

  const [items, totalItems] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    AuditLog.countDocuments(filter)
  ])

  return {
    items: items.map(toAuditLogDto),
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
    }
  }
}

export function validateAuditQuery(query) {
  if (query.actorId && !/^[a-f\d]{24}$/i.test(query.actorId)) {
    throw new BadRequestError('Invalid actorId', 'INVALID_FILTER')
  }
}
