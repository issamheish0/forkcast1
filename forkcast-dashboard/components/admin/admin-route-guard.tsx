'use client'

import { useAdminPermissions } from '@/hooks/use-admin-permissions'
import { Loader2 } from 'lucide-react'
import { AccessDenied } from './access-denied'

interface AdminRouteGuardProps {
  children: React.ReactNode
  requiredSection: string
}

export function AdminRouteGuard({ children, requiredSection }: AdminRouteGuardProps) {
  const { hasSectionAccess, loading, isSuperAdmin } = useAdminPermissions()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 motion-safe:animate-spin text-gray-400" />
      </div>
    )
  }

  // Super admins have access to everything
  if (isSuperAdmin) {
    return <>{children}</>
  }

  // Check if user has access to this section
  if (!hasSectionAccess(requiredSection)) {
    return <AccessDenied />
  }

  return <>{children}</>
}


