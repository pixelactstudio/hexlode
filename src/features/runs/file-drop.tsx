import { Button } from '@astryxdesign/core/Button'
import { FileInput } from '@astryxdesign/core/FileInput'
import { Icon } from '@astryxdesign/core/Icon'
import { HStack } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { FolderOpen } from 'lucide-react'
import { useRef } from 'react'

import {
  canPickFolder,
  filesFromInput,
  type LocalInputFile,
  pickFolderFiles,
} from '#/features/image-input/folder'

const AREA = {
  md: 'block',
  lg: 'block [&_.astryx-file-input.dropzone]:min-h-36 lg:[&_.astryx-file-input.dropzone]:min-h-56',
  fill: 'flex min-h-48 flex-1 flex-col lg:min-h-72 [&>*]:flex-1 [&_.astryx-field>div]:flex-1 [&_.astryx-file-input.dropzone]:flex-1',
}

export const IMAGE_ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.avif,.jxl,.qoi'

/** A drop area for images plus a folder picker. Files are handed on, never kept here. */
export function FileDrop({
  onFiles,
  isDisabled,
  description = 'JPEG, PNG, WebP, AVIF, JPEG XL or QOI',
  size = 'lg',
}: {
  onFiles: (files: LocalInputFile[]) => void
  isDisabled?: boolean
  description?: string
  /**
   * 'fill' grows to the height of a tool page's panel, 'lg' is a tall fixed area and 'md' fits
   * the Studio inspector or a panel that already lists images.
   */
  size?: 'md' | 'lg' | 'fill'
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
    <span className={`flex flex-col gap-2 ${size === 'fill' ? 'flex-1' : ''}`}>
      <span className={AREA[size]}>
        <FileInput
          label="Images"
          isLabelHidden
          mode="dropzone"
          isMultiple
          accept={IMAGE_ACCEPT}
          value={[]}
          isDisabled={isDisabled}
          placeholder="Drop images here or choose files"
          onChange={(files) => {
            const list = Array.isArray(files) ? files : files ? [files] : []
            onFiles(list.map((file) => ({ file, relativePath: file.name })))
          }}
        />
      </span>
      <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
        <Text type="supporting">{description}</Text>
        <Button
          label="Add a folder"
          size="sm"
          variant="ghost"
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
    </span>
  )
}
