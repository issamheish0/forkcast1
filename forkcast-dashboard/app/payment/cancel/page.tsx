"use client"

import { useEffect, useState } from "react"
import { XCircle } from "lucide-react"

export default function PaymentCancelPage() {
  const [countdown, setCountdown] = useState(8)

  useEffect(() => {
    if (countdown <= 0) {
      window.close()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-rose-50 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Payment Cancelled</h1>

        <p className="text-gray-500 text-sm leading-relaxed">
          You cancelled the payment process. Your booking has not been charged. Please contact the restaurant if you need to complete your payment.
        </p>

        <p className="text-sm text-gray-400">
          {countdown > 0 ? (
            <>This tab will close in <strong>{countdown}</strong>s…</>
          ) : (
            "You can close this tab."
          )}
        </p>

        <button
          onClick={() => window.close()}
          className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
        >
          Close
        </button>
      </div>
    </div>
  )
}
