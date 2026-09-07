export function parseDuration(value, fallbackMs) {
  if (typeof value !== 'string') return fallbackMs
  const match = /^(\d+)\s*(ms|s|m|h|d|w)?$/.exec(value.trim())
  if (!match) return fallbackMs
  const amount = Number.parseInt(match[1], 10)
  const unit = match[2] ?? 'ms'
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000
  }
  return amount * multipliers[unit]
}
