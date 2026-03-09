/**
 * Customer management module.
 *
 * Loads the customer → API key mapping from customers.json (local dev)
 * or from the CUSTOMER_CONFIG environment variable (production deployments
 * where you can't commit a secrets file).
 *
 * Schema of customers.json:
 * {
 *   "customers": {
 *     "<CUSTOMER_ID>": {
 *       "name": "Acme Corp",
 *       "apiKey": "crust_live_...",
 *       "enabled": true,           // optional, defaults to true
 *       "rateLimit": {             // optional, overrides default
 *         "requestsPerMinute": 60
 *       }
 *     }
 *   }
 * }
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum requests per customer per 60-second sliding window. */
  requestsPerMinute: number;
}

export interface Customer {
  /** Human-readable name shown in logs. */
  name: string;
  /** The Crustdata API key for this customer. Never sent to the client. */
  apiKey: string;
  /** Set to false to temporarily disable a customer without deleting the entry. */
  enabled?: boolean;
  /** Per-customer rate limit override. Defaults to DEFAULT_RATE_LIMIT. */
  rateLimit?: RateLimitConfig;
}

interface CustomersConfig {
  customers: Record<string, Customer>;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerMinute: 60,
};

// ─── Loader (lazy, cached) ───────────────────────────────────────────────────

let _config: CustomersConfig | null = null;

function loadConfig(): CustomersConfig {
  if (_config) return _config;

  // 1. Try environment variable first (great for Railway / Render / Vercel)
  const envConfig = process.env.CUSTOMER_CONFIG;
  if (envConfig) {
    try {
      _config = JSON.parse(envConfig) as CustomersConfig;
      console.log('[customers] Loaded config from CUSTOMER_CONFIG env var');
      return _config;
    } catch {
      console.error('[customers] CUSTOMER_CONFIG env var is not valid JSON — falling back to file');
    }
  }

  // 2. Try the JSON file (local dev / self-hosted)
  const configPath =
    process.env.CUSTOMERS_CONFIG_PATH ?? join(__dirname, '..', 'customers.json');

  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      _config = JSON.parse(raw) as CustomersConfig;
      console.log(`[customers] Loaded config from ${configPath}`);
      return _config;
    } catch (err) {
      console.error('[customers] Failed to parse customers.json:', err);
    }
  }

  console.warn(
    '[customers] No customer config found. Set CUSTOMER_CONFIG env var or provide customers.json',
  );
  _config = { customers: {} };
  return _config;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the Customer record for a given ID, or null if unknown / disabled.
 * The customer ID must be alphanumeric + hyphens/underscores only.
 */
export function getCustomer(customerId: string): Customer | null {
  // Sanitise: only allow safe ID characters to prevent any path/injection abuse
  if (!/^[a-zA-Z0-9_-]+$/.test(customerId)) return null;

  const cfg = loadConfig();
  const customer = cfg.customers[customerId];
  if (!customer) return null;
  if (customer.enabled === false) return null;
  return customer;
}

/** Returns all active customer IDs (useful for admin tooling). */
export function getActiveCustomerIds(): string[] {
  const cfg = loadConfig();
  return Object.entries(cfg.customers)
    .filter(([, c]) => c.enabled !== false)
    .map(([id]) => id);
}

/**
 * Invalidates the in-memory cache so changes to customers.json are picked
 * up on the next request (useful in hot-reload / dev mode).
 */
export function reloadConfig(): void {
  _config = null;
}
