import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useStudios() {
  const [studios, setStudios] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const searchStudios = useCallback(async ({ city, query, tags, limit = 20 } = {}) => {
    setLoading(true)
    setError(null)
    try {
      let q = supabase
        .from('studios')
        .select(`
          *,
          studio_tags ( tag, count ),
          studio_photos ( url )
        `)
        .order('avg_rating', { ascending: false })
        .limit(limit)

      if (city) q = q.ilike('city', `%${city}%`)
      if (query) q = q.or(`name.ilike.%${query}%,city.ilike.%${query}%,address.ilike.%${query}%`)

      const { data, error } = await q
      if (error) throw error
      setStudios(data || [])
      return data || []
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const getStudio = async (id) => {
    const { data, error } = await supabase
      .from('studios')
      .select(`
        *,
        studio_tags ( tag, count ),
        studio_photos ( id, url ),
        reviews ( id, rating, body, tags, created_at, users ( display_name ) )
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  }

  const submitStudio = async (studioData) => {
    const { data, error } = await supabase
      .from('studios')
      .insert(studioData)
      .select()
      .single()
    if (error) throw error
    return data
  }

  return { studios, loading, error, searchStudios, getStudio, submitStudio }
}
