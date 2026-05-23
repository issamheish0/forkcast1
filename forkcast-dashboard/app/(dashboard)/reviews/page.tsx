// app/(dashboard)/reviews/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery } from "@tanstack/react-query"
import { useRestaurantContext } from "@/lib/contexts/restaurant-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReviewReply } from "@/components/reviews/review-reply"
import { toast } from "react-hot-toast"
import { 
  Star, 
  Search, 
  MessageSquare,
  ThumbsUp,
  Filter,
  Calendar
} from "lucide-react"
import { format } from "date-fns"

// Type definitions
type Review = {
  id: string
  booking_id: string
  user_id: string
  restaurant_id: string
  rating: number
  comment?: string
  created_at: string
  updated_at: string
  food_rating?: number
  service_rating?: number
  ambiance_rating?: number
  value_rating?: number
  recommend_to_friend?: boolean
  visit_again?: boolean
  tags?: string[]
  photos?: string[]
  user?: {
    id: string
    full_name: string
    avatar_url?: string
  }
  booking?: {
    id: string
    booking_time: string
    party_size: number
  }
  reply?: {
    id: string
    reply_message: string
    created_at: string
    staff_member?: {
      full_name: string
      avatar_url?: string
    }
  }
}

type ReviewStats = {
  total_reviews: number
  average_rating: number
  rating_distribution: Record<string, number>
  detailed_ratings: {
    food_avg: number
    service_avg: number
    ambiance_avg: number
    value_avg: number
  }
  recommendation_percentage: number
}

