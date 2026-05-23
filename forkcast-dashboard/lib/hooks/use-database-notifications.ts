"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface DatabaseNotification {
  id: string
  type: string
  title: string
  message: string
  data: any
  read: boolean
  created_at: string
  category?: string
  deeplink?: string
}

export function useDatabaseNotifications(restaurantId?: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch notifications from database
  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['database-notifications', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching notifications:', error)
        throw error
      }

      return data as DatabaseNotification[]
    },
    enabled: !!restaurantId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
  })

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', user.id)

    if (!error) {
      // Update the query cache
      queryClient.setQueryData(
        ['database-notifications', restaurantId],
        (oldData: DatabaseNotification[] | undefined) => {
          if (!oldData) return []
          return oldData.map(notification =>
            notification.id === notificationId
              ? { ...notification, read: true }
              : notification
          )
        }
      )
    }
  }

  // Mark all notifications as read
  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('read', false)

    if (!error) {
      // Update the query cache
      queryClient.setQueryData(
        ['database-notifications', restaurantId],
        (oldData: DatabaseNotification[] | undefined) => {
          if (!oldData) return []
          return oldData.map(notification => ({ ...notification, read: true }))
        }
      )
    }
  }

  // Subscribe to real-time updates
  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`notifications-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          console.log('Notification change:', payload)
          // Refetch notifications when there are changes
          queryClient.invalidateQueries({ queryKey: ['database-notifications', restaurantId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, supabase, queryClient])

  const unreadCount = notifications.filter(n => !n.read).length

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['database-notifications', restaurantId] })
  }
}