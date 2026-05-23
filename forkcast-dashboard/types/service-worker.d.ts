// types/service-worker.d.ts
// Type declarations for Service Worker APIs not covered by default TypeScript lib

/**
 * Background Sync API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
 */
interface SyncManager {
  register(tag: string): Promise<void>
  getTags(): Promise<string[]>
}

/**
 * Periodic Background Sync API
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Periodic_Background_Synchronization_API
 */
interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>
  unregister(tag: string): Promise<void>
  getTags(): Promise<string[]>
}

// Augment ServiceWorkerRegistration with sync APIs
interface ServiceWorkerRegistration {
  readonly sync?: SyncManager
  readonly periodicSync?: PeriodicSyncManager
}

// iOS standalone mode detection
interface Navigator {
  readonly standalone?: boolean
}

// Microsoft Stream detection
interface Window {
  readonly MSStream?: unknown
}

// BeforeInstallPromptEvent for PWA install prompts
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

interface WindowEventMap {
  beforeinstallprompt: BeforeInstallPromptEvent
}
