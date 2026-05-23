"use client"

import React from 'react'
import { X, Calendar, Bell, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Notification } from '@/lib/contexts/notification-context'

interface NotificationBannerProps {
  notification: Notification
  onDismiss: (id: string) => void
}

export function NotificationBanner({ notification, onDismiss }: NotificationBannerProps) {
  
  const getIcon = () => {
    switch (notification.type) {
      case 'booking':
        if (notification.variant === 'success') return <CheckCircle2 className="h-5 w-5 text-green-600" />
        if (notification.variant === 'error') return <AlertCircle className="h-5 w-5 text-red-600" />
        return <Calendar className="h-5 w-5 text-blue-600" />
      case 'order':
        return <Bell className="h-5 w-5 text-orange-600" />
      case 'general':
        return <AlertCircle className="h-5 w-5 text-gray-600" />
      default:
        return <Bell className="h-5 w-5 text-gray-600" />
    }
  }

  const getBannerColor = () => {
    if (notification.variant === 'success') return 'bg-green-50 border-green-200'
    if (notification.variant === 'error') return 'bg-red-50 border-red-200'
    if (notification.variant === 'warning') return 'bg-yellow-50 border-yellow-200'
    if (notification.type === 'booking') return 'bg-blue-50 border-blue-200'
    if (notification.type === 'order') return 'bg-orange-50 border-orange-200'
    return 'bg-gray-50 border-gray-200'
  }

  const formatTime = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const seconds = Math.floor(diff / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      className={cn(
        "w-full rounded-lg border shadow-xl backdrop-blur bg-white/90",
        "ring-1 ring-black/5",
        getBannerColor()
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-slate-900 truncate">
                {notification.title}
              </h4>
              <Badge 
                variant="secondary" 
                className="text-[10px] px-2 py-0.5 bg-slate-100/80 text-slate-600"
              >
                {notification.type}
              </Badge>
            </div>
            
            <p className="text-sm text-slate-700 mb-2 line-clamp-2">
              {notification.message}
            </p>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {formatTime(notification.timestamp)}
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(notification.id)}
                className="h-5 w-5 p-0 hover:bg-slate-100"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
