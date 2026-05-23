/**
 * Image Compression and WebP Conversion Utility
 *
 * This utility provides functions to:
 * - Compress images to reduce file size
 * - Convert images to WebP format for better performance
 * - Maintain image quality while optimizing size
 */

export interface ImageCompressionOptions {
  /**
   * Maximum width in pixels (default: 1920)
   */
  maxWidth?: number

  /**
   * Maximum height in pixels (default: 1920)
   */
  maxHeight?: number

  /**
   * Quality for compression (0-1, default: 0.85)
   */
  quality?: number

  /**
   * Output format (default: 'webp')
   */
  format?: 'webp' | 'jpeg' | 'png'

  /**
   * Preserve original aspect ratio (default: true)
   */
  preserveAspectRatio?: boolean
}

export interface CompressionResult {
  /**
   * Compressed image as a Blob
   */
  blob: Blob

  /**
   * Compressed image as a File
   */
  file: File

  /**
   * Original file size in bytes
   */
  originalSize: number

  /**
   * Compressed file size in bytes
   */
  compressedSize: number

  /**
   * Compression ratio (0-1)
   */
  compressionRatio: number

  /**
   * Percentage of size reduction
   */
  reductionPercentage: number

  /**
   * Image dimensions after compression
   */
  dimensions: {
    width: number
    height: number
  }
}

/**
 * Compresses and converts an image to WebP format
 *
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise<CompressionResult> - The compressed image and metadata
 */
export async function compressAndConvertImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  // Default options
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    format = 'webp',
    preserveAspectRatio = true
  } = options

  // Validate input
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image')
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        try {
          // Calculate new dimensions
          let { width, height } = calculateDimensions(
            img.width,
            img.height,
            maxWidth,
            maxHeight,
            preserveAspectRatio
          )

          // Create canvas for compression
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            throw new Error('Failed to get canvas context')
          }

          // Enable image smoothing for better quality
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'

          // Draw image on canvas
          ctx.drawImage(img, 0, 0, width, height)

          // Convert to blob with specified format and quality
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'))
                return
              }

              // Generate new filename with correct extension
              const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
              const newFileName = `${originalName}.${format === 'webp' ? 'webp' : format}`

              // Create new File from blob
              const compressedFile = new File([blob], newFileName, {
                type: `image/${format}`,
                lastModified: Date.now()
              })

              // Calculate compression metrics
              const originalSize = file.size
              const compressedSize = blob.size
              const compressionRatio = compressedSize / originalSize
              const reductionPercentage = ((originalSize - compressedSize) / originalSize) * 100

              resolve({
                blob,
                file: compressedFile,
                originalSize,
                compressedSize,
                compressionRatio,
                reductionPercentage,
                dimensions: { width, height }
              })
            },
            `image/${format}`,
            quality
          )
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Calculate optimal dimensions while preserving aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
  preserveAspectRatio: boolean
): { width: number; height: number } {
  if (!preserveAspectRatio) {
    return {
      width: Math.min(originalWidth, maxWidth),
      height: Math.min(originalHeight, maxHeight)
    }
  }

  // If image is already smaller than max dimensions, keep original size
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight }
  }

  // Calculate aspect ratio
  const aspectRatio = originalWidth / originalHeight

  let width = originalWidth
  let height = originalHeight

  // Scale down if width exceeds max
  if (width > maxWidth) {
    width = maxWidth
    height = Math.round(width / aspectRatio)
  }

  // Scale down if height still exceeds max
  if (height > maxHeight) {
    height = maxHeight
    width = Math.round(height * aspectRatio)
  }

  return { width, height }
}

/**
 * Batch compress multiple images
 *
 * @param files - Array of image files to compress
 * @param options - Compression options
 * @param onProgress - Optional progress callback (index, total)
 * @returns Promise<CompressionResult[]> - Array of compression results
 */
export async function compressMultipleImages(
  files: File[],
  options: ImageCompressionOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = []

  for (let i = 0; i < files.length; i++) {
    try {
      const result = await compressAndConvertImage(files[i], options)
      results.push(result)

      if (onProgress) {
        onProgress(i + 1, files.length)
      }
    } catch (error) {
      console.error(`Failed to compress ${files[i].name}:`, error)
      throw error
    }
  }

  return results
}

/**
 * Get estimated compression savings without actually compressing
 * (Uses approximate calculations based on format and quality)
 */
export function estimateCompression(
  fileSize: number,
  currentFormat: string,
  targetFormat: 'webp' | 'jpeg' | 'png' = 'webp',
  quality: number = 0.85
): {
  estimatedSize: number
  estimatedReduction: number
  estimatedReductionPercentage: number
} {
  let compressionFactor = 1

  // Estimate based on format conversion
  if (currentFormat.includes('png') && targetFormat === 'webp') {
    compressionFactor = 0.6 // WebP typically 40% smaller than PNG
  } else if (currentFormat.includes('jpeg') && targetFormat === 'webp') {
    compressionFactor = 0.75 // WebP typically 25% smaller than JPEG
  } else if (currentFormat.includes('png') && targetFormat === 'jpeg') {
    compressionFactor = 0.7 // JPEG typically 30% smaller than PNG
  }

  // Adjust for quality setting
  compressionFactor *= quality

  const estimatedSize = Math.round(fileSize * compressionFactor)
  const estimatedReduction = fileSize - estimatedSize
  const estimatedReductionPercentage = (estimatedReduction / fileSize) * 100

  return {
    estimatedSize,
    estimatedReduction,
    estimatedReductionPercentage
  }
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Validate image file before compression
 */
export function validateImageFile(
  file: File,
  maxSize: number = 10 * 1024 * 1024 // 10MB default
): { valid: boolean; error?: string } {
  // Check if it's an image
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' }
  }

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size must be less than ${formatFileSize(maxSize)}`
    }
  }

  // Check supported formats
  const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!supportedFormats.includes(file.type)) {
    return {
      valid: false,
      error: 'Supported formats: JPEG, PNG, WebP, GIF'
    }
  }

  return { valid: true }
}
