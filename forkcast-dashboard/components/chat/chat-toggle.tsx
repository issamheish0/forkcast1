"use client"

import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useStaffChat } from "@/lib/contexts/staff-chat-context"

export function StaffChatToggle() {
  const { toggle } = useStaffChat()
  return (
    <Button
      onClick={toggle}
      size="icon"
      className="h-10 w-10 rounded-full shadow-lg fixed bottom-4 right-4 z-[70] bg-primary text-primary-foreground hover:bg-primary/90"
      aria-label="Open staff chat"
    >
      <MessageSquare className="h-5 w-5" />
    </Button>
  )
}

export default StaffChatToggle


