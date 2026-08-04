const MAX_SEARCH_ATTEMPTS = 7

export interface ConstraintAttempt {
  quality: number
  size: number
}

export interface ConstraintResult {
  attempts: ConstraintAttempt[]
  best: ConstraintAttempt | null
}

export async function solveQualityConstraint(
  maxBytes: number,
  encode: (quality: number) => Promise<number>,
  isCancelled: () => boolean,
): Promise<ConstraintResult> {
  let low = 1
  let high = 100
  let best: ConstraintAttempt | null = null
  const attempts: ConstraintAttempt[] = []

  while (low <= high && attempts.length < MAX_SEARCH_ATTEMPTS) {
    if (isCancelled()) throw new Error('Constraint search cancelled.')

    const quality = Math.floor((low + high) / 2)
    const attempt = { quality, size: await encode(quality) }
    attempts.push(attempt)
    if (attempt.size <= maxBytes) {
      best = attempt
      low = quality + 1
    } else {
      high = quality - 1
    }
  }

  return { attempts, best }
}
