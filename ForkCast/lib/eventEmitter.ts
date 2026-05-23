// Stub: Event emitter — not implemented in ForkCastApp
type Listener = (...args: any[]) => void;
const listeners: Map<string, Set<Listener>> = new Map();

export class EventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();
  on(event: string, listener: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }
  off(event: string, listener: Listener) { this.listeners.get(event)?.delete(listener); }
  emit(event: string, ...args: any[]) { this.listeners.get(event)?.forEach((l) => l(...args)); }
  removeAllListeners(event?: string) { if (event) this.listeners.delete(event); else this.listeners.clear(); }
}

export const eventEmitter = new EventEmitter();
