"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "react-hot-toast"
import { MessageSquare, Send, X } from "lucide-react"
import { format } from "date-fns"

interface ReviewReplyProps {
  reviewId: string
  restaurantId: string
  existingReply?: {
    id: string
    reply_message: string
    created_at: string
    staff_member?: {
      full_name: string
      avatar_url?: string
    }
  }
}

export function ReviewReply({ reviewId, restaurantId, existingReply }: ReviewReplyProps) {
  const [isReplying, setIsReplying] = useState(false)
  const [replyMessage, setReplyMessage] = useState(existingReply?.reply_message || "")
  const supabase = createClient()
  const queryClient = useQueryClient()

  const replyMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Get staff data to ensure user is authorized to reply
      const { data: staffData } = await supabase
        .from("restaurant_staff")
        .select("id, user_id")
        .eq("user_id", user.id)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .single()

      if (!staffData) throw new Error("Not authorized to reply")

      if (existingReply) {
        // Update existing reply
        const { data, error } = await supabase
          .from("review_replies")
          .update({
            reply_message: message,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingReply.id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        // Create new reply
        const { data, error } = await supabase
          .from("review_replies")
          .insert({
            review_id: reviewId,
            restaurant_id: restaurantId,
            replied_by: user.id,
            reply_message: message
          })
          .select()
          .single()

        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      toast.success(existingReply ? "Reply updated successfully" : "Reply posted successfully")
      setIsReplying(false)
      queryClient.invalidateQueries({
        queryKey: ["restaurant-reviews", restaurantId],
        refetchType: 'all'
      })
    },
    onError: (error) => {
      toast.error(error.message || "Failed to post reply")
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingReply) return

      const { data, error } = await supabase
        .from("review_replies")
        .delete()
        .eq("id", existingReply.id)
        .select()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success("Reply deleted successfully")
      queryClient.invalidateQueries({
        queryKey: ["restaurant-reviews", restaurantId],
        refetchType: 'all'
      })
    },
    onError: () => {
      toast.error("Failed to delete reply")
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyMessage.trim()) return
    replyMutation.mutate(replyMessage.trim())
  }

  if (existingReply && !isReplying) {
    return (
      <Card className="mt-4 bg-secondary/50 border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm text-primary">
                Restaurant Response
              </CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsReplying(true)}
                className="text-primary hover:text-primary/80 hover:bg-secondary/50"
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-destructive hover:text-destructive/80"
              >
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <Avatar className="h-6 w-6">
              <AvatarImage src={existingReply.staff_member?.avatar_url} />
              <AvatarFallback className="text-xs bg-secondary text-primary">
                {existingReply.staff_member?.full_name?.split(" ").map(n => n[0]).join("") || "R"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-primary">
                  {existingReply.staff_member?.full_name || "Restaurant"}
                </span>
                <span className="text-xs text-muted-foreground text-sm">{format(new Date(existingReply.created_at), "PPP")}
                </span>
              </div>
              <p className="text-sm text-foreground">
                {existingReply.reply_message}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mt-4">
      {!isReplying ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsReplying(true)}
          className="text-primary border-border hover:bg-secondary/50"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Reply to review
        </Button>
      ) : (
        <Card className="bg-secondary/50 border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-primary">
                {existingReply ? "Edit Reply" : "Reply to Review"}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsReplying(false)
                  setReplyMessage(existingReply?.reply_message || "")
                }}
                className="hover:bg-secondary/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Write your response to this review..."
                className="min-h-[100px] resize-none bg-background border-input focus:ring-primary focus:border-primary"
                maxLength={1000}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground text-sm">{replyMessage.length}/1000 characters
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsReplying(false)
                      setReplyMessage(existingReply?.reply_message || "")
                    }}
                    className="hover:bg-secondary/50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!replyMessage.trim() || replyMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {replyMutation.isPending 
                      ? "Posting..." 
                      : existingReply 
                        ? "Update Reply"
                        : "Post Reply"
                    }
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
