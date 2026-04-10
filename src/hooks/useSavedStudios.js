import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useSavedStudios() {
  const { user } = useAuth()
  const [saved, setSaved] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchSaved = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('saved_studios')
        .select('*, studios(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setSaved(data || [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchSaved() }, [fetchSaved])

  const saveStudio = async (studioId, note = '', listType = 'wishlist') => {
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('saved_studios')
      .upsert({ user_id: user.id, studio_id: studioId, note, list_type: listType })
      .select('*, studios(*)')
      .single()
    if (error) throw error
    setSaved(prev => [data, ...prev.filter(s => s.studio_id !== studioId)])
    return data
  }

  const unsaveStudio = async (studioId) => {
    if (!user) return
    const { error } = await supabase
      .from('saved_studios')
      .delete()
      .eq('user_id', user.id)
      .eq('studio_id', studioId)
    if (error) throw error
    setSaved(prev => prev.filter(s => s.studio_id !== studioId))
  }

  const isSaved = (studioId) => saved.some(s => s.studio_id === studioId)

  return { saved, loading, saveStudio, unsaveStudio, isSaved, refetch: fetchSaved }
}
