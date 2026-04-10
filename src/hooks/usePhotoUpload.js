import { useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * usePhotoUpload — uploads files to Supabase Storage
 * Uses supabase.auth.getUser() directly to avoid AuthContext dependency issues
 */
export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const uploadPhoto = async (file, bucket = 'class') => {
    setUploading(true)
    setError(null)
    try {
      // Get user directly from Supabase auth (avoids context timing issues)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated — please sign in again')

      // Validate file
      if (!file || !(file instanceof File)) throw new Error('Invalid file')
      if (file.size > 10 * 1024 * 1024) throw new Error('File too large — max 10MB')

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const timestamp = Date.now()
      const fileName = `${user.id}/${timestamp}_${Math.random().toString(36).slice(2)}.${ext}`
      const bucketName = `${bucket}-photos`

      console.info(`[PhotoUpload] Uploading to ${bucketName}/${fileName}`)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          upsert: false,
          contentType: file.type || 'image/jpeg',
        })

      if (uploadError) {
        console.error('[PhotoUpload] Upload error:', uploadError)
        // If bucket doesn't exist or policy denies, give clear message
        if (uploadError.message?.includes('not found') || uploadError.statusCode === 404) {
          throw new Error(`Storage bucket "${bucketName}" not found. Run the SQL migration to create it.`)
        }
        if (uploadError.statusCode === 403) {
          throw new Error('Permission denied. Check Supabase Storage bucket policies.')
        }
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName)

      console.info('[PhotoUpload] Success:', publicUrl)
      return publicUrl
    } catch (err) {
      console.error('[PhotoUpload] Error:', err)
      setError(err.message)
      throw err
    } finally {
      setUploading(false)
    }
  }

  const saveClassPhoto = async (classLogId, url, caption = '') => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('class_photos')
      .insert({
        class_log_id: classLogId,
        user_id: user.id,
        url,
        caption,
        visibility: 'private',
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  const saveStudioPhoto = async (studioId, url) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data, error } = await supabase
      .from('studio_photos')
      .insert({
        studio_id: studioId,
        user_id: user.id,
        url,
        moderation_status: 'pending',
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  return { uploadPhoto, saveClassPhoto, saveStudioPhoto, uploading, error }
}
