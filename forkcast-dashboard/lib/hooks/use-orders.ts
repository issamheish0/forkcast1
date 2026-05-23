/**
 * Order Hooks
 * 
 * React Query hooks for order data management.
 * Replaces API routes: /api/orders, /api/orders/[id], /api/orders/[id]/status
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRealtimeHealth } from '@/hooks/use-realtime-health'
import { useAdaptiveBookingConfig } from '@/hooks/use-adaptive-refetch'

export interface OrderFilters {
  status?: string
  date?: string
  kitchen_station?: string
  search?: string
  limit?: number
  offset?: number
}

/**
 * Get all orders for a restaurant with filters
 */
export function useOrders(restaurantId: string, filters: OrderFilters = {}) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['orders', restaurantId, filters],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          booking:bookings!orders_booking_id_fkey(
            id,
            user:profiles!bookings_user_id_fkey(
              id,
              full_name,
              phone_number
            ),
            table:tables!bookings_table_id_fkey(
              id,
              name,
              section
            )
          ),
          items:order_items(
            *,
            menu_item:menu_items!order_items_menu_item_id_fkey(
              id,
              name,
              price,
              preparation_time,
              category:menu_categories!menu_items_category_id_fkey(name)
            )
          )
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      if (filters.date) {
        const startOfDay = new Date(filters.date)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(filters.date)
        endOfDay.setHours(23, 59, 59, 999)
        
        query = query
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString())
      }

      if (filters.kitchen_station) {
        query = query.eq('kitchen_station', filters.kitchen_station)
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching orders:', error)
        throw new Error('Failed to load orders')
      }

      return data || []
    },
    enabled: !!restaurantId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute for real-time updates
  })
}

/**
 * Get a single order by ID
 */
export function useOrder(orderId: string) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          booking:bookings!orders_booking_id_fkey(
            id,
            booking_time,
            party_size,
            special_requests,
            user:profiles!bookings_user_id_fkey(
              id,
              full_name,
              email,
              phone_number,
              allergies,
              dietary_restrictions
            ),
            table:tables!bookings_table_id_fkey(
              id,
              name,
              seats,
              section,
              position_x,
              position_y
            )
          ),
          items:order_items(
            *,
            menu_item:menu_items!order_items_menu_item_id_fkey(
              id,
              name,
              description,
              price,
              preparation_time,
              allergens,
              dietary_info,
              category:menu_categories!menu_items_category_id_fkey(
                id,
                name
              )
            )
          ),
          restaurant:restaurants!orders_restaurant_id_fkey(
            id,
            name
          )
        `)
        .eq('id', orderId)
        .single()

      if (error) {
        console.error('Error fetching order:', error)
        throw new Error('Failed to load order')
      }

      return data
    },
    enabled: !!orderId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Create a new order
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (orderData: {
      restaurant_id: string
      booking_id?: string
      status?: string
      kitchen_station?: string
      special_instructions?: string
      items: Array<{
        menu_item_id: string
        quantity: number
        special_instructions?: string
        price: number
      }>
    }) => {
      // Create the order first
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: orderData.restaurant_id,
          booking_id: orderData.booking_id,
          status: orderData.status || 'pending',
          kitchen_station: orderData.kitchen_station || 'main',
          special_instructions: orderData.special_instructions,
          total_amount: orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
        throw new Error('Failed to create order')
      }

      // Create order items
      const orderItems = orderData.items.map(item => ({
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        special_instructions: item.special_instructions
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        console.error('Error creating order items:', itemsError)
        // Try to cleanup the order if items failed
        await supabase.from('orders').delete().eq('id', order.id)
        throw new Error('Failed to create order items')
      }

      return order
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
      toast.success('Order created successfully')
    },
    onError: (error) => {
      console.error('Error creating order:', error)
      toast.error('Failed to create order')
    }
  })
}

/**
 * Update order status
 */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ orderId, status, notes }: { 
      orderId: string
      status: string
      notes?: string
    }) => {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      }

      // Set completion time for completed orders
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString()
      }

      // Set preparation start time for in-progress orders
      if (status === 'in_progress') {
        updateData.preparation_started_at = new Date().toISOString()
      }

      if (notes) {
        updateData.kitchen_notes = notes
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single()

      if (error) {
        console.error('Error updating order status:', error)
        throw new Error('Failed to update order status')
      }

      return data
    },
    onSuccess: (data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] })
      toast.success(`Order ${data.status.replace('_', ' ')}`)
    },
    onError: (error) => {
      console.error('Error updating order status:', error)
      toast.error('Failed to update order status')
    }
  })
}

/**
 * Get kitchen orders for display
 */
export function useKitchenOrders(restaurantId: string, station?: string) {
  const supabase = createClient()
  const { healthStatus } = useRealtimeHealth()
  const adaptiveConfig = useAdaptiveBookingConfig(healthStatus)
  
  return useQuery({
    queryKey: ['kitchen-orders', restaurantId, station],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          booking:bookings!orders_booking_id_fkey(
            table:tables!bookings_table_id_fkey(name, section)
          ),
          items:order_items(
            *,
            menu_item:menu_items!order_items_menu_item_id_fkey(
              name,
              preparation_time,
              allergens,
              category:menu_categories!menu_items_category_id_fkey(name)
            )
          )
        `)
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'in_progress', 'ready'])
        .order('created_at', { ascending: true })

      if (station) {
        query = query.eq('kitchen_station', station)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching kitchen orders:', error)
        throw new Error('Failed to load kitchen orders')
      }

      return data || []
    },
    enabled: !!restaurantId,
    staleTime: adaptiveConfig.staleTime,
    refetchInterval: adaptiveConfig.refetchInterval,
  })
}
