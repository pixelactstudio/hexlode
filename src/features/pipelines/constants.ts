export const PIPELINE_FILE_FORMAT = 'hexlode-pipeline'
export const PIPELINE_FILE_VERSION = 1
export const PIPELINE_FILE_EXTENSION = '.hexlode'
export const PIPELINE_FILE_MIME = 'application/json'
export const SAVED_PIPELINES_KEY = 'hexlode:pipelines'
export const MAX_PIPELINE_NAME_LENGTH = 80
export const SAVE_NOTICE =
  'Saved in this browser only. Clearing site data deletes it; export a .hexlode file to keep a backup.'
/** The pipeline open in this tab's Studio, in session storage, so a reload does not lose it. */
export const STUDIO_DRAFT_KEY = 'hexlode:studio-draft'
/** Identifies a tab, in its session storage, so it only clears the recovery copy it wrote. */
export const STUDIO_TAB_KEY = 'hexlode:studio-tab'
/** The last pipeline with unsaved changes from any tab, in local storage, for a new tab to offer. */
export const STUDIO_RECOVERY_KEY = 'hexlode:studio-recovery'
/** A new tab offers unsaved changes for this long after they were made. */
export const DRAFT_RECOVERY_MAX_AGE_MS = 24 * 60 * 60 * 1000
/** Where earlier versions kept one draft for the whole browser, in local storage. */
export const LEGACY_STUDIO_DRAFT_KEY = STUDIO_DRAFT_KEY
