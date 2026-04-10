/**
 * searchCache — localStorage-backed search result cache with 1-hour TTL.
 * Keys are hashed so special characters in queries don't cause issues.
 */

const TTL_MS = 60 * 60 * 1000; // 1 hour
const PREFIX = 'pp_sc_';
const MAX_ENTRIES = 50; // prevent storage bloat

function hashKey(key) {
  // Simple deterministic hash → safe localStorage key
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return PREFIX + (h >>> 0).toString(36);
}

export const searchCache = {
  get(key) {
    try {
      const raw = localStorage.getItem(hashKey(key));
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > TTL_MS) {
        localStorage.removeItem(hashKey(key));
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  set(key, data) {
    try {
      this._prune();
      localStorage.setItem(hashKey(key), JSON.stringify({ data, ts: Date.now() }));
    } catch {
      // Storage full — clear all cache entries and try once more
      this.clear();
      try { localStorage.setItem(hashKey(key), JSON.stringify({ data, ts: Date.now() })); } catch {}
    }
  },

  _prune() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
      // Remove expired
      keys.forEach(k => {
        try {
          const { ts } = JSON.parse(localStorage.getItem(k));
          if (Date.now() - ts > TTL_MS) localStorage.removeItem(k);
        } catch { localStorage.removeItem(k); }
      });
      // If still over limit, remove oldest
      const remaining = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
      if (remaining.length > MAX_ENTRIES) {
        const sorted = remaining
          .map(k => { try { return { k, ts: JSON.parse(localStorage.getItem(k)).ts }; } catch { return { k, ts: 0 }; } })
          .sort((a, b) => a.ts - b.ts);
        sorted.slice(0, sorted.length - MAX_ENTRIES).forEach(({ k }) => localStorage.removeItem(k));
      }
    } catch {}
  },

  clear() {
    try {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k));
    } catch {}
  },

  /** Returns how many entries are cached (useful for debugging) */
  size() {
    return Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).length;
  },
};
