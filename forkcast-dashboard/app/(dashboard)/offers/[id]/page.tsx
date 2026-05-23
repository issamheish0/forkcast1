// app/(dashboard)/offers/[id]/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { toast } from "react-hot-toast"
import { ArrowLeft, Edit, Trash2, Percent, Calendar, Users, FileText } from "lucide-react"
import { format, isAfter, isBefore, isWithinInterval } from "date-fns"
import type { SpecialOffer } from "@/types"


const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function OfferDetailPage() {
  const { id: offerId } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [isEditing, setIsEditing] = useState(false)

  const { data: offer, isLoading } = useQuery({
    queryKey: ["special-offer", offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("special_offers")
        .select("*")
        .eq("id", offerId)
        .single()

      if (error) throw error
      return data as SpecialOffer
    },
    enabled: !!offerId,
  })

  const offerMutation = useMutation({
    mutationFn: async (offerData: Partial<SpecialOffer>) => {
      const { error } = await supabase
        .from("special_offers")
        .update({ ...offerData, updated_at: new Date().toISOString() })
        .eq("id", offerId as string)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-offer", offerId] })
      queryClient.invalidateQueries({ queryKey: ["special-offers"] })
      toast.success("Offer updated")
      setIsEditing(false)
    },
    onError: () => {
      toast.error("Failed to update offer")
    },
  })

  const deleteOfferMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("special_offers").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-offers"] })
      toast.success("Offer deleted")
      router.push("/offers")
    },
    onError: () => {
      toast.error("Failed to delete offer")
    },
  })

  const getOfferStatus = (offer: SpecialOffer) => {
    const now = new Date()
    const validFrom = new Date(offer.valid_from)
    const validUntil = new Date(offer.valid_until)
    
    if (isWithinInterval(now, { start: validFrom, end: validUntil })) {
      return { label: "Active", variant: "default" as const }
    } else if (isAfter(validFrom, now)) {
      return { label: "Upcoming", variant: "secondary" as const }
    } else {
      return { label: "Expired", variant: "outline" as const }
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading offer details...</div>
  }

  if (!offer) {
    return <div className="flex justify-center items-center h-64">Offer not found.</div>
  }

  const status = getOfferStatus(offer)
  const applicableDays = offer.applicable_days?.map(d => DAYS_OF_WEEK[d]).join(", ")

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Offers
        </Button>
        <div className="flex gap-2">
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button 
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete this offer?")) {
                deleteOfferMutation.mutate(offer.id)
              }
            }}
            disabled={deleteOfferMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Offer</DialogTitle>
          </DialogHeader>
          {/* This form component should be created or imported properly */}
          {/* <OfferForm
            offer={offer}
            onSubmit={(data) => offerMutation.mutate(data)}
            onCancel={() => setIsEditing(false)}
            isLoading={offerMutation.isPending}
          /> */}
          <p className="text-center py-8">Offer form component needs to be implemented here.</p>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl">{offer.title}</CardTitle>
              <CardDescription>{offer.description}</CardDescription>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Percent className="h-5 w-5" /> Discount
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{offer.discount_percentage}%</p>
                <p className="text-sm text-muted-foreground">off on total bill</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5" /> Validity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{format(new Date(offer.valid_from), "PPP")}</p>
                <p className="text-sm text-muted-foreground">to</p>
                <p className="font-medium">{format(new Date(offer.valid_until), "PPP")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" /> Conditions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>Min. {offer.minimum_party_size} guests</p>
                <p className="text-sm text-muted-foreground">on {applicableDays}</p>
              </CardContent>
            </Card>
          </div>
          
          {offer.terms_conditions && offer.terms_conditions.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <FileText className="h-5 w-5" /> Terms & Conditions
              </h3>
              <div className="prose prose-sm text-muted-foreground max-w-none">
                <ul>
                  {offer.terms_conditions.map((term, index) => (
                    <li key={index}>{term}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
