"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ProfileEditRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/settings")
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen">
      Redirecting to Settings…
    </div>
  )
}
