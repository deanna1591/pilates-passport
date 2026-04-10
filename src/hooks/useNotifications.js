/**
 * useNotifications — Browser Notification API for Pilates Passport
 *
 * Features:
 *  - requestPermission: asks the user for notification permission
 *  - sendNotification: fires an immediate browser notification
 *  - scheduleDailyReminder: schedules a daily challenge reminder at 9am
 *  - cancelReminder: clears a scheduled reminder
 *  - permission: current permission state ('default'|'granted'|'denied')
 *
 * In a native Expo build, swap the browser API for expo-notifications.
 * The interface is intentionally identical so the swap is a one-liner.
 */

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'pp_notifications_enabled'
const REMINDER_KEY = 'pp_reminder_timer_id'

export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  )
  const reminderRef = useRef(null)

  // Keep permission state in sync if the user changes it in browser settings
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    const interval = setInterval(() => {
      if (Notification.permission !== permission) {
        setPermission(Notification.permission)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [permission])

  // ── Request permission ──────────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      console.warn('[Notifications] Not supported in this browser.')
      return 'unsupported'
    }
    if (Notification.permission === 'granted') {
      setPermission('granted')
      setEnabled(true)
      localStorage.setItem(STORAGE_KEY, 'true')
      return 'granted'
    }
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      setEnabled(true)
      localStorage.setItem(STORAGE_KEY, 'true')
    }
    return result
  }, [])

  // ── Send an immediate notification ─────────────────────────────────────────
  const sendNotification = useCallback((title, options = {}) => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (!enabled) return

    const n = new Notification(title, {
      icon: '/logo.png',
      badge: '/favicon.png',
      tag: options.tag || 'pilates-passport',
      requireInteraction: false,
      silent: false,
      ...options,
    })

    // Auto-close after 6 seconds
    setTimeout(() => n.close(), 6000)

    n.onclick = () => {
      window.focus()
      n.close()
      if (options.onClick) options.onClick()
    }

    return n
  }, [enabled])

  // ── Schedule a daily 9am reminder ──────────────────────────────────────────
  const scheduleDailyReminder = useCallback((message = "Time to move! Log your Pilates class today. 🪷") => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return

    // Clear any existing reminder
    if (reminderRef.current) clearTimeout(reminderRef.current)

    const getNextNineAm = () => {
      const now = new Date()
      const next = new Date()
      next.setHours(9, 0, 0, 0)
      // If 9am already passed today, schedule for tomorrow
      if (next <= now) next.setDate(next.getDate() + 1)
      return next.getTime() - now.getTime()
    }

    const schedule = () => {
      const msUntil9am = getNextNineAm()
      reminderRef.current = setTimeout(() => {
        sendNotification('Pilates Passport ✦', {
          body: message,
          tag: 'daily-reminder',
        })
        // Re-schedule for next day
        schedule()
      }, msUntil9am)
    }

    schedule()
    console.info('[Notifications] Daily 9am reminder scheduled.')
  }, [sendNotification])

  // ── Cancel scheduled reminder ───────────────────────────────────────────────
  const cancelReminder = useCallback(() => {
    if (reminderRef.current) {
      clearTimeout(reminderRef.current)
      reminderRef.current = null
    }
  }, [])

  // ── Toggle notifications on/off ─────────────────────────────────────────────
  const toggleNotifications = useCallback(async () => {
    if (!enabled) {
      const result = await requestPermission()
      if (result === 'granted') {
        scheduleDailyReminder()
        sendNotification('Notifications enabled ✦', {
          body: "We'll remind you to log your Pilates practice.",
          tag: 'welcome',
        })
      }
    } else {
      setEnabled(false)
      localStorage.setItem(STORAGE_KEY, 'false')
      cancelReminder()
    }
  }, [enabled, requestPermission, scheduleDailyReminder, cancelReminder, sendNotification])

  // Auto-schedule reminder if already enabled & granted
  useEffect(() => {
    if (enabled && permission === 'granted') {
      scheduleDailyReminder()
    }
    return () => cancelReminder()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    permission,
    enabled,
    supported: typeof Notification !== 'undefined',
    requestPermission,
    sendNotification,
    scheduleDailyReminder,
    cancelReminder,
    toggleNotifications,
  }
}
