export interface LocalInputFile {
  file: File
  relativePath: string
}

interface FolderPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}

async function collectFiles(
  directory: FileSystemDirectoryHandle,
  path: string,
  files: LocalInputFile[],
) {
  for await (const handle of directory.values()) {
    const relativePath = path ? `${path}/${handle.name}` : handle.name
    if (handle.kind === 'directory') await collectFiles(handle, relativePath, files)
    else files.push({ file: await handle.getFile(), relativePath })
  }
}

export function canPickFolder() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function pickFolderImages() {
  const picker = (window as FolderPickerWindow).showDirectoryPicker
  if (!picker) throw new Error('Folder selection is not supported in this browser.')

  const directory = await picker()
  const files: LocalInputFile[] = []
  await collectFiles(directory, '', files)
  return files.filter(({ file }) => file.type === 'image/jpeg' || file.type === 'image/png')
}
