/**
 * Optional HOST side of @dsh-plugin/dsh-bettersidebar-element-selection.
 *
 * The picker's own plugin publishes an injector on the Node realm; this module
 * is the local, dependency-free copy of that contract. When the plugin is
 * mounted, the /sidebar/html previewer pipes its documents through
 * `injectPickerBridge` and they become pickable; when it is not, the previewer
 * serves them untouched. No import, no dependency, no load-order requirement.
 */

/** Where the provider's host half publishes its API. */
const HOST_GLOBAL_KEY = '__dshElementSelectionHost__'

/** The provider's host API (the subset this sidebar uses). */
export interface ElementSelectionHostApi {
  readonly version: string
  readonly proxyRoutePrefix: string
  /** Idempotent: a document that already carries the bridge comes back as-is. */
  injectPickerBridge: (html: string) => string
}

/** The published host API, or undefined when the plugin is not mounted. */
export function readElementSelectionHostApi(): ElementSelectionHostApi | undefined {
  const found = (globalThis as unknown as Record<string, unknown>)[HOST_GLOBAL_KEY]
  return typeof found === 'object' && found !== null ? found as ElementSelectionHostApi : undefined
}

/**
 * Inject the picker bridge when the plugin is mounted, otherwise return the
 * document unchanged.
 * @param html - the document this sidebar is about to serve.
 */
export function withPickerBridge(html: string): string {
  const api = readElementSelectionHostApi()
  if (api === undefined) return html
  try {
    return api.injectPickerBridge(html)
  } catch {
    // A broken provider must never break the previewer.
    return html
  }
}
