/**
 * What the page knows about running on-device models here: which models are kept in this browser
 * and how long downloading, starting and running them should take, for estimates.
 */
import {
  ASSUMED_DOWNLOAD_BYTES_PER_SECOND,
  MODEL_RUN_MS,
  MODEL_START_MS,
} from '#/features/background-removal/constants'
import { inferenceHost } from '#/features/background-removal/inference-host'
import { preferredBackend } from '#/features/background-removal/inference-session'
import { hasStoredModel } from '#/features/background-removal/model-files'
import type { InferenceBackend, SegmentationModel } from '#/features/background-removal/types'
import type { ModelTiming } from '#/features/engine/estimate'

/** A model a pipeline needs, and whether this browser has it. */
export interface ModelNeed {
  id: string
  bytes: number
  stored: boolean
}

export async function modelNeeds(
  ids: string[],
  models: Record<string, SegmentationModel>,
): Promise<ModelNeed[]> {
  return Promise.all(
    ids.flatMap((id) => {
      const model = models[id]
      if (!model) return []
      return [
        hasStoredModel(model)
          .catch(() => false)
          .then((stored) => ({ id, bytes: model.bytes, stored })),
      ]
    }),
  )
}

let guessed: Promise<InferenceBackend> | undefined

/** Measured times once the model ran in this page; typical times for the backend before that. */
export async function modelTimings(needs: ModelNeed[]): Promise<Record<string, ModelTiming>> {
  if (needs.length === 0) return {}
  const stats = inferenceHost().stats()
  guessed ??= preferredBackend()
  const backend = stats.backend ?? (await guessed)
  return Object.fromEntries(
    needs.map((need) => [
      need.id,
      {
        msPerRun: stats.runs > 0 ? stats.runMs / stats.runs : MODEL_RUN_MS[backend],
        startMs: stats.startMs === null ? MODEL_START_MS[backend] : 0,
        download: need.stored
          ? undefined
          : { bytes: need.bytes, ms: (need.bytes / ASSUMED_DOWNLOAD_BYTES_PER_SECOND) * 1000 },
      },
    ]),
  )
}
