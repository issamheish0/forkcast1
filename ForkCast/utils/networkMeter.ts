// utils/networkMeter.ts
// Lightweight per-session network usage meter for API and Storage

type RecordInput = {
  url: string;
  bytes: number; // number of bytes transferred over the network
  method?: string;
  fromCache?: boolean; // true if served from local cache (no network)
};

type BucketTotals = {
  apiBytes: number;
  storageBytes: number;
  otherBytes: number;
  apiRequests: number;
  storageRequests: number;
  otherRequests: number;
  cacheHits: number;
};

class NetworkMeter {
  private totals: BucketTotals = {
    apiBytes: 0,
    storageBytes: 0,
    otherBytes: 0,
    apiRequests: 0,
    storageRequests: 0,
    otherRequests: 0,
    cacheHits: 0,
  };

  private entries: (RecordInput & { timestamp: number })[] = [];

  reset() {
    this.totals = {
      apiBytes: 0,
      storageBytes: 0,
      otherBytes: 0,
      apiRequests: 0,
      storageRequests: 0,
      otherRequests: 0,
      cacheHits: 0,
    };
    this.entries = [];
  }

  record(input: RecordInput) {
    const { url, bytes, method, fromCache } = input;
    const lowerUrl = url.toLowerCase();
    const isSupabaseApi =
      lowerUrl.includes("/rest/v1/") || lowerUrl.includes("/rpc/");
    const isSupabaseStorage =
      lowerUrl.includes("/storage/v1/object/") ||
      lowerUrl.includes("/storage/v1/render/");

    if (fromCache) {
      this.totals.cacheHits += 1;
    }

    if (isSupabaseApi) {
      this.totals.apiRequests += 1;
      this.totals.apiBytes += Math.max(0, bytes);
    } else if (isSupabaseStorage) {
      this.totals.storageRequests += 1;
      this.totals.storageBytes += Math.max(0, bytes);
    } else {
      this.totals.otherRequests += 1;
      this.totals.otherBytes += Math.max(0, bytes);
    }

    this.entries.push({ ...input, timestamp: Date.now() });
  }

  getSummary() {
    return {
      ...this.totals,
      totalBytes:
        this.totals.apiBytes +
        this.totals.storageBytes +
        this.totals.otherBytes,
      totalRequests:
        this.totals.apiRequests +
        this.totals.storageRequests +
        this.totals.otherRequests,
      entriesSample: this.entries.slice(-10),
      allEntries: this.entries.slice(), // Full list for debugging
    };
  }

  // Get largest requests for debugging
  getLargestRequests(limit: number = 10) {
    return this.entries
      .filter((e) => e.bytes > 0 && !e.fromCache)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, limit)
      .map((e) => ({
        url: this.sanitizeUrl(e.url),
        bytes: e.bytes,
        kb: (e.bytes / 1024).toFixed(1),
        method: e.method || "GET",
        timestamp: new Date(e.timestamp).toLocaleTimeString(),
      }));
  }

  // Group requests by endpoint pattern
  getRequestsByPattern() {
    const patterns = new Map<
      string,
      { count: number; totalBytes: number; urls: string[] }
    >();

    this.entries.forEach((entry) => {
      if (entry.fromCache || entry.bytes === 0) return;

      const pattern = this.extractPattern(entry.url);
      const existing = patterns.get(pattern) || {
        count: 0,
        totalBytes: 0,
        urls: [],
      };

      existing.count += 1;
      existing.totalBytes += entry.bytes;
      if (existing.urls.length < 3) {
        existing.urls.push(this.sanitizeUrl(entry.url));
      }
      patterns.set(pattern, existing);
    });

    return Array.from(patterns.entries())
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        totalBytes: data.totalBytes,
        totalKB: (data.totalBytes / 1024).toFixed(1),
        sampleUrls: data.urls,
      }))
      .sort((a, b) => b.totalBytes - a.totalBytes);
  }

  private sanitizeUrl(url: string): string {
    try {
      const u = new URL(url);
      // Remove query params for cleaner display, but keep path
      return `${u.pathname}`;
    } catch {
      // If URL parsing fails, return truncated version
      return url.length > 60 ? url.substring(0, 60) + "..." : url;
    }
  }

  private extractPattern(url: string): string {
    try {
      const u = new URL(url);
      // Extract pattern: table name or endpoint
      const pathParts = u.pathname.split("/").filter(Boolean);
      if (pathParts.length >= 3) {
        // e.g., /rest/v1/restaurants -> restaurants
        // e.g., /rest/v1/bookings -> bookings
        return pathParts[pathParts.length - 1] || u.pathname;
      }
      return u.pathname;
    } catch {
      return url.split("?")[0];
    }
  }

  logSummary(label: string = "Session Network Usage") {
    const s = this.getSummary();
    // Return summary instead of logging
    return {
      label,
      api: `${(s.apiBytes / 1024).toFixed(1)} KB / ${s.apiRequests} req`,
      storage: `${(s.storageBytes / 1024).toFixed(1)} KB / ${s.storageRequests} req`,
      other: `${(s.otherBytes / 1024).toFixed(1)} KB / ${s.otherRequests} req`,
      total: `${(s.totalBytes / 1024).toFixed(1)} KB / ${s.totalRequests} req`,
      cacheHits: s.cacheHits,
    };
  }
}

export const networkMeter = new NetworkMeter();
