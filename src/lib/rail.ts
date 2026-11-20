import { buttonArt } from '../content/buttonArt'

/*
  Desktop rail sizes, as shares of the full nav column width (--nav-w). They come from the button
  art: the wide buttons fill 80% of the column, and every button keeps that same height when the
  rail docks, so the docked square is that tall and wide, at 80% of the docked rail.
*/
const wide = buttonArt['design-wide']

/** Button height (wide and square alike). */
export const RAIL_BUTTON_H = (0.8 * wide.height) / wide.width

/** Docked rail width. */
export const RAIL_NARROW = RAIL_BUTTON_H / 0.8

/** Hovering the docked rail opens it after this long (ms), and it closes this long after the pointer leaves. */
export const RAIL_OPEN_DELAY = 0
export const RAIL_CLOSE_DELAY = 250

/** How long the rail takes to collapse / open, on scroll or hover (seconds), and its easing. */
export const RAIL_EXPAND_DURATION = 0.3
export const RAIL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

/** Scrolling back opens the rail this many pixels before the collapse point, so a scroll that
    hovers right at the point can't make it flicker. */
export const RAIL_TRIGGER_SLACK = 8

/** Above this much narrowing the buttons show their square art and can't be clicked. */
export const RAIL_COLLAPSED_AT = 0.3
