/**
 * Per-customer sliding-window rate limiter.
 *
 * Uses an in-memory array of timestamps for each customer.
 * Good enough for a single-process deployment; replace with Redis
 * if you run multiple replicas.
 */

interface Window {
  timestamps: number[];
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly windowMs = 60_000; // 1 minute

  /**
   * Attempts to consume one request slot for `customerId`.
   *
   * @returns `true` when the request is allowed, `false` when rate-limited.
   */
  allow(customerId: string, requestsPerMinute: number): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let win = this.windows.get(customerId);
    if (!win) {
      win = { timestamps: [] };
      this.windows.set(customerId, win);
    }

    // Drop timestamps outside the current window
    win.timestamps = win.timestamps.filter((t) => t > cutoff);

    if (win.timestamps.length >= requestsPerMinute) {
      return false;
    }

    win.timestamps.push(now);
    return true;
  }

  /**
   * Returns current usage stats without consuming a slot.
   */
  usage(
    customerId: string,
    requestsPerMinute: number,
  ): { used: number; limit: number; resetsInMs: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const win = this.windows.get(customerId);
    const active = win?.timestamps.filter((t) => t > cutoff) ?? [];
    const oldest = active[0] ?? now;

    return {
      used: active.length,
      limit: requestsPerMinute,
      resetsInMs: Math.max(0, oldest + this.windowMs - now),
    };
  }

  /** Wipes all state — handy for tests. */
  reset(): void {
    this.windows.clear();
  }
}
