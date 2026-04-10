/**
 * useOfflineCache — detects online/offline state and provides
 * localStorage-backed caching for class logs and studios so the
 * app stays usable without a network connection.
 *
 * Cache TTL: 7 days for logs (personal data), 24h for studios (public data)
 */

import { useState, useEffect, useCallback } from 'react';

const LOGS_KEY    = 'pp_offline_logs';
const STUDIOS_KEY = 'pp_offline_studios';
const LOGS_TTL    = 7 * 24 * 60 * 60 * 1000;   // 7 days
const STUDIOS_TTL = 24 * 60 * 60 * 1000;         // 24 hours

function readCache(key, ttl) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) { localStorage.removeItem(key); return null; }
    return data;
  } catch {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // Storage quota — silently ignore
  }
}

export function useOfflineCache() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  /** Save logs to offline cache (call after successful Supabase fetch) */
  const cacheLogs = useCallback((logs) => {
    if (Array.isArray(logs) && logs.length > 0) writeCache(LOGS_KEY, logs);
  }, []);

  /** Return cached logs, or null if not cached / expired */
  const getCachedLogs = useCallback(() => readCache(LOGS_KEY, LOGS_TTL), []);

  /** Save studio list to offline cache */
  const cacheStudios = useCallback((studios) => {
    if (Array.isArray(studios) && studios.length > 0) writeCache(STUDIOS_KEY, studios);
  }, []);

  /** Return cached studios, or null */
  const getCachedStudios = useCallback(() => readCache(STUDIOS_KEY, STUDIOS_TTL), []);

  /** Cache age in minutes (-1 if no cache) */
  const logsCacheAge = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOGS_KEY);
      if (!raw) return -1;
      const { ts } = JSON.parse(raw);
      return Math.round((Date.now() - ts) / 60000);
    } catch { return -1; }
  }, []);

  return {
    isOnline,
    cacheLogs,
    getCachedLogs,
    cacheStudios,
    getCachedStudios,
    logsCacheAge,
  };
}
