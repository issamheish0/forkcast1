"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { RestaurantTableCombinationWithTables } from "@/types"
import { toast } from "react-hot-toast"
import { tableCombinationsService } from "@/lib/services/table-combinations-service"

export function useTableCombinations(restaurantId: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["table-combinations", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      
      const { data, error } = await supabase
        .from("table_combinations")
        .select(`
          id,
          restaurant_id,
          primary_table_id,
          secondary_table_id,
          combined_capacity,
          is_active,
          created_at,
          updated_at,
          primary_table:restaurant_tables!table_combinations_primary_table_id_fkey(
            id,
            table_number,
            max_capacity,
            section_id,
            status
          ),
          secondary_table:restaurant_tables!table_combinations_secondary_table_id_fkey(
            id,
            table_number,
            max_capacity,
            section_id,
            status
          )
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)

      if (error) {
        console.error("Error fetching table combinations:", error)
        throw error
      }
      
      return data as unknown as RestaurantTableCombinationWithTables[]
    },
    enabled: !!restaurantId,
  })
}

export function useCreateTableCombination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      restaurantId,
      primaryTableId,
      secondaryTableId,
      combinedCapacity,
    }: {
      restaurantId: string
      primaryTableId: string
      secondaryTableId: string
      combinedCapacity: number
    }) => {
      await tableCombinationsService.createCombination(
        restaurantId,
        primaryTableId,
        secondaryTableId,
        combinedCapacity
      )
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["table-combinations", variables.restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["tables-with-sections", variables.restaurantId] })
      toast.success("Table combination created successfully")
    },
    onError: (error: any) => {
      console.error("Error creating table combination:", error)
      
      // Parse database errors for better user experience
      let errorMessage = "Failed to create table combination"
      
      if (error?.message) {
        // Check for unique constraint violation (duplicate combination)
        if (error.message.includes('duplicate key') || 
            error.message.includes('violates unique constraint') ||
            error.message.includes('already exists')) {
          errorMessage = "Table combination already exists!"
        }
        // Check for foreign key constraint violations
        else if (error.message.includes('table_combinations_primary_table_id_fkey') ||
                 error.message.includes('table_combinations_secondary_table_id_fkey')) {
          errorMessage = "One of the selected tables is no longer valid. Please refresh and try again."
        }
        else if (error.message.includes('table_combinations_restaurant_id_fkey')) {
          errorMessage = "Invalid restaurant. Please refresh and try again."
        }
        // Check for check constraint violations
        else if (error.message.includes('violates check constraint')) {
          errorMessage = "Invalid combination settings. Please check your inputs."
        }
        // Check for null violations
        else if (error.message.includes('violates not-null constraint')) {
          errorMessage = "Required information is missing. Please fill out all fields."
        }
        // Show specific error message if it's user-friendly
        else if (error.message.length < 100 && !error.message.includes('function') && !error.message.includes('relation')) {
          errorMessage = error.message
        }
      }
      
      toast.error(errorMessage)
    },
  })
}

export function useDeleteTableCombination() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      await tableCombinationsService.deleteCombination(id)
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["table-combinations", variables.restaurantId] })
      queryClient.invalidateQueries({ queryKey: ["tables-with-sections", variables.restaurantId] })
      toast.success("Table combination deleted successfully")
    },
    onError: (error: any) => {
      console.error("Error deleting table combination:", error)
      toast.error("Failed to delete table combination")
    },
  })
}
