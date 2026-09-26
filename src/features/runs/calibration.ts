/**
 * Learns how this device compares with the cost model, from finished runs in this session.
 */
const MIN_ESTIMATE_SECONDS = 2
let factor = 1

export function speedFactor() {
  return factor
}

export function recordRunSpeed(estimatedSeconds: number, actualSeconds: number) {
  if (estimatedSeconds < MIN_ESTIMATE_SECONDS || actualSeconds <= 0) return
  const measured = Math.min(5, Math.max(0.2, (actualSeconds / estimatedSeconds) * factor))
  factor = factor * 0.5 + measured * 0.5
}
