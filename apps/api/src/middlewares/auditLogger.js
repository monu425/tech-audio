import { writeAuditLog } from '../modules/admin/audit.service.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const ACTION_VERBS = {
  transition: 'transition',
  status: 'status',
  refund: 'refund',
  capture: 'payment',
  role: 'role',
  archive: 'archive',
  restore: 'restore',
  revoke: 'revoke',
  verify: 'verify',
  adjust: 'adjust',
  inventory: 'stock',
  return: 'return',
  approve: 'approve',
  reject: 'reject',
  activate: 'activate',
  deactivate: 'deactivate',
  assign: 'assign',
  cancel: 'cancel'
}

function verbForMethod(method) {
  switch (method) {
    case 'POST':
      return 'create'
    case 'PATCH':
    case 'PUT':
      return 'update'
    case 'DELETE':
      return 'delete'
    default:
      return String(method ?? '').toLowerCase()
  }
}

function resourceRoot(routePath) {
  const segment = (routePath ?? '').split('/').filter(Boolean)[0] ?? 'unknown'
  const clean = segment.replace(/^:/, '')
  return clean.endsWith('ies') ? `${clean.slice(0, -3)}y` : clean.replace(/s$/, '')
}

function actionVerb(routePath, method) {
  const segments = (routePath ?? '').split('/').filter(Boolean)
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const key = segments[i].replace(/^:/, '').toLowerCase()
    if (ACTION_VERBS[key]) return ACTION_VERBS[key]
  }
  return verbForMethod(method)
}

function pickResourceId(params) {
  if (!params) return null
  const direct = params.id ?? params.productId ?? params.orderId ?? params.customerId
  if (direct) return direct
  const entry = Object.entries(params).find(([key]) => /id$/i.test(key))
  return entry ? entry[1] : null
}

/**
 * Records a persisted audit entry for every successful (2xx/3xx)
 * state-changing admin request. Secrets are stripped before storage.
 */
export function auditLogger(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next()

  const routePath = req.route?.path ?? req.path
  const resource = resourceRoot(routePath)
  const action = `${resource}.${actionVerb(routePath, req.method)}`

  let capturedResourceId = null
  const originalJson = res.json.bind(res)
  res.json = (body) => {
    const data = body && typeof body === 'object' ? body.data : null
    if (data && typeof data === 'object' && data.id != null) {
      capturedResourceId = String(data.id)
    }
    return originalJson(body)
  }

  res.on('finish', () => {
    if (res.statusCode >= 400 || res.statusCode < 200) return

    const body = req.body && typeof req.body === 'object' ? req.body : undefined
    const meta = body ? { input: { ...body } } : {}
    const route = req.route?.path
    if (route && route !== req.path) meta.route = route

    writeAuditLog({
      actorId: req.user?._id ?? null,
      actorName: req.user?.name ?? null,
      actorRole: req.user?.role ?? null,
      action,
      resource,
      resourceId: pickResourceId(req.params) ?? capturedResourceId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      summary: `${req.method} ${req.path}`,
      meta,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null
    }).catch(() => {})
  })

  next()
}
