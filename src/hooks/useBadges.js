import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useBadges(stats) {
  const { user } = useAuth()
  const [earnedBadges, setEarnedBadges] = useState([])
  const [allBadges, setAllBadges] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchBadges = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: badges }, { data: userBadges }] = await Promise.all([
        supabase.from('badges').select('*').order('category'),
        supabase.from('user_badges').select('*').eq('user_id', user.id),
      ])
      setAllBadges(badges || [])
      setEarnedBadges((userBadges || []).map(ub => ub.badge_id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchBadges() }, [fetchBadges])

  // After a class is logged, check if any new badges should unlock.
  // This runs client-side; for production consider a Supabase Edge Function trigger.
  const evaluateBadges = useCallback(async () => {
    if (!user || !stats) return
    const toUnlock = []

    const criteriaMap = {
      classes:      stats.classes,
      studios:      stats.studios,
      cities:       stats.cities,
      countries:    stats.countries,
      photos:       stats.photos,
      earlyClasses: stats.earlyClasses,
      reviews:      stats.reviews,
    }

    allBadges.forEach(badge => {
      const current = criteriaMap[badge.criteria_metric] ?? 0
      const alreadyEarned = earnedBadges.includes(badge.id)
      if (!alreadyEarned && current >= badge.criteria_value) {
        toUnlock.push(badge)
      }
    })

    if (toUnlock.length === 0) return []

    // Insert newly unlocked badges
    const inserts = toUnlock.map(b => ({
      user_id: user.id,
      badge_id: b.id,
      progress_current: criteriaMap[b.criteria_metric] ?? 0,
      progress_target: b.criteria_value,
    }))

    const { error } = await supabase.from('user_badges').upsert(inserts)
    if (!error) {
      setEarnedBadges(prev => [...prev, ...toUnlock.map(b => b.id)])
    }

    return toUnlock // return newly unlocked for showing a toast/animation
  }, [user, stats, allBadges, earnedBadges])

  const enriched = allBadges.map(b => {
    const criteriaMap = {
      classes:      stats?.classes ?? 0,
      studios:      stats?.studios ?? 0,
      cities:       stats?.cities ?? 0,
      countries:    stats?.countries ?? 0,
      photos:       stats?.photos ?? 0,
      earlyClasses: stats?.earlyClasses ?? 0,
      reviews:      stats?.reviews ?? 0,
    }
    const current = criteriaMap[b.criteria_metric] ?? 0
    return {
      ...b,
      current: Math.min(current, b.criteria_value),
      unlocked: earnedBadges.includes(b.id),
    }
  })

  return { badges: enriched, loading, evaluateBadges, refetch: fetchBadges }
}
