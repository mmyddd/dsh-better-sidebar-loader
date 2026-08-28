/**
 * Append text to the current session's composer draft through the
 * conversation service — the shared path behind the explorer's @-reference
 * button and the viewer selection popup. The service is resolved lazily
 * through `ctx.get` (the inject-free read the app's own plugins use); a
 * missing service or scope degrades to a logged no-op, never a crash.
 */
import type { Context, SidebarConversation } from '../context-types.ts'

/**
 * Append `text` to the session's composer draft (space-separated, like the
 * @-mentions — a caller inserting a multi-line block passes its own
 * `separator`, e.g. a blank line). Returns false — and logs — when the
 * conversation service or the session scope is unavailable.
 */
export function appendToDraft(ctx: Context, sessionId: string, text: string, separator = ' '): boolean {
  try {
    const actx = ctx.sessions.scope(sessionId)
    if (actx === undefined) return false
    // Resolve the conversation service through dshloader's stable client
    // API (window.__dshLoader__.services.get) instead of the cordis ctx;
    // degrades to undefined when dshloader is absent.
    const conversation = (typeof window !== 'undefined' ? window.__dshLoader__?.services?.get('conversation') : undefined) as SidebarConversation | undefined
    if (conversation === undefined) return false
    const input = conversation.input.for(actx)
    const draft = input.state.getSnapshot().draft
    input.setDraft(draft.trim() === '' ? text : `${draft}${separator}${text}`)
    return true
  } catch (error) {
    console.warn('[dsh-better-sidebar] draft insert failed:', error)
    return false
  }
}

/**
 * The session's current composer draft ('' when empty or unavailable). Used by
 * the element picker to continue ZCode's `## Element N` numbering inside the
 * draft's existing `# Web page elements:` section.
 */
export function readDraft(ctx: Context, sessionId: string): string {
  try {
    const actx = ctx.sessions.scope(sessionId)
    if (actx === undefined) return ''
    const conversation = (typeof window !== 'undefined' ? window.__dshLoader__?.services?.get('conversation') : undefined) as SidebarConversation | undefined
    if (conversation === undefined) return ''
    return conversation.input.for(actx).state.getSnapshot().draft
  } catch {
    return ''
  }
}
