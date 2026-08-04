import { downloadZip } from 'client-zip'

export interface OutputFile {
  blob: Blob
  name: string
}

interface FolderPickerWindow extends Window {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
}

export async function createOutputArchive(outputs: OutputFile[]) {
  return downloadZip(
    outputs.map(({ blob, name }) => ({ input: blob, name, size: blob.size })),
  ).blob()
}

async function resolveDirectory(root: FileSystemDirectoryHandle, path: string[]) {
  let directory = root
  for (const name of path) {
    directory = await directory.getDirectoryHandle(name, { create: true })
  }
  return directory
}

export async function writeOutputsToFolder(outputs: OutputFile[]) {
  const picker = (window as FolderPickerWindow).showDirectoryPicker
  if (!picker) throw new Error('Folder output is not supported in this browser.')

  const root = await picker()
  for (const output of outputs) {
    const path = output.name.split('/')
    const fileName = path.pop()
    if (!fileName) continue

    const directory = await resolveDirectory(root, path)
    const handle = await directory.getFileHandle(fileName, { create: true })
    const writable = await handle.createWritable()
    try {
      await writable.write(output.blob)
      await writable.close()
    } catch (reason) {
      await writable.abort(reason)
      throw reason
    }
  }
}
