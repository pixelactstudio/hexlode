import { Center } from '@astryxdesign/core/Center'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { Lock, MonitorX } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

import { engineProblem } from '#/features/runs/engine-runtime'

const MESSAGES = {
  insecure: {
    icon: Lock,
    title: 'Open Hexlode over HTTPS',
    description:
      'This page was opened over plain HTTP, so the browser turns off the private storage Hexlode processes images in. Open it over HTTPS, or at localhost on this computer.',
  },
  unsupported: {
    icon: MonitorX,
    title: 'This browser cannot run Hexlode',
    description:
      'Hexlode needs Web Workers and the Origin Private File System. Use a current Chrome, Edge, Firefox or Safari.',
  },
}

/** Renders its children only in a browser that can run the engine; explains why otherwise. */
export function EngineGate({ children }: { children: ReactNode }) {
  const [problem, setProblem] = useState<ReturnType<typeof engineProblem> | undefined>()
  useEffect(() => setProblem(engineProblem()), [])
  if (problem === undefined) return null
  if (problem === null) return children
  const message = MESSAGES[problem]
  return (
    <Center height="100%" minHeight={400}>
      <EmptyState
        icon={<Icon icon={message.icon} size="lg" color="secondary" />}
        title={message.title}
        description={message.description}
      />
    </Center>
  )
}
