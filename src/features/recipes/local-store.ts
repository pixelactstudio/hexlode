import type { LocalPreferences, Recipe, RunRecord } from '#/features/recipes/types'

const DATABASE_NAME = 'hexlode-local'
const DATABASE_VERSION = 1
const RECIPE_STORE = 'recipes'
const PREFERENCE_STORE = 'preferences'
const RUN_STORE = 'runs'
const WORKSPACE_PREFERENCE_KEY = 'workspace'
const RUN_HISTORY_LIMIT = 50

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local storage request failed.'))
  })
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser does not support local workspace storage.'))
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(RECIPE_STORE)) {
        database.createObjectStore(RECIPE_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(PREFERENCE_STORE)) {
        database.createObjectStore(PREFERENCE_STORE)
      }
      if (!database.objectStoreNames.contains(RUN_STORE)) {
        database.createObjectStore(RUN_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Local storage could not open.'))
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase()
  try {
    return await requestResult(
      operation(database.transaction(storeName, mode).objectStore(storeName)),
    )
  } finally {
    database.close()
  }
}

export function listRecipes() {
  return withStore<Recipe[]>(RECIPE_STORE, 'readonly', (store) => store.getAll()).then((recipes) =>
    recipes.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  )
}

export function saveRecipe(recipe: Recipe) {
  return withStore<IDBValidKey>(RECIPE_STORE, 'readwrite', (store) => store.put(recipe)).then(
    () => recipe,
  )
}

export function deleteRecipe(id: string) {
  return withStore<undefined>(RECIPE_STORE, 'readwrite', (store) => store.delete(id))
}

export function loadPreferences() {
  return withStore<LocalPreferences | undefined>(PREFERENCE_STORE, 'readonly', (store) =>
    store.get(WORKSPACE_PREFERENCE_KEY),
  )
}

export function savePreferences(preferences: LocalPreferences) {
  return withStore<IDBValidKey>(PREFERENCE_STORE, 'readwrite', (store) =>
    store.put(preferences, WORKSPACE_PREFERENCE_KEY),
  )
}

export async function saveRun(record: RunRecord) {
  await withStore<IDBValidKey>(RUN_STORE, 'readwrite', (store) => store.put(record))
  const records = await listRuns()
  await Promise.all(records.slice(RUN_HISTORY_LIMIT).map(({ id }) => deleteRun(id)))
}

export function listRuns() {
  return withStore<RunRecord[]>(RUN_STORE, 'readonly', (store) => store.getAll()).then((records) =>
    records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  )
}

function deleteRun(id: string) {
  return withStore<undefined>(RUN_STORE, 'readwrite', (store) => store.delete(id))
}
