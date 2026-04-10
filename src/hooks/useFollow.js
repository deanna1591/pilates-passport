import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useFollow() {
  const { user } = useAuth()
  const [following, setFollowing] = useState([])   // user IDs we follow
  const [followers, setFollowers] = useState([])   // user IDs who follow us
  const [loading, setLoading] = useState(false)

  const fetchRelationships = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: f1 }, { data: f2 }] = await Promise.all([
        supabase.from('user_follows').select('following_id').eq('follower_id', user.id),
        supabase.from('user_follows').select('follower_id').eq('following_id', user.id),
      ])
      setFollowing((f1 || []).map(r => r.following_id))
      setFollowers((f2 || []).map(r => r.follower_id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchRelationships() }, [fetchRelationships])

  const follow = async (targetUserId) => {
    if (!user) throw new Error('Not authenticated')
    const { error } = await supabase
      .from('user_follows')
      .insert({ follower_id: user.id, following_id: targetUserId })
    if (error) throw error
    setFollowing(prev => [...prev, targetUserId])
  }

  const unfollow = async (targetUserId) => {
    if (!user) return
    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
    if (error) throw error
    setFollowing(prev => prev.filter(id => id !== targetUserId))
  }

  const isFollowing = (userId) => following.includes(userId)

  const toggleFollow = async (userId) => {
    if (isFollowing(userId)) await unfollow(userId)
    else await follow(userId)
  }

  return { following, followers, loading, follow, unfollow, isFollowing, toggleFollow }
}
