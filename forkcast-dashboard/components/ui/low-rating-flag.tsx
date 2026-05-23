// components/ui/low-rating-flag.tsx
"use client"

import { AlertTriangle, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface LowRatingFlagProps {
  rating: number
  threshold?: number
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  className?: string
}

export function LowRatingFlag({ 
  rating, 
  threshold = 2, 
  size = "sm",
  showValue = false,
  className 
}: LowRatingFlagProps) {
  // Only show flag if rating is at or below threshold
  if (rating > threshold) {
    return null
  }

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4", 
    lg: "h-5 w-5"
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="destructive" 
            className={cn(
              "flex items-center gap-1 bg-red-100 text-red-800 border-red-300 hover:bg-red-200",
              textSizeClasses[size],
              className
            )}
          >
            <AlertTriangle className={sizeClasses[size]} />
            {showValue && (
              <>
                <Star className={cn(sizeClasses[size], "fill-current")} />
                <span>{rating.toFixed(1)}</span>
              </>
            )}
            {!showValue && "Low Rating"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Customer Rating: {rating.toFixed(1)}/5.0</p>
            <p className="text-xs text-muted-foreground text-sm">This customer has a rating below {threshold + 0.1}. 
              Please exercise extra caution and provide exceptional service.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface CustomerRatingDisplayProps {
  rating: number
  threshold?: number
  showStars?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

export function CustomerRatingDisplay({
  rating,
  threshold = 2,
  showStars = true,
  size = "sm",
  className
}: CustomerRatingDisplayProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  }

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm", 
    lg: "text-base"
  }

  const isLowRating = rating <= threshold
  
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {showStars && (
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                sizeClasses[size],
                star <= rating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              )}
            />
          ))}
        </div>
      )}
      <span className={cn(
        textSizeClasses[size],
        "font-medium",
        isLowRating ? "text-red-600" : "text-gray-700"
      )}>
        {rating.toFixed(1)}
      </span>
      {isLowRating && (
        <LowRatingFlag 
          rating={rating} 
          threshold={threshold}
          size={size}
        />
      )}
    </div>
  )
}
