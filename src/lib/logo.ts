// The Ivy mark as 11 centre-line strokes (33 units wide, round caps), traced from the original artwork.
// Ordered trunk first, then mirrored branch pairs from top to bottom. Every path starts at the
// trunk end and finishes at the tip, so draw-on animations grow the tree upward and outward.
// public/ivy-logo.svg and the PWA icons are generated from the same data: scripts/build-logo-assets.py

export const LOGO_VIEWBOX = { x: 116, y: 72, w: 600, h: 616 } as const
export const LOGO_VIEWBOX_ATTR = `${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`
export const LOGO_STROKE = 33

export const LOGO_GROUPS: readonly (readonly string[])[] = [
  ['M416 653V103'],
  ['M355 275V167', 'M477 275V167'],
  ['M416 400Q413 378 402 344C385 290 339 256 281 223', 'M416 400Q419 378 430 344C447 290 493 256 551 223'],
  ['M349 595V431C346 356 296 300 237 275', 'M483 595V431C486 356 536 300 595 275'],
  ['M286 528V452C285 389 250 351 187 326', 'M546 528V452C547 389 582 351 645 326'],
  ['M226 459V449C219 408 197 378 149 379', 'M606 459V449C613 408 635 378 683 379'],
]

/** Flat list, trunk first then pairs (left, right) from top to bottom. */
export const TRACE_PATHS: readonly string[] = LOGO_GROUPS.flat()

export const GOLD = '#C99A30'
export const GOLD_LIGHT = '#E3C06A'
export const GOLD_DARK = '#9E7620'
