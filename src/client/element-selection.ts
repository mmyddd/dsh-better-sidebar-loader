/**
 * Optional consumer side of @dsh-plugin/dsh-bettersidebar-element-selection
 * ("选择网页元素加入聊天").
 *
 * The picker lives in its OWN plugin: its client bundle publishes one object on
 * `window` (see that package's src/contract.ts) and this module is the local,
 * dependency-free copy of that contract. Nothing here imports the provider, so
 * this sidebar installs and runs with or without it — when the object is absent
 * the crosshair simply does not render.
 *
 * Why a window contract instead of a package import: the two halves are separate
 * client bundles with separate module graphs, so a value import would duplicate
 * the controller (and its React state) instead of sharing it.
 */
import { useEffect, useState } from 'react'

/** Where the provider publishes its client API. */
const GLOBAL_KEY = '__dshElementSelection__'

/** Dispatched on `window` when the API is installed or torn down. */
const READY_EVENT = 'dsh-element-selection:ready'

/**
 * One captured element, opaque to this sidebar: it is produced by the provider
 * and handed straight back to it for serialization. Only the two fields worth
 * logging are named.
 */
export interface PickedElement {
  tagName: string
  pageUrl: string
  [key: string]: unknown
}

/** A live picker session as a surface sees it. */
export interface ElementPickerHandle {
  /** The framed document answered the handshake: picking is possible. */
  ready: boolean
  /** A capture session is running right now. */
  picking: boolean
  /** Status copy for the current state (null when there is nothing to say). */
  notice: string | null
  /** Start when idle, cancel when picking. */
  toggle: () => void
  /** Cancel a running session. */
  cancel: () => void
  /** Must be called from the framed iframe's onLoad (drives the handshake). */
  handleLoad: () => void
}

/** What a surface passes when it opens a session. */
export interface ElementPickerOptions {
  frame: () => { contentWindow: unknown } | null
  onPicked: (element: PickedElement) => void
  /** The REAL page url while the frame shows the proxy's copy. */
  pageUrl?: () => string | undefined
}

/** The provider's client API (the subset this sidebar uses). */
export interface ElementSelectionApi {
  readonly version: string
  readonly proxyRoutePrefix: string
  isProxyablePage: (url: string | undefined) => boolean
  encodeProxyUrl: (target: string, token?: string, noScript?: boolean) => string
  fetchProxyToken: () => Promise<string>
  useElementPicker: (options: ElementPickerOptions) => ElementPickerHandle
  buildWebElementInsert: (element: PickedElement, draft?: string) => string
}

/** The published API, or undefined while the plugin is absent. */
export function readElementSelectionApi(): ElementSelectionApi | undefined {
  if (typeof window === 'undefined') return undefined
  const found = (window as unknown as Record<string, unknown>)[GLOBAL_KEY]
  return typeof found === 'object' && found !== null ? found as ElementSelectionApi : undefined
}

/**
 * Track the provider across bundle load order: the picker plugin's client bundle
 * may install before or after this one, so a surface subscribes instead of
 * sampling once. Re-renders when the API appears or disappears.
 */
export function useElementSelection(): ElementSelectionApi | undefined {
  const [api, setApi] = useState<ElementSelectionApi | undefined>(() => readElementSelectionApi())
  useEffect(() => {
    const sync = (): void => { setApi(readElementSelectionApi()) }
    sync()
    if (typeof window === 'undefined') return
    window.addEventListener(READY_EVENT, sync)
    return () => { window.removeEventListener(READY_EVENT, sync) }
  }, [])
  return api
}

/**
 * The stand-in used while the plugin is absent, so a surface can call ONE hook
 * unconditionally. Callers must remount when {@link useElementSelection} flips
 * between defined and undefined (key the subtree on it) — that is what keeps the
 * hook order stable within a mount.
 */
export function useAbsentPicker(): ElementPickerHandle {
  const [handle] = useState<ElementPickerHandle>(() => ({
    ready: false,
    picking: false,
    notice: null,
    toggle: () => {},
    cancel: () => {},
    handleLoad: () => {},
  }))
  return handle
}
