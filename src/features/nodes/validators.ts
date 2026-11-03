import { z } from 'zod'

import { HEX_COLOUR } from '#/features/images/colour'

/** A `#rrggbb` or `#rrggbbaa` colour setting. */
export const colour = (value: string) =>
  z
    .string()
    .regex(HEX_COLOUR)
    .transform((hex) => hex.toLowerCase())
    .default(value)
