type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function consumeRateLimit(key: string, windowMs: number, max: number) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetMs: windowMs }
  }
  if (b.count < max) {
    b.count += 1
    return { allowed: true, remaining: max - b.count, resetMs: b.resetAt - now }
  }
  return { allowed: false, remaining: 0, resetMs: b.resetAt - now }
}