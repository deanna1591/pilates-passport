import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useClassLogs() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchLogs = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('class_logs')
        .select(`
          *,
          studios ( id, name, city, country, address, hero_emoji, website ),
          class_photos ( id, url, caption ),
          workouts ( id, duration_minutes, calories_burned, avg_heart_rate, max_heart_rate )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('start_time', { ascending: false })

      if (error) throw error
      setLogs(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const addLog = async (logData) => {
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('class_logs')
      .insert({ ...logData, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    setLogs(prev => [data, ...prev])
    return data
  }

  const updateLog = async (id, updates) => {
    const { data, error } = await supabase
      .from('class_logs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()
    if (error) throw error
    setLogs(prev => prev.map(l => l.id === id ? data : l))
    return data
  }

  const deleteLog = async (id) => {
    const { error } = await supabase
      .from('class_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) throw error
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  return { logs, loading, error, addLog, updateLog, deleteLog, refetch: fetchLogs }
}
