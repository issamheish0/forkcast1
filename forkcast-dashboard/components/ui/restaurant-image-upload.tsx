"use client"

import { useState, useCallback, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { toast } from "react-hot-toast"
import { 
  Upload, 
  X, 
  Image as ImageIcon, 
  Star,
  Loader2,
  Camera,
  AlertCircle
} from "lucide-react"
import Image from "next/image"

interface RestaurantImageUploadProps {
  restaurantId: string
  mainImageUrl?: string
  images?: string[]
  onMainImageChange?: (url: string) => void
  onImagesChange?: (urls: string[]) => void
  maxImages?: number
  maxFileSize?: number // in MB
}

interface UploadProgress {
  id: string
  file: File
  progress: number
  url?: string
  error?: string
}

export function RestaurantImageUpload({
  restaurantId,
  mainImageUrl,
  images = [],
  onMainImageChange,
  onImagesChange,
  maxImages = 10,
  maxFileSize = 5
}: RestaurantImageUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [currentImages, setCurrentImages] = useState<string[]>(images)
  const [currentMainImage, setCurrentMainImage] = useState<string | undefined>(mainImageUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Keep Supabase client stable across renders
  const supabaseRef = useRef(createClient())

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file'
    }

    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size must be less than ${maxFileSize}MB`
    }

    // Check supported formats
    const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!supportedFormats.includes(file.type)) {
      return 'Supported formats: JPEG, PNG, WebP'
    }

    return null
  }, [maxFileSize])

  const generateFileName = useCallback((file: File, isMainImage: boolean = false): string => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(7)
    const extension = file.name.split('.').pop()
    const prefix = isMainImage ? 'main' : 'gallery'
    return `${restaurantId}/${prefix}_${timestamp}_${random}.${extension}`
  }, [restaurantId])

  const uploadToSupabase = async (
    file: File, 
    fileName: string, 
    bucket: string,
    uploadId: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Create a file reader to track progress
      const reader = new FileReader()
      
      reader.onload = async () => {
        try {
          const { error: uploadError, data } = await supabaseRef.current.storage
            .from(bucket)
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) throw uploadError

          // Get public URL
          const { data: { publicUrl } } = supabaseRef.current.storage
            .from(bucket)
            .getPublicUrl(fileName)

          setUploads(prev => 
            prev.map(u => 
              u.id === uploadId 
                ? { ...u, progress: 100, url: publicUrl }
                : u
            )
          )

          resolve(publicUrl)
        } catch (error: any) {
          setUploads(prev => 
            prev.map(u => 
              u.id === uploadId 
                ? { ...u, error: error.message }
                : u
            )
          )
          reject(error)
        }
      }

      reader.onerror = () => {
        const error = 'Failed to read file'
        setUploads(prev => 
          prev.map(u => 
            u.id === uploadId 
              ? { ...u, error }
              : u
          )
        )
        reject(new Error(error))
      }

      // Simulate progress for better UX
      let progress = 0
      const interval = setInterval(() => {
        progress += 10
        if (progress < 90) {
          setUploads(prev => 
            prev.map(u => 
              u.id === uploadId 
                ? { ...u, progress }
                : u
            )
          )
        } else {
          clearInterval(interval)
        }
      }, 100)

      reader.readAsArrayBuffer(file)
    })
  }

  const handleFiles = useCallback(async (files: FileList, forceMainImage: boolean = false) => {
    const fileArray = Array.from(files)
    
    // Check total images limit
    if (!forceMainImage && currentImages.length + fileArray.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`)
      return
    }

    // Validate files
    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        toast.error(`${file.name}: ${error}`)
        return
      }
    }

    // Create upload progress tracking
    const newUploads: UploadProgress[] = fileArray.map(file => ({
      id: Math.random().toString(36),
      file,
      progress: 0
    }))

    setUploads(prev => [...prev, ...newUploads])

    // Process uploads
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]
      const upload = newUploads[i]
      const isMainImage = forceMainImage || (!currentMainImage && i === 0)
      
      try {
        const fileName = generateFileName(file, isMainImage)
        const bucket = isMainImage ? 'main_images' : 'images'
        
        const url = await uploadToSupabase(file, fileName, bucket, upload.id)
        
        if (isMainImage) {
          setCurrentMainImage(url)
          onMainImageChange?.(url)
          toast.success('Main image uploaded successfully! (Suggested as logo)')
        } else {
          const newImages = [...currentImages, url]
          setCurrentImages(newImages)
          onImagesChange?.(newImages)
          toast.success('Image uploaded successfully!')
        }
      } catch (error: any) {
        toast.error(`Failed to upload ${file.name}: ${error.message}`)
      }
    }

    // Clear completed uploads after delay
    setTimeout(() => {
      setUploads(prev => prev.filter(u => u.error || !u.url))
    }, 2000)
  }, [currentImages, currentMainImage, maxImages, onImagesChange, onMainImageChange, uploadToSupabase, generateFileName, validateFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeImage = async (imageUrl: string, isMainImage: boolean = false) => {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/')
      const bucket = isMainImage ? 'main_images' : 'images'
      const filePath = urlParts.slice(-2).join('/') // restaurantId/filename
      
      // Delete from Supabase storage
      const { error } = await supabaseRef.current.storage
        .from(bucket)
        .remove([filePath])

      if (error) throw error

      if (isMainImage) {
        setCurrentMainImage(undefined)
        onMainImageChange?.('')
        toast.success('Main image removed')
      } else {
        const newImages = currentImages.filter(img => img !== imageUrl)
        setCurrentImages(newImages)
        onImagesChange?.(newImages)
        toast.success('Image removed')
      }
    } catch (error: any) {
      toast.error(`Failed to remove image: ${error.message}`)
    }
  }

  const setAsMainImage = async (imageUrl: string) => {
    try {
      // If there's already a main image, move it to gallery
      if (currentMainImage) {
        const newImages = [...currentImages, currentMainImage]
        setCurrentImages(newImages)
        onImagesChange?.(newImages)
      }

      // Remove from gallery and set as main
      const newImages = currentImages.filter(img => img !== imageUrl)
      setCurrentImages(newImages)
      onImagesChange?.(newImages)
      
      setCurrentMainImage(imageUrl)
      onMainImageChange?.(imageUrl)
      
      toast.success('Set as main image')
    } catch (error: any) {
      toast.error(`Failed to set main image: ${error.message}`)
    }
  }

  const totalImages = (currentMainImage ? 1 : 0) + currentImages.length

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Camera className="w-8 h-8 text-muted-foreground" />
          </div>
          
          <div>
            <h3 className="text-lg font-semibold">Upload Restaurant Images</h3>
            <p className="text-sm text-muted-foreground text-sm">
              Drag and drop images here, or click to select files
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Supports: JPEG, PNG, WebP • Max size: {maxFileSize}MB each • Max {maxImages} images total
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={totalImages >= maxImages}
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose Images
            </Button>
            
            {!currentMainImage && (
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={totalImages >= maxImages}
              >
                <Star className="mr-2 h-4 w-4" />
                Add Logo (Main Image)
              </Button>
            )}
          </div>
          
          <div className="text-xs text-muted-foreground text-sm">{totalImages}/{maxImages} images used
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <Card key={upload.id} className="p-3">
              <div className="flex items-center gap-3">
                <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upload.file.name}</p>
                  {upload.error ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {upload.error}
                    </p>
                  ) : upload.url ? (
                    <p className="text-xs text-green-600">Upload complete</p>
                  ) : (
                    <div className="space-y-1">
                      <Progress value={upload.progress} className="h-1" />
                      <p className="text-xs text-muted-foreground">{upload.progress}%</p>
                    </div>
                  )}
                </div>
                {upload.progress < 100 && !upload.error && (
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin text-muted-foreground" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Main Image Preview */}
      {currentMainImage && (
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            Main Image (Logo)
          </h4>
          <Card className="relative group w-fit">
            <CardContent className="p-2">
              <div className="relative">
                <Image
                  src={currentMainImage}
                  alt="Main restaurant image"
                  width={200}
                  height={150}
                  className="rounded object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeImage(currentMainImage, true)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gallery Images */}
      {currentImages.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Gallery Images ({currentImages.length})
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentImages.map((imageUrl, index) => (
              <Card key={imageUrl} className="relative group">
                <CardContent className="p-2">
                  <div className="relative">
                    <Image
                      src={imageUrl}
                      alt={`Restaurant image ${index + 1}`}
                      width={150}
                      height={100}
                      className="rounded object-cover w-full h-24"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setAsMainImage(imageUrl)}
                          className="h-7 w-7 p-0"
                          title="Set as main image"
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeImage(imageUrl)}
                          className="h-7 w-7 p-0"
                          title="Remove image"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      {totalImages === 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-4 text-center text-sm text-muted-foreground text-sm"><ImageIcon className="h-6 w-6 mx-auto mb-2 opacity-50" />
            No images uploaded yet. Add a main image (logo) and gallery images to showcase your restaurant.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
