import { getCurrentScope, onScopeDispose, ref } from 'vue'

// A phone: a small screen with no hover-capable pointer. 640px is Tailwind's
// own `sm` breakpoint, already the project's line between "small screen" and
// everything larger; `hover: none` + `pointer: coarse` is touch-primary, so a
// narrow desktop window with a mouse is not caught by this, and neither is a
// touch-primary tablet whose screen is wider than the line.
const SMALL_SCREEN_QUERY = '(max-width: 640px)'
const TOUCH_PRIMARY_QUERY = '(hover: none) and (pointer: coarse)'

/**
 * Reactive phone classification, live: it follows `matchMedia` changes, so
 * rotating a phone or docking a keyboard to a device that flips `hover`
 * updates it without a reload.
 *
 * Whether a device has a physical keyboard attached cannot be read from the
 * browser at all — this only ever answers "is this a phone", never "does
 * this have a keyboard". Callers that need the latter fall back to a
 * learner-set override instead.
 *
 * Without `matchMedia` (no `window`, or an environment that doesn't provide
 * it) this reports `false` — the safer default per design.md, since it
 * leaves the OS virtual keyboard available rather than removing a learner's
 * only way to type.
 */
export function useIsPhone() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return ref(false)
  }

  const smallScreen = window.matchMedia(SMALL_SCREEN_QUERY)
  const touchPrimary = window.matchMedia(TOUCH_PRIMARY_QUERY)

  const isPhone = ref(smallScreen.matches && touchPrimary.matches)

  const update = () => {
    isPhone.value = smallScreen.matches && touchPrimary.matches
  }

  smallScreen.addEventListener('change', update)
  touchPrimary.addEventListener('change', update)

  // Only torn down when running inside an active effect scope (a component's
  // setup, or a Pinia store's) — a plain call site with no scope to attach to
  // keeps the listeners for its own lifetime instead of warning about it.
  if (getCurrentScope()) {
    onScopeDispose(() => {
      smallScreen.removeEventListener('change', update)
      touchPrimary.removeEventListener('change', update)
    })
  }

  return isPhone
}
