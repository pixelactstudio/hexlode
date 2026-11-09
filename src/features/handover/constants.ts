/**
 * Files that arrive from outside a page: opened from the file manager into the installed app, or
 * shared to it on Android. See "Offline and installing" in idea.md.
 */
import type { StripToolSettings } from '#/features/quick-tools/tools'

/** Where the installed app's file handlers open: a page that asks what to do with the files. */
export const OPEN_PATH = '/open'

/** Where Android posts photos shared to the installed app. The service worker answers it. */
export const SHARE_TARGET_PATH = '/share-target'

/** The form field shared photos arrive in, as the manifest's share target names it. */
export const SHARE_FILES_FIELD = 'photos'

/** Shared photos wait in this Cache Storage cache only until their page takes them. */
export const SHARE_CACHE = 'hexlode-share'

/** Shared photos open in Strip metadata. */
export const SHARE_PAGE = '/strip-metadata'

/** Added to the address of Strip metadata when shared photos are waiting for it. */
export const SHARED_SEARCH = 'shared'

/** Shared photos are usually about to be posted somewhere, so the location comes off. */
export const SHARE_SETTINGS: StripToolSettings = { mode: 'location', keepColourProfile: true }

/** The type the manifest registers `.hexlode` files under, so the app never claims all JSON. */
export const PIPELINE_FILE_TYPE = 'application/vnd.hexlode.pipeline+json'
