import { describe, expect, it } from 'vitest'

import { planWorkers } from '#/features/home/worker-plan'

describe('planWorkers', () => {
  it('starts one job on every worker at once', () => {
    const jobs = planWorkers([2, 3, 1.5, 2.5, 2], 4)
    expect(jobs.slice(0, 4).map((job) => [job.worker, job.start])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ])
  })

  it('gives the next job to the worker that finishes first', () => {
    const jobs = planWorkers([2, 3, 1.5, 2.5, 2], 4)
    expect(jobs[4]).toEqual({ index: 4, worker: 2, start: 1.5, end: 3.5 })
  })

  it('never runs two jobs on one worker at the same time', () => {
    const jobs = planWorkers([1.2, 1.8, 1.5, 2.1, 1.4, 1.9, 1.6, 1.3, 2, 1.7, 1.5, 1.8], 4)
    for (let worker = 0; worker < 4; worker++) {
      const own = jobs.filter((job) => job.worker === worker)
      for (let index = 1; index < own.length; index++) {
        expect(own[index].start).toBe(own[index - 1].end)
      }
    }
    expect(jobs).toHaveLength(12)
  })
})
