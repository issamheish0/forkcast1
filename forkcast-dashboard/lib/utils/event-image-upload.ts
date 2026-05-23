/**
 * Event Image Upload Utilities
 * Handles uploading event images to Supabase storage bucket "event_image"
 */

import { createClient } from '@/lib/supabase/client'

const BUCKET_NAME = 'event_image'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

/**
 * Validates if a file is acceptable for upload
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    }
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, and WebP images are allowed'
    }
  }

  return { valid: true }
}

/**
 * Generates a unique filename for the uploaded image
 */
function generateFileName(originalFileName: string, restaurantId: string): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 8)
  const extension = originalFileName.split('.').pop()
  return `${restaurantId}/events/${timestamp}-${randomString}.${extension}`
}

/**
 * Uploads an event image to the event_image bucket
 * @param file - The image file to upload
 * @param restaurantId - The restaurant ID for organizing files
 * @param oldImageUrl - Optional: URL of the previous image to delete
 * @returns UploadResult with the public URL or error
 */
export async function uploadEventImage(
  file: File,
  restaurantId: string,
  oldImageUrl?: string | null
): Promise<UploadResult> {
  const supabase = createClient()

  try {
    // Validate the file
    const validation = validateImageFile(file)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error
      }
    }

    // Generate unique filename
    const fileName = generateFileName(file.name, restaurantId)

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError.message, uploadError)
      return {
        success: false,
        error: `Upload failed: ${uploadError.message}`
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path)

    // Delete old image if it exists and is from the same bucket
    if (oldImageUrl) {
      await deleteEventImage(oldImageUrl)
    }

    return {
      success: true,
      url: urlData.publicUrl
    }
  } catch (error) {
    console.error('Unexpected error uploading image:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}

/**
 * Deletes an event image from the event_image bucket
 * @param imageUrl - The full public URL of the image
 */
export async function deleteEventImage(imageUrl: string): Promise<void> {
  const supabase = createClient()

  try {
    // Extract the file path from the URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/event_image/{path}
    const urlParts = imageUrl.split(`${BUCKET_NAME}/`)
    if (urlParts.length < 2) {
      console.warn('Invalid image URL format, skipping deletion')
      return
    }

    const filePath = urlParts[1]

    // Delete from storage
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath])

    if (error) {
      console.error('Error deleting image:', error)
      // Don't throw - this is a cleanup operation
    }
  } catch (error) {
    console.error('Unexpected error deleting image:', error)
    // Don't throw - this is a cleanup operation
  }
}

/**
 * Gets the current image URL from form data or existing event
 */
export function getCurrentImageUrl(
  imageUrl?: string | null,
  imageFile?: File | null
): string | null {
  if (imageFile) {
    return URL.createObjectURL(imageFile)
  }
  return imageUrl || null
}

/**
 * Uploads an event menu PDF to the event_image bucket
 * @param file - The PDF file to upload
 * @param restaurantId - The restaurant ID for organizing files
 * @returns UploadResult with the public URL or error
 */
export async function uploadEventMenuPdf(
  file: File,
  restaurantId: string
): Promise<UploadResult> {
  const supabase = createClient()

  try {
    // Validate the file
    if (file.type !== 'application/pdf') {
      return {
        success: false,
        error: 'Only PDF files are allowed'
      }
    }

    if (file.size > 10 * 1024 * 1024) {
      return {
        success: false,
        error: 'PDF file must be less than 10MB'
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 8)
    const fileName = `${restaurantId}/menus/${timestamp}-${randomString}.pdf`

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf'
      })

    if (uploadError) {
      console.error('PDF Upload error:', uploadError)
      return {
        success: false,
        error: 'Failed to upload PDF. Please try again.'
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadData.path)

    return {
      success: true,
      url: urlData.publicUrl
    }
  } catch (error) {
    console.error('Unexpected error uploading PDF:', error)
    return {
      success: false,
      error: 'An unexpected error occurred'
    }
  }
}
