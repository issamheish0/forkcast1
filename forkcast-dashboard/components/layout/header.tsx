// components/layout/header.tsx

'use client'

import { Bell, User, Menu } from 'lucide-react'
import { useSidebar } from '@/lib/contexts/sidebar-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface HeaderProps {
  restaurant: {
    id: string
    name: string
  }
  user: {
    id: string
    email?: string
  }
  role: string
}

export function Header({ restaurant, user, role }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const { toggleSidebar } = useSidebar()

  const handleSignOut = () => {
    // Full navigation to /logout so server middleware can revoke the
    // refresh token and emit Clear-Site-Data (pentest W11). Client-side
    // signOut + router.push would skip both.
    window.location.href = '/logout'
  }

  return (
    <header className="sticky top-0 z-20 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 md:h-14 lg:h-16 items-center gap-3 md:gap-4 px-3 sm:px-4 md:px-5 lg:px-8">
        <div className="flex flex-1 items-center gap-3 md:gap-4">
          {/* Page breadcrumbs or title can go here */}
        </div>

        <div className="flex items-center gap-2 md:gap-3 lg:gap-4">
          {/* Notifications - Optimized for tablets */}
          <Button variant="ghost" size="icon" className="relative h-6 w-6 md:h-9 md:w-9 touch-manipulation">
            <Bell className="h-4 w-4 md:h-5 md:w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 md:h-4 md:w-4 rounded-full bg-red-600 text-[9px] md:text-[10px] font-medium text-white flex items-center justify-center">
              3
            </span>
          </Button>

          {/* User Menu - Optimized for tablets */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-6 w-6 md:h-9 md:w-9 rounded-full touch-manipulation">
                <Avatar className="h-6 w-6 md:h-9 md:w-9">
                  <AvatarImage src="" alt={user.email} />
                  <AvatarFallback className="text-xs md:text-sm">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.email}</p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {role} at {restaurant.name}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/profile')} className="py-2.5 md:py-2">
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')} className="py-2.5 md:py-2">
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="py-2.5 md:py-2">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
