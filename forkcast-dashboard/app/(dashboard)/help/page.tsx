// app/(dashboard)/help/page.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, BookOpen, LifeBuoy } from "lucide-react"
import Link from "next/link"

export default function HelpPage() {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header Bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-cyan-500 flex items-center justify-center">
              <LifeBuoy className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Help & Support</h1>
              <p className="text-xs text-muted-foreground">Guides & customer support</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Documentation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-sm">Read setup guides and best practices to get the most out of the app.
            </p>
            <Link href="/README" prefetch={false}>
              <Button variant="outline" className="w-full">View Docs</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5" />
              Troubleshooting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-sm">Common issues and solutions for bookings, schedules, and PWA.
            </p>
            <Link href="/docs/booking-system" prefetch={false}>
              <Button variant="outline" className="w-full">Open Guide</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Support
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground text-sm">Need help? Reach out and we’ll get back to you shortly.
            </p>
            <a href="mailto:your-restaurant@example.com">
              <Button className="w-full">Email Support</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
  )
}



