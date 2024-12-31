import arc from '@/assets/palettes/arc.json'
import dark from '@/assets/palettes/dark.json'
import github from '@/assets/palettes/github.json'
import light from '@/assets/palettes/light.json'
import nord from '@/assets/palettes/nord.json'
import solarized from '@/assets/palettes/solarized.json'
import type { ColorPalettes } from '@/types/colorPaletteTypes'

import { DATATYPE_COLOR } from '@/constants/pmtCore'

export const CORE_COLOR_PALETTES: ColorPalettes = {
  dark,
  light,
  solarized,
  arc,
  nord,
  github
} as const

export const DEFAULT_COLOR_PALETTE = dark

DEFAULT_COLOR_PALETTE.colors.node_slot = {
  ...DEFAULT_COLOR_PALETTE.colors.node_slot,
  ...DATATYPE_COLOR
}
