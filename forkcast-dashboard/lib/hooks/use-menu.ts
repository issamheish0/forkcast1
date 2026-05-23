/**
 * Menu Hooks
 * 
 * React Query hooks for menu data management.
 * Replaces API routes: /api/menu/categories, /api/menu/items, /api/menu/items/[id]
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

/**
 * Get all menu categories for a restaurant
 */
export function useMenuCategories(restaurantId: string) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['menu-categories', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_categories')
        .select(`
          id,
          restaurant_id,
          name,
          description,
          display_order,
          is_active,
          created_at,
          updated_at
        `)
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) {
        console.error('Error fetching menu categories:', error)
        throw new Error('Failed to load menu categories')
      }

      return data || []
    },
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Get all menu items for a restaurant, optionally filtered by category
 */
export function useMenuItems(restaurantId: string, categoryId?: string) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['menu-items', restaurantId, categoryId],
    queryFn: async () => {
      let query = supabase
        .from('menu_items')
        .select(`
          id,
          restaurant_id,
          category_id,
          name,
          description,
          price,
          image_url,
          allergens,
          dietary_info,
          preparation_time,
          is_available,
          is_featured,
          display_order,
          created_at,
          updated_at,
          category:menu_categories!menu_items_category_id_fkey(
            id,
            name,
            display_order
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('is_available', true)

      if (categoryId) {
        query = query.eq('category_id', categoryId)
      }

      query = query.order('display_order', { ascending: true })

      const { data, error } = await query

      if (error) {
        console.error('Error fetching menu items:', error)
        throw new Error('Failed to load menu items')
      }

      return data || []
    },
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Get a single menu item by ID
 */
export function useMenuItem(itemId: string) {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['menu-item', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          id,
          restaurant_id,
          category_id,
          name,
          description,
          price,
          image_url,
          allergens,
          dietary_info,
          preparation_time,
          is_available,
          is_featured,
          display_order,
          ingredients,
          nutritional_info,
          created_at,
          updated_at,
          category:menu_categories!menu_items_category_id_fkey(
            id,
            name,
            description
          ),
          restaurant:restaurants!menu_items_restaurant_id_fkey(
            id,
            name
          )
        `)
        .eq('id', itemId)
        .single()

      if (error) {
        console.error('Error fetching menu item:', error)
        throw new Error('Failed to load menu item')
      }

      return data
    },
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Create a new menu category
 */
export function useCreateMenuCategory() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (categoryData: {
      restaurant_id: string
      name: string
      description?: string
      display_order?: number
    }) => {
      const { data, error } = await supabase
        .from('menu_categories')
        .insert([{
          ...categoryData,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating menu category:', error)
        throw new Error('Failed to create menu category')
      }

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories', data.restaurant_id] })
      toast.success('Menu category created successfully')
    },
    onError: (error) => {
      console.error('Error creating menu category:', error)
      toast.error('Failed to create menu category')
    }
  })
}

/**
 * Update a menu category
 */
export function useUpdateMenuCategory() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ categoryId, updates }: { 
      categoryId: string
      updates: Partial<{
        name: string
        description: string
        display_order: number
        is_active: boolean
      }>
    }) => {
      const { data, error } = await supabase
        .from('menu_categories')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', categoryId)
        .select()
        .single()

      if (error) {
        console.error('Error updating menu category:', error)
        throw new Error('Failed to update menu category')
      }

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories', data.restaurant_id] })
      toast.success('Menu category updated successfully')
    },
    onError: (error) => {
      console.error('Error updating menu category:', error)
      toast.error('Failed to update menu category')
    }
  })
}

/**
 * Create a new menu item
 */
export function useCreateMenuItem() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (itemData: {
      restaurant_id: string
      category_id: string
      name: string
      description?: string
      price: number
      image_url?: string
      allergens?: string[]
      dietary_info?: string[]
      preparation_time?: number
      display_order?: number
    }) => {
      const { data, error } = await supabase
        .from('menu_items')
        .insert([{
          ...itemData,
          is_available: true,
          is_featured: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (error) {
        console.error('Error creating menu item:', error)
        throw new Error('Failed to create menu item')
      }

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['menu-items', data.restaurant_id] })
      queryClient.invalidateQueries({ queryKey: ['menu-categories', data.restaurant_id] })
      toast.success('Menu item created successfully')
    },
    onError: (error) => {
      console.error('Error creating menu item:', error)
      toast.error('Failed to create menu item')
    }
  })
}

/**
 * Update a menu item
 */
export function useUpdateMenuItem() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({ itemId, updates }: { 
      itemId: string
      updates: Partial<{
        name: string
        description: string
        price: number
        image_url: string
        allergens: string[]
        dietary_info: string[]
        preparation_time: number
        is_available: boolean
        is_featured: boolean
        display_order: number
      }>
    }) => {
      const { data, error } = await supabase
        .from('menu_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single()

      if (error) {
        console.error('Error updating menu item:', error)
        throw new Error('Failed to update menu item')
      }

      return data
    },
    onSuccess: (data, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: ['menu-item', itemId] })
      queryClient.invalidateQueries({ queryKey: ['menu-items', data.restaurant_id] })
      toast.success('Menu item updated successfully')
    },
    onError: (error) => {
      console.error('Error updating menu item:', error)
      toast.error('Failed to update menu item')
    }
  })
}

/**
 * Delete a menu item (soft delete by setting is_available to false)
 */
export function useDeleteMenuItem() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase
        .from('menu_items')
        .update({
          is_available: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single()

      if (error) {
        console.error('Error deleting menu item:', error)
        throw new Error('Failed to delete menu item')
      }

      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['menu-items', data.restaurant_id] })
      toast.success('Menu item removed successfully')
    },
    onError: (error) => {
      console.error('Error deleting menu item:', error)
      toast.error('Failed to remove menu item')
    }
  })
}