export default function ReviewsPage() {
  const supabase = createClient()
  const { currentRestaurant } = useRestaurantContext()
  const [searchQuery, setSearchQuery] = useState("")
  const [ratingFilter, setRatingFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [restaurantId, setRestaurantId] = useState<string>("")

  // Set restaurant ID from current restaurant context
  useEffect(() => {
    if (currentRestaurant) {
      setRestaurantId(currentRestaurant.restaurant.id)
    } else {
      setRestaurantId("")
    }
  }, [currentRestaurant])

  // Fetch reviews
  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["restaurant-reviews", restaurantId, sortBy],
    queryFn: async () => {
      if (!restaurantId) return []

      let query = supabase
        .from("reviews")
        .select(`
          *,
          user:profiles(id, full_name, avatar_url),
          booking:bookings(id, booking_time, party_size),
          reply:review_replies!review_replies_review_id_fkey(
            id,
            reply_message,
            created_at,
            staff_member:profiles!review_replies_replied_by_fkey(full_name, avatar_url)
          )
        `)
        .eq("restaurant_id", restaurantId)

      // Apply sorting
      if (sortBy === "newest") {
        query = query.order("created_at", { ascending: false })
      } else if (sortBy === "oldest") {
        query = query.order("created_at", { ascending: true })
      } else if (sortBy === "highest") {
        query = query.order("rating", { ascending: false })
      } else if (sortBy === "lowest") {
        query = query.order("rating", { ascending: true })
      }

      const { data, error } = await query

      if (error) throw error

      // Transform reply from array to single object (one-to-one relationship)
      const transformedData = data?.map(review => ({
        ...review,
        reply: Array.isArray(review.reply)
          ? (review.reply.length > 0 ? review.reply[0] : null)
          : review.reply
      }))

      return transformedData as Review[]
    },
    enabled: !!restaurantId,
    staleTime: 0,
    gcTime: 0,
  })

  // Calculate review statistics
  const reviewStats: ReviewStats | null = reviews ? {
    total_reviews: reviews.length,
    average_rating: reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : 0,
    rating_distribution: reviews.reduce((dist, review) => {
      dist[review.rating] = (dist[review.rating] || 0) + 1
      return dist
    }, {} as Record<string, number>),
    detailed_ratings: {
      food_avg: reviews.filter(r => r.food_rating).length > 0
        ? reviews.reduce((sum, r) => sum + (r.food_rating || 0), 0) / reviews.filter(r => r.food_rating).length
        : 0,
      service_avg: reviews.filter(r => r.service_rating).length > 0
        ? reviews.reduce((sum, r) => sum + (r.service_rating || 0), 0) / reviews.filter(r => r.service_rating).length
        : 0,
      ambiance_avg: reviews.filter(r => r.ambiance_rating).length > 0
        ? reviews.reduce((sum, r) => sum + (r.ambiance_rating || 0), 0) / reviews.filter(r => r.ambiance_rating).length
        : 0,
      value_avg: reviews.filter(r => r.value_rating).length > 0
        ? reviews.reduce((sum, r) => sum + (r.value_rating || 0), 0) / reviews.filter(r => r.value_rating).length
        : 0,
    },
    recommendation_percentage: reviews.filter(r => r.recommend_to_friend).length > 0
      ? (reviews.filter(r => r.recommend_to_friend).length / reviews.length) * 100
      : 0,
  } : null

  // Filter reviews
  const filteredReviews = reviews?.filter((review) => {
    const matchesSearch = !searchQuery || 
      review.comment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.user?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesRating = ratingFilter === "all" || 
      review.rating.toString() === ratingFilter
    
    return matchesSearch && matchesRating
  })

  // Render star rating
  const renderStars = (rating: number, size: number = 16) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
          />
        ))}
      </div>
    )
  }

  if (reviewsLoading) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-yellow-500 flex items-center justify-center">
              <Star className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Reviews</h1>
              <p className="text-xs text-muted-foreground">Customer feedback & ratings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Pills */}
      {reviewStats && (
        <div className="flex-shrink-0 px-3 py-2 border-b">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <div className="px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium whitespace-nowrap flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {reviewStats.total_reviews} Reviews
            </div>
            <div className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium whitespace-nowrap flex items-center gap-1">
              <Star className="h-3 w-3" />
              {reviewStats.average_rating.toFixed(1)} Avg
            </div>
            <div className="px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium whitespace-nowrap">
              🍽️ {reviewStats.detailed_ratings.food_avg.toFixed(1)} Food
            </div>
            <div className="px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium whitespace-nowrap">
              🛎️ {reviewStats.detailed_ratings.service_avg.toFixed(1)} Service
            </div>
            <div className="px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-medium whitespace-nowrap flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              {reviewStats.recommendation_percentage.toFixed(0)}% Recommend
            </div>
          </div>
        </div>
      )}

      {/* Compact Filters Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-muted/30">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-8 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="h-10 w-full sm:w-[110px] text-xs flex-1 sm:flex-none">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="5">5 stars</SelectItem>
                <SelectItem value="4">4 stars</SelectItem>
                <SelectItem value="3">3 stars</SelectItem>
                <SelectItem value="2">2 stars</SelectItem>
                <SelectItem value="1">1 star</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 w-full sm:w-[110px] text-xs flex-1 sm:flex-none">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="highest">Highest</SelectItem>
                <SelectItem value="lowest">Lowest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {/* Rating Distribution Card */}
          {reviewStats && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-xs font-medium">Rating Distribution</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-1.5">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count = reviewStats.rating_distribution[rating] || 0
                    const percentage = reviewStats.total_reviews > 0
                      ? (count / reviewStats.total_reviews) * 100
                      : 0

                    return (
                      <div key={rating} className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 w-10">
                          <span className="text-xs font-medium">{rating}</span>
                          <Star size={10} className="fill-yellow-400 text-yellow-400" />
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-yellow-400 h-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-12 text-right">
                          {count} ({percentage.toFixed(0)}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reviews List */}
          {filteredReviews?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              {searchQuery || ratingFilter !== "all" 
                ? "No reviews found matching your filters" 
                : "No reviews yet"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredReviews?.map((review) => (
                <Card key={review.id} className="border-0 shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={review.user?.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {review.user?.full_name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="text-sm font-medium">{review.user?.full_name}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Calendar className="h-2.5 w-2.5" />
                            {format(new Date(review.created_at), "MMM d, yyyy")}
                            {review.booking && (
                              <>
                                <span>•</span>
                                <span>Party of {review.booking.party_size}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {renderStars(review.rating, 14)}
                    </div>

                    {review.comment && (
                      <p className="text-xs text-gray-700 mb-2 line-clamp-3">
                        {review.comment}
                      </p>
                    )}

                    {/* Detailed ratings */}
                    {(review.food_rating || review.service_rating || review.ambiance_rating || review.value_rating) && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {review.food_rating && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span>Food:</span>
                            {renderStars(review.food_rating, 10)}
                          </div>
                        )}
                        {review.service_rating && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span>Service:</span>
                            {renderStars(review.service_rating, 10)}
                          </div>
                        )}
                        {review.ambiance_rating && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span>Ambiance:</span>
                            {renderStars(review.ambiance_rating, 10)}
                          </div>
                        )}
                        {review.value_rating && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span>Value:</span>
                            {renderStars(review.value_rating, 10)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tags and recommendations */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {review.recommend_to_friend && (
                        <Badge variant="outline" className="text-green-600 text-[10px] h-5 px-1.5">
                          <ThumbsUp className="h-2.5 w-2.5 mr-0.5" />
                          Recommend
                        </Badge>
                      )}
                      {review.visit_again && (
                        <Badge variant="outline" className="text-blue-600 text-[10px] h-5 px-1.5">
                          Visit again
                        </Badge>
                      )}
                      {review.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* Review Reply */}
                    <ReviewReply
                      reviewId={review.id}
                      restaurantId={restaurantId}
                      existingReply={review.reply ? {
                        id: review.reply.id,
                        reply_message: review.reply.reply_message,
                        created_at: review.reply.created_at,
                        staff_member: review.reply.staff_member
                      } : undefined}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

