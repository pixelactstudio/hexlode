import { z } from 'zod'

import { COLOUR_MODES, DEFAULT_COLOUR_MODE } from '#/features/theme/constants'

export const colourModeSchema = z.enum(COLOUR_MODES).catch(DEFAULT_COLOUR_MODE)
