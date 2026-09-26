export interface LocalInputFile {
  file: File
  relativePath: string
}

interface FolderPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<FileSystemDirectoryHandle>
}

async function collectFiles(
  directory: FileSystemDirectoryHandle,
  path: string,
  files: LocalInputFile[],
) {
  for await (const handle of (
    directory as unknown as { values(): AsyncIterable<FileSystemHandle> }
  ).values()) {
    if (handle.name.startsWith('.')) continue
    const relativePath = path ? `${path}/${handle.name}` : handle.name
    if (handle.kind === 'directory') {
      await collectFiles(handle as FileSystemDirectoryHandle, relativePath, files)
    } else {
      files.push({ file: await (handle as FileSystemFileHandle).getFile(), relativePath })
    }
  }
}

export function canPickFolder() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/** Every file in a folder the user picks, with paths relative to it. */
export async function pickFolderFiles() {
  const picker = (window as FolderPickerWindow).showDirectoryPicker
  if (!picker) throw new Error('Folder selection is not supported in this browser.')
  const directory = await picker()
  const files: LocalInputFile[] = []
  await collectFiles(directory, directory.name, files)
  return files
}

/** A folder the user picks to receive delivered files. */
export async function pickOutputFolder() {
  const picker = (window as FolderPickerWindow).showDirectoryPicker
  if (!picker) throw new Error('Saving to a folder is not supported in this browser.')
  return picker({ mode: 'readwrite' })
}

/** Files from an `<input webkitdirectory>` fallback. */
export function filesFromInput(list: FileList) {
  return [...list]
    .filter((file) => !file.name.startsWith('.'))
    .map((file) => ({
      file,
      relativePath:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }))
}
