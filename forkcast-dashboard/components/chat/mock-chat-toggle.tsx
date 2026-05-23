"use client"

import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function MockChatToggle() {
  return (
    <Button
      disabled
      size="icon"
      className="h-10 w-10 rounded-full shadow-lg fixed bottom-4 right-4 z-[70] bg-muted text-muted-foreground"
      aria-label="Chat coming soon"
      title="Chat coming soon"
    >
      <MessageSquare className="h-5 w-5" />
    </Button>
  )
}


