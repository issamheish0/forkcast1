"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const [countdown, setCountdown] = useState(5)

  // Auto-close the tab after a short countdown (guest flow — they came from an in-app link)
  useEffect(() => {
    if (countdown <= 0) {
      window.close()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Payment Successful</h1>

        <p className="text-gray-500 text-sm leading-relaxed">
          Your payment has been confirmed. The restaurant will be notified and your booking is secured.
        </p>

        {sessionId && (
          <p className="text-xs text-gray-400 font-mono break-all bg-gray-50 rounded-lg p-2">
            Ref: {sessionId.slice(-12)}
          </p>
        )}

        <p className="text-sm text-gray-400">
          {countdown > 0 ? (
            <>This tab will close in <strong>{countdown}</strong>s…</>
          ) : (
            "You can close this tab."
          )}
        </p>

        <button
          onClick={() => window.close()}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
