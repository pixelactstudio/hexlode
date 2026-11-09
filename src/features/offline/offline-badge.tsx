import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Token } from '@astryxdesign/core/Token'
import { AnimatePresence, motion } from 'motion/react'

import { useOnline } from '#/features/offline/use-online'

/**
 * A badge in the top bar while the browser has no network connection. Hexlode keeps working from
 * the copy the service worker saved. The status region (`output`) is always present, so screen
 * readers hear the badge arrive.
 */
export function OfflineBadge() {
  const online = useOnline()
  return (
    <output className="inline-flex">
      <AnimatePresence>
        {online ? null : (
          <motion.span
            key="offline"
            className="inline-flex overflow-hidden"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <Token
              label="Offline"
              size="sm"
              icon={<StatusDot variant="warning" label="No network connection" />}
              description="Hexlode keeps working from the copy saved on this device."
            />
          </motion.span>
        )}
      </AnimatePresence>
    </output>
  )
}
