import { Center } from '@astryxdesign/core/Center'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Icon } from '@astryxdesign/core/Icon'
import { Lock, MonitorX } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

import { engineProblem } from '#/features/runs/engine-runtime'
import { track } from '#/features/usage/usage'

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

/**
 * Renders its children, and swaps them for an explanation once the browser turns out unable to
 * run the engine. The server and the first paint show the children, so the page never waits for
 * the check.
 */
export function EngineGate({ children }: { children: ReactNode }) {
  const [problem, setProblem] = useState<ReturnType<typeof engineProblem>>(null)
  useEffect(() => {
    const found = engineProblem()
    setProblem(found)
    if (found) track('engine_unavailable', { reason: found })
  }, [])
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
