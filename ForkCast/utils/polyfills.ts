// polyfills.ts
if (typeof globalThis.structuredClone === "undefined") {
  globalThis.structuredClone = function structuredClone(value: any): any {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (Array.isArray(value)) {
      return value.map((item) => structuredClone(item));
    }

    if (typeof value === "object") {
      const cloned: any = {};
      for (const key in value) {
        if (value.hasOwnProperty(key)) {
          cloned[key] = structuredClone(value[key]);
        }
      }
      return cloned;
    }

    return value;
  };
}

// Dev-only global fetch wrapper to meter API bytes
try {
  // Avoid double-wrapping
  const alreadyWrapped = (globalThis as any).__FETCH_WRAPPED__;
  if (!alreadyWrapped && typeof fetch === "function") {
    const originalFetch = fetch;
    (globalThis as any).__FETCH_WRAPPED__ = true;

    // Lazy import to avoid circular deps
    const lazyRecord = async (url: string, bytes: number) => {
      try {
        const { networkMeter } = await import("@/utils/networkMeter");
        networkMeter.record({ url, bytes, method: "FETCH" });
      } catch {}
    };

    // @ts-ignore override global
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await originalFetch(input, init);
      try {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input instanceof Request
                ? input.url
                : String(input);

        // Measure request body size (for POST/PUT/PATCH)
        if (init?.body) {
          let reqBytes = 0;
          if (typeof init.body === "string") {
            reqBytes = new Blob([init.body]).size;
          } else if (init.body instanceof Blob) {
            reqBytes = init.body.size;
          } else if (init.body instanceof ArrayBuffer) {
            reqBytes = init.body.byteLength;
          } else if (init.body instanceof FormData) {
            // Estimate FormData size (rough)
            reqBytes = new Blob([init.body] as any).size;
          }
          if (reqBytes > 0) {
            lazyRecord(url, reqBytes);
          }
        }

        // Measure response size
        const lenHeader = res.headers?.get?.("content-length");
        if (lenHeader) {
          const respBytes = parseInt(lenHeader, 10) || 0;
          if (respBytes > 0) {
            lazyRecord(url, respBytes);
          }
        } else {
          // Fallback: try to read first chunk size as estimate (non-blocking)
          const clone = res.clone();
          clone
            .arrayBuffer()
            .then((buf) => {
              const size = buf.byteLength;
              if (size > 0) {
                lazyRecord(url, size);
              }
            })
            .catch(() => {
              // Ignore - measurement failed
            });
        }
      } catch {
        // Ignore metering errors
      }
      return res;
    };
  }
} catch {}
