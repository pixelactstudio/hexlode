import { Center } from '@astryxdesign/core/Center'
import { VStack } from '@astryxdesign/core/Stack'
import type { ReactNode } from 'react'

import { PAGE_WIDTH } from '#/features/app-shell/constants'

/** The centred column every page but the Studio uses, lined up with the top bar and footer. */
export function PageColumn({
  children,
  gap = 8,
  paddingBlock = 10,
}: {
  children: ReactNode
  gap?: 4 | 6 | 8 | 10
  paddingBlock?: 6 | 10
}) {
  return (
    <Center axis="horizontal">
      <VStack
        width="100%"
        maxWidth={PAGE_WIDTH + 48}
        gap={gap}
        paddingInline={6}
        paddingBlock={paddingBlock}
      >
        {children}
      </VStack>
    </Center>
  )
}
