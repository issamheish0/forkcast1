'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldX, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function AccessDenied() {
  const router = useRouter()

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 p-4">
                <ShieldX className="h-12 w-12 text-red-600" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
              <p className="mt-2 text-gray-600">
                You do not have permission to access this page.
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Please contact a super admin if you believe this is an error.
              </p>
            </div>
            <Button
              onClick={() => router.push('/admin')}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
