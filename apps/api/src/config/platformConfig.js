import { env } from './env.js'
import PlatformSetting from '../modules/admin/platformSetting.model.js'

let cache = null
let loaded = false
let loading = null

async function ensureLoaded() {
  if (loaded || cache) return
  if (loading) return loading
  loading = (async () => {
    try {
      const doc = await PlatformSetting.findOne({ key: 'platform' }).lean()
      cache = doc?.value ?? {}
    } finally {
      loaded = true
      loading = null
    }
  })()
  return loading
}

export async function loadPlatformSettings() {
  await ensureLoaded()
  return cache
}

export async function getPlatformSettings() {
  await ensureLoaded()
  return cache ?? {}
}

export async function updatePlatformSettings(patch) {
  await ensureLoaded()
  const next = { ...(cache ?? {}), ...patch }
  cache = next
  await PlatformSetting.updateOne({ key: 'platform' }, { $set: { value: next } }, { upsert: true })
  return next
}

export function getTaxRatePercent() {
  const value = Number(cache?.taxRatePercent)
  return Number.isFinite(value) ? value : env.taxRatePercent
}

export function getStoreInfo() {
  return {
    storeName: cache?.storeName ?? 'Voltify',
    storeEmail: cache?.storeEmail ?? 'support@voltify.local'
  }
}
