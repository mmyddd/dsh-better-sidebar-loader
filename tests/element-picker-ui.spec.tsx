/**
 * Element-picker UI spec, now that the picker itself lives in its own plugin
 * (@dsh-plugin/dsh-bettersidebar-element-selection): both web surfaces render the
 * "选择网页元素加入聊天" toggle ONLY while that plugin's client API is published,
 * and the toggle starts DISABLED with the cross-origin explanation until the
 * framed document's bridge answers the ready handshake (which cannot happen
 * during a server render — the pinned copy is the honest "not here" state a user
 * sees on a remote site).
 *
 * The provider is faked here: this sidebar must not depend on it, so the contract
 * (a window global plus a ready event, see src/client/element-selection.ts) is
 * exactly what the tests exercise.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import './browser-globals.ts'
import type { Context } from '../src/context-types.ts'
import { TextEditor } from '../src/client/TextEditor.tsx'
import { BrowserView } from '../src/client/BrowserView.tsx'
import { createSidebarStore } from '../src/client/state.ts'
import type { FileViewerProps } from '../src/client/service.ts'
import { zh } from '../src/client/locales.ts'

const CTX = {} as Context

/** The provider's global key (kept literal: it is a published contract). */
const GLOBAL_KEY = '__dshElementSelection__'

/**
 * A provider stand-in with the handshake unanswered — the state of every server
 * render and of every remote page. `isProxyablePage` mirrors the real policy for
 * the addresses the cases below use.
 */
function fakeProvider() {
  return {
    version: '0.0.0-test',
    proxyRoutePrefix: '/element-selection/proxy',
    isProxyablePage: (url: string | undefined) =>
      url !== undefined && /^https?:\/\//.test(url) && !/\/\/(127\.0\.0\.1|localhost|\[::1\])/.test(url),
    encodeProxyUrl: (target: string) => '/element-selection/proxy?url=' + encodeURIComponent(target),
    fetchProxyToken: async () => 'token',
    useElementPicker: () => ({
      ready: false,
      picking: false,
      notice: null,
      toggle: () => {},
      cancel: () => {},
      handleLoad: () => {},
    }),
    buildWebElementInsert: () => '',
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, 'language', { value: 'zh-CN', configurable: true })
  ;(globalThis as unknown as Record<string, unknown>).window = globalThis
  ;(globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY] = fakeProvider()
})

afterEach(() => {
  delete (globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY]
})

function viewerProps(store: ReturnType<typeof createSidebarStore>, overrides: Partial<FileViewerProps> = {}): FileViewerProps {
  return {
    ctx: CTX,
    store,
    scope: { sessionId: 's1', cwd: '/p' },
    path: '/p/a/index.html',
    title: 'index.html',
    viewerId: 'html',
    content: '<h1>hi</h1>',
    ...overrides,
  }
}

function tabProps(store: ReturnType<typeof createSidebarStore>, path?: string) {
  return {
    ctx: CTX,
    store,
    scope: { sessionId: 's1', cwd: '/p' },
    tab: { id: 'browser:1', type: 'browser', title: 'Browser', ...(path !== undefined ? { path } : {}) },
    visible: true,
  }
}

describe('element picker toggle (browser tab)', () => {
  it('offers the proxy route for a remote page (a remote frame has no bridge)', () => {
    const store = createSidebarStore()
    const html = renderToString(createElement(BrowserView, tabProps(store, 'https://example.com/')))
    expect(html).toContain('aria-label="' + zh.pickElement + '"')
    // No bridge can answer on a remote origin, but the page IS proxyable, so
    // the action stays available and explains what pressing it will do.
    expect(html).toContain('title="' + zh.pickElementViaProxy + '"')
    // Scope the check to the toggle itself: the toolbar's back/forward
    // buttons are disabled too (empty history), so a blanket
    // not.toContain('disabled=""') can never hold.
    expect(html).not.toContain('title="' + zh.pickElementViaProxy + '" disabled=""')
    expect(html).not.toContain(zh.pickElementCancel)
    expect(html).not.toContain(zh.browserProxyNotice)
  })

  it('disables the toggle for a page the proxy refuses (loopback)', () => {
    const store = createSidebarStore()
    const html = renderToString(createElement(BrowserView, tabProps(store, 'http://127.0.0.1:8080/')))
    expect(html).toContain('title="' + zh.pickElementUnsupported + '" disabled=""')
  })

  it('stays disabled before any navigation', () => {
    const store = createSidebarStore()
    const html = renderToString(createElement(BrowserView, tabProps(store)))
    expect(html).toContain('aria-label="' + zh.pickElement + '"')
    expect(html).toContain('title="' + zh.pickElementUnsupported + '" disabled=""')
  })

  it('renders no toggle at all while the picker plugin is absent', () => {
    delete (globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY]
    const store = createSidebarStore()
    const html = renderToString(createElement(BrowserView, tabProps(store, 'https://example.com/')))
    expect(html).toContain('<iframe')
    expect(html).not.toContain(zh.pickElement)
    expect(html).not.toContain(zh.pickElementViaProxy)
  })
})

describe('element picker toggle (HTML preview)', () => {
  it('renders over the preview iframe, disabled until the injected bridge answers', () => {
    const store = createSidebarStore()
    const html = renderToString(createElement(TextEditor, viewerProps(store)))
    expect(html).toContain('<iframe')
    expect(html).toContain('aria-label="' + zh.pickElement + '"')
    expect(html).toContain('title="' + zh.pickElementUnsupported + '" disabled=""')
  })

  it('is absent for a markdown viewer (no framed document to pick in)', () => {
    const store = createSidebarStore()
    const html = renderToString(createElement(TextEditor, viewerProps(store, {
      viewerId: 'markdown',
      path: '/p/readme.md',
      content: '# hi',
    })))
    expect(html).not.toContain(zh.pickElement)
  })

  it('renders no toggle over the preview while the picker plugin is absent', () => {
    delete (globalThis as unknown as Record<string, unknown>)[GLOBAL_KEY]
    const store = createSidebarStore()
    const html = renderToString(createElement(TextEditor, viewerProps(store)))
    expect(html).toContain('<iframe')
    expect(html).not.toContain(zh.pickElement)
  })
})
