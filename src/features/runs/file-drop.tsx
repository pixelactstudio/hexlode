import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack, VStack } from '@astryxdesign/core/Stack'
import { FolderOpen } from 'lucide-react'
import { useRef } from 'react'

import {
  canPickFolder,
  filesFromInput,
  type LocalInputFile,
  pickFolderFiles,
} from '#/features/image-input/folder'

export const IMAGE_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.avif,.jxl,.qoi'
const FORMAT_BADGES = ['JPEG', 'PNG', 'WebP', 'AVIF', 'JPEG XL', 'QOI']

/** A drop area for images plus a folder picker. Files are handed on, never kept here. */
export function FileDrop({
  onFiles,
  isDisabled,
  description = 'JPEG, PNG, WebP, AVIF, JPEG XL or QOI. Nothing leaves this device.',
  size = 'lg',
}: {
  onFiles: (files: LocalInputFile[]) => void
  isDisabled?: boolean
  description?: string
  /** 'lg' is a tall drop area for tool pages; 'md' fits the Studio inspector. */
  size?: 'md' | 'lg'
}) {
  const folderInput = useRef<HTMLInputElement>(null)
  const addFolder = async () => {
    if (!canPickFolder()) {
      folderInput.current?.click()
      return
    }
    try {
      onFiles(await pickFolderFiles())
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      throw reason
    }
  }
  return (
    <VStack gap={3}>
      <span className={size === 'lg' ? 'block [&_.astryx-file-input.dropzone]:min-h-48' : 'block'}>
        <FileInput
          label="Images"
          isLabelHidden
          mode="dropzone"
          isMultiple
          accept={IMAGE_ACCEPT}
          value={[]}
          isDisabled={isDisabled}
          placeholder="Drop images here or choose files"
          description={description}
          onChange={(files) => {
            const list = Array.isArray(files) ? files : files ? [files] : []
            onFiles(list.map((file) => ({ file, relativePath: file.name })))
          }}
        />
      </span>
      <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
        {size === 'lg' ? (
          <HStack gap={1} wrap="wrap">
            {FORMAT_BADGES.map((format) => (
              <Badge key={format} label={format} />
            ))}
          </HStack>
        ) : null}
        <Button
          label="Add a folder"
          size="sm"
          icon={<Icon icon={FolderOpen} size="sm" />}
          onClick={addFolder}
          isDisabled={isDisabled}
        />
      </HStack>
      <input
        ref={folderInput}
        type="file"
        hidden
        multiple
        {...{ webkitdirectory: '' }}
        onChange={(event) => {
          if (event.target.files) onFiles(filesFromInput(event.target.files))
          event.target.value = ''
        }}
      />
    </VStack>
  )
}
