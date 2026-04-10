/**
 * useCalendarSync — Google Calendar OAuth integration
 *
 * Fetches calendar events, detects Pilates class bookings,
 * and surfaces prompts when a class time has passed.
 *
 * OAuth setup (one-time):
 *   1. Go to console.cloud.google.com → APIs & Services → Credentials
 *   2. Create OAuth 2.0 Client ID (Web Application)
 *   3. Add Authorised redirect URIs: https://your-vercel-url.vercel.app
 *   4. Add to Vercel env vars: VITE_GOOGLE_CALENDAR_CLIENT_ID
 *   5. Enable "Google Calendar API" in the API Library
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const CLIENT_ID    = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID || '';
const SCOPES       = 'https://www.googleapis.com/auth/calendar.readonly';
const CACHE_KEY    = 'pp_cal_events';
const TOKEN_KEY    = 'pp_cal_token';
const PERM_KEY     = 'pp_cal_permission';
const DISMISSED_KEY= 'pp_cal_dismissed';
const POLL_INTERVAL= 60 * 60 * 1000; // 1 hour

// Keywords that indicate a Pilates / fitness class
const PILATES_KEYWORDS = [
  'pilates', 'reformer', 'mat class', 'tower', 'cadillac',
  'barre', 'yoga', 'core class', 'stretch class', 'studio class',
  'hot pilates', 'private session', 'group class',
];

function isPilatesEvent(event) {
  const text = [
    event.summary || '',
    event.description || '',
    event.location || '',
    event.organizer?.displayName || '',
  ].join(' ').toLowerCase();
  return PILATES_KEYWORDS.some(kw => text.includes(kw));
}

function parseEvent(raw) {
  const start = raw.start?.dateTime || raw.start?.date;
  const end   = raw.end?.dateTime   || raw.end?.date;
  return {
    id:          raw.id,
    title:       raw.summary || 'Pilates Class',
    location:    raw.location || '',
    description: raw.description || '',
    start:       start ? new Date(start) : null,
    end:         end   ? new Date(end)   : null,
    organizer:   raw.organizer?.displayName || '',
    calendarId:  raw.calendarId || 'primary',
  };
}

export function useCalendarSync() {
  const [permission, setPermission]             = useState(() => localStorage.getItem(PERM_KEY) || 'prompt');
  const [events, setEvents]                     = useState(() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]').map(e => ({ ...e, start: e.start ? new Date(e.start) : null, end: e.end ? new Date(e.end) : null })); }
    catch { return []; }
  });
  const [pendingDetections, setPendingDetections] = useState([]);
  const [loading, setLoading]                   = useState(false);
  const [error, setError]                       = useState(null);
  const [accessToken, setAccessToken]           = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [calendars, setCalendars]               = useState([]);
  const [syncEnabled, setSyncEnabled]           = useState(() => localStorage.getItem(PERM_KEY) === 'granted');
  const [customKeywords, setCustomKeywords]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('pp_cal_keywords') || '[]'); } catch { return []; }
  });
  const pollRef = useRef(null);

  // ── Load Google Identity Services script ────────────────────────────────
  const loadGISScript = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }, []);

  // ── OAuth: request calendar access ──────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (!CLIENT_ID) {
      setError('Google Calendar Client ID not configured. Add VITE_GOOGLE_CALENDAR_CLIENT_ID to your Vercel env vars.');
      return false;
    }
    try {
      await loadGISScript();
      return new Promise((resolve) => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id:  CLIENT_ID,
          scope:      SCOPES,
          callback:   (response) => {
            if (response.error) {
              setPermission('denied');
              localStorage.setItem(PERM_KEY, 'denied');
              resolve(false);
              return;
            }
            const token = response.access_token;
            setAccessToken(token);
            setPermission('granted');
            setSyncEnabled(true);
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(PERM_KEY, 'granted');
            resolve(true);
          },
        });
        client.requestAccessToken();
      });
    } catch (err) {
      setError('Failed to load Google sign-in: ' + err.message);
      return false;
    }
  }, [loadGISScript]);

  // ── Fetch events from Google Calendar API ───────────────────────────────
  const fetchEvents = useCallback(async (token = accessToken) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // Scan 7 days back to 14 days forward
      const now = new Date();
      const timeMin = new Date(now - 7 * 86400000).toISOString();
      const timeMax = new Date(now.getTime() + 14 * 86400000).toISOString();

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '100' }),
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 401) {
        // Token expired — clear and re-prompt
        localStorage.removeItem(TOKEN_KEY);
        setAccessToken('');
        setPermission('prompt');
        localStorage.setItem(PERM_KEY, 'prompt');
        return;
      }

      const data = await res.json();
      const allEvents = (data.items || []).map(parseEvent);
      const pilatesEvents = allEvents.filter(e =>
        isPilatesEvent(e) ||
        customKeywords.some(kw => (e.title + e.location + e.description).toLowerCase().includes(kw.toLowerCase()))
      );

      setEvents(pilatesEvents);
      // Persist with serialisable dates
      localStorage.setItem(CACHE_KEY, JSON.stringify(pilatesEvents.map(e => ({ ...e, start: e.start?.toISOString(), end: e.end?.toISOString() }))));
    } catch (err) {
      setError('Failed to fetch calendar events: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, customKeywords]);

  // ── Fetch available calendars ────────────────────────────────────────────
  const fetchCalendars = useCallback(async (token = accessToken) => {
    if (!token) return;
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCalendars((data.items || []).map(c => ({ id: c.id, name: c.summary, primary: c.primary })));
    } catch {}
  }, [accessToken]);

  // ── Calculate pending detections (events that ended, user hasn't logged) ─
  useEffect(() => {
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    const now = new Date();

    const pending = events.filter(e => {
      if (!e.end) return false;
      if (dismissed.includes(e.id)) return false;
      // Event ended in the past 12 hours
      const msSinceEnd = now - e.end;
      return msSinceEnd > 0 && msSinceEnd < 12 * 3600000;
    });

    setPendingDetections(pending);
  }, [events]);

  // ── Dismiss a detection ──────────────────────────────────────────────────
  const dismissDetection = useCallback((eventId) => {
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
    dismissed.push(eventId);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
    setPendingDetections(prev => prev.filter(e => e.id !== eventId));
  }, []);

  // ── Mark event as "not a Pilates class" — ignore forever ─────────────────
  const ignoreEvent = useCallback((eventId) => {
    dismissDetection(eventId);
    const ignored = JSON.parse(localStorage.getItem('pp_cal_ignored') || '[]');
    ignored.push(eventId);
    localStorage.setItem('pp_cal_ignored', JSON.stringify(ignored));
  }, [dismissDetection]);

  // ── Save custom keywords ─────────────────────────────────────────────────
  const saveCustomKeywords = useCallback((keywords) => {
    setCustomKeywords(keywords);
    localStorage.setItem('pp_cal_keywords', JSON.stringify(keywords));
  }, []);

  // ── Toggle sync on/off ───────────────────────────────────────────────────
  const toggleSync = useCallback((enabled) => {
    setSyncEnabled(enabled);
    if (!enabled) {
      localStorage.setItem(PERM_KEY, 'disabled');
      setPermission('disabled');
    } else if (accessToken) {
      localStorage.setItem(PERM_KEY, 'granted');
      setPermission('granted');
      fetchEvents();
    } else {
      requestPermission();
    }
  }, [accessToken, fetchEvents, requestPermission]);

  // ── Auto-fetch on mount + hourly poll ────────────────────────────────────
  useEffect(() => {
    if (accessToken && syncEnabled) {
      fetchEvents(accessToken);
      fetchCalendars(accessToken);
      pollRef.current = setInterval(() => fetchEvents(accessToken), POLL_INTERVAL);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [accessToken, syncEnabled, fetchEvents, fetchCalendars]);

  return {
    permission,
    events,
    pendingDetections,
    loading,
    error,
    calendars,
    syncEnabled,
    customKeywords,
    requestPermission,
    fetchEvents,
    dismissDetection,
    ignoreEvent,
    toggleSync,
    saveCustomKeywords,
  };
}
