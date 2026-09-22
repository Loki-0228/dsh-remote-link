/**
 * Ambient type shims for the client-side DSH packages.
 *
 * The browser halves of the harness packages are distributed as built
 * bundles inside the running shell, not as installable packages, so the type
 * surface they own cannot be imported for compilation here. These declarations
 * cover exactly the shapes this plugin's browser half consumes — every import
 * they satisfy is `import type`, so nothing here reaches the built bundle.
 * @module dsh-remote-link/client/dsh-client-shims
 */

declare module '@deepseek-ai/dsh-client-ui-settings/client' {
  /** Client-side sync state of one settings namespace. */
  export interface SettingsScopeSnapshot<T> {
    status: 'loading' | 'ready' | 'unavailable'
    value: T | undefined
    base: unknown
    user: unknown
    revision: number | undefined
    writable: boolean
    mode: 'host' | 'memory'
  }

  /** Reactive owner handle over one namespace's durable section. */
  export interface SettingsScope<T> {
    getSnapshot(): SettingsScopeSnapshot<T>
    subscribe(listener: () => void): () => void
    mutate(ops: readonly { op: 'set'; path: readonly string[]; value: unknown }[], expectedRevision?: number): Promise<void>
    set(field: string, value: unknown): Promise<void>
    unset(field: string): Promise<void>
  }

  /** How a browser plugin declares the namespace it consumes. */
  export interface SettingsScopeSpec<T> {
    namespace: string
    decode?: (section: unknown) => T | undefined
  }

  /**
   * The settings-scope service: a factory that binds a namespace to a scope.
   * (Rc.6 compatibility binders expose the same `bind` entry point.)
   */
  export interface SettingsScopeBinder {
    bind<T>(spec: SettingsScopeSpec<T>): SettingsScope<T>
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  /** Slot identifiers this plugin registers into. */
  export interface SlotMap {
    'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: { wide: boolean } }
  }

  /** Dictionary namespaces this plugin contributes. */
  export interface LocaleNamespaceMap {
    'remote-link': string
  }

  /** Translate seat for one namespace, handed to slot components. */
  export type TranslateNS<N extends string> = (key: string, params?: Record<string, unknown>) => string

  /** Standard slot props: the locale seat for the slot's namespace. */
  export type PropsLocale<N extends string> = { t: TranslateNS<N> }
}
