import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useChallenges() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState([])
  const [userChallenges, setUserChallenges] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchChallenges = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: allChallenges }, { data: myProgress }] = await Promise.all([
        supabase.from('challenges').select('*').eq('is_active', true).order('created_at'),
        supabase.from('user_challenges').select('*').eq('user_id', user.id),
      ])
      setChallenges(allChallenges || [])
      setUserChallenges(myProgress || [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchChallenges() }, [fetchChallenges])

  const joinChallenge = async (challengeId) => {
    if (!user) throw new Error('Not authenticated')
    const challenge = challenges.find(c => c.id === challengeId)
    if (!challenge) throw new Error('Challenge not found')

    const endsAt = new Date()
    endsAt.setDate(endsAt.getDate() + challenge.duration_days)

    const { data, error } = await supabase
      .from('user_challenges')
      .insert({
        user_id: user.id,
        challenge_id: challengeId,
        started_at: new Date().toISOString(),
        ends_at: endsAt.toISOString(),
        current_progress: 0,
        status: 'active',
      })
      .select()
      .single()
    if (error) throw error
    setUserChallenges(prev => [...prev, data])
    return data
  }

  const leaveChallenge = async (challengeId) => {
    if (!user) return
    const { error } = await supabase
      .from('user_challenges')
      .delete()
      .eq('user_id', user.id)
      .eq('challenge_id', challengeId)
      .eq('status', 'active')
    if (error) throw error
    setUserChallenges(prev => prev.filter(uc => uc.challenge_id !== challengeId))
  }

  const isJoined = (challengeId) =>
    userChallenges.some(uc => uc.challenge_id === challengeId && uc.status === 'active')

  const getProgress = (challengeId) =>
    userChallenges.find(uc => uc.challenge_id === challengeId) || null

  // Merge challenges with user progress
  const enrichedChallenges = challenges.map(c => ({
    ...c,
    joined: isJoined(c.id),
    userProgress: getProgress(c.id),
  }))

  return { challenges: enrichedChallenges, loading, joinChallenge, leaveChallenge, isJoined, refetch: fetchChallenges }
}
