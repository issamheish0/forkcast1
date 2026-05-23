// lib/services/table-combinations-service.ts
"use client"

import { createClient } from "@/lib/supabase/client"
import type { RestaurantTable } from "@/types"

export class TableCombinationsService {
  private supabase = createClient()

  /**
   * Synchronize table combinations between both systems
   * This is called when table combinable_with is updated via the table form
   */
  async syncCombinationsFromTableForm(
    restaurantId: string,
    tableId: string,
    combinableWith: string[],
    currentTable: RestaurantTable
  ): Promise<void> {
    // Get current combinations for this table from table_combinations
    const { data: existingCombinations, error: fetchError } = await this.supabase
      .from("table_combinations")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .or(`primary_table_id.eq.${tableId},secondary_table_id.eq.${tableId}`)

    if (fetchError) {
      console.error("Error fetching existing combinations:", fetchError)
      throw fetchError
    }

    // Extract currently combined table IDs from existing combinations
    const currentCombinedIds = new Set(
      existingCombinations?.map(combo => 
        combo.primary_table_id === tableId ? combo.secondary_table_id : combo.primary_table_id
      ) || []
    )

    // Find tables to add and remove
    const newCombinableIds = new Set(combinableWith)
    const toAdd = Array.from(newCombinableIds).filter(id => !currentCombinedIds.has(id))
    const toRemove = Array.from(currentCombinedIds).filter(id => !newCombinableIds.has(id))

    // Get table details for capacity calculations
    if (toAdd.length > 0) {
      const { data: tablesToAdd, error: tablesError } = await this.supabase
        .from("restaurant_tables")
        .select("*")
        .in("id", toAdd)

      if (tablesError) {
        console.error("Error fetching tables to add:", tablesError)
        throw tablesError
      }

      // Create new combinations in table_combinations table
      const combinationsToInsert = tablesToAdd?.map(otherTable => ({
        restaurant_id: restaurantId,
        primary_table_id: tableId,
        secondary_table_id: otherTable.id,
        combined_capacity: currentTable.max_capacity + otherTable.max_capacity,
        is_active: true
      })) || []

      if (combinationsToInsert.length > 0) {
        const { error: insertError } = await this.supabase
          .from("table_combinations")
          .insert(combinationsToInsert)

        if (insertError) {
          console.error("Error inserting new combinations:", insertError)
          throw insertError
        }

        // Update the other tables' combinable_with arrays to include this table
        for (const otherTable of tablesToAdd || []) {
          const updatedCombinableWith = [...(otherTable.combinable_with || []), tableId]
          await this.supabase
            .from("restaurant_tables")
            .update({ combinable_with: updatedCombinableWith })
            .eq("id", otherTable.id)
        }
      }
    }

    // Remove old combinations
    if (toRemove.length > 0) {
      // Deactivate combinations in table_combinations
      const combinationsToRemove = existingCombinations?.filter(combo =>
        toRemove.includes(
          combo.primary_table_id === tableId ? combo.secondary_table_id : combo.primary_table_id
        )
      ) || []

      for (const combo of combinationsToRemove) {
        const { error: removeError } = await this.supabase
          .from("table_combinations")
          .update({ is_active: false })
          .eq("id", combo.id)

        if (removeError) {
          console.error("Error removing combination:", removeError)
          throw removeError
        }

        // Update the other table's combinable_with array to remove this table
        const otherTableId = combo.primary_table_id === tableId ? combo.secondary_table_id : combo.primary_table_id
        const { data: otherTableData } = await this.supabase
          .from("restaurant_tables")
          .select("combinable_with")
          .eq("id", otherTableId)
          .single()

        if (otherTableData) {
          const updatedCombinableWith = (otherTableData.combinable_with || []).filter(id => id !== tableId)
          await this.supabase
            .from("restaurant_tables")
            .update({ combinable_with: updatedCombinableWith })
            .eq("id", otherTableId)
        }
      }
    }
  }

  /**
   * Create a combination from the table combinations manager
   * This will also update the combinable_with arrays
   */
  async createCombination(
    restaurantId: string,
    primaryTableId: string,
    secondaryTableId: string,
    combinedCapacity: number
  ): Promise<void> {
    // Check if combination already exists (either direction)
    const { data: existingCombinations, error: checkError } = await this.supabase
      .from("table_combinations")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .or(
        `and(primary_table_id.eq.${primaryTableId},secondary_table_id.eq.${secondaryTableId}),` +
        `and(primary_table_id.eq.${secondaryTableId},secondary_table_id.eq.${primaryTableId})`
      )

    if (checkError) throw checkError

    if (existingCombinations && existingCombinations.length > 0) {
      throw new Error("Table combination already exists!")
    }

    // Create the combination in table_combinations
    const { error: insertError } = await this.supabase
      .from("table_combinations")
      .insert({
        restaurant_id: restaurantId,
        primary_table_id: primaryTableId,
        secondary_table_id: secondaryTableId,
        combined_capacity: combinedCapacity,
      })

    if (insertError) throw insertError

    // Update both tables' combinable_with arrays
    await this.updateTableCombinableWith(primaryTableId, secondaryTableId, 'add')
    await this.updateTableCombinableWith(secondaryTableId, primaryTableId, 'add')
  }

  /**
   * Delete a combination and update combinable_with arrays
   */
  async deleteCombination(combinationId: string): Promise<void> {
    // Get combination details before deleting
    const { data: combination, error: fetchError } = await this.supabase
      .from("table_combinations")
      .select("primary_table_id, secondary_table_id")
      .eq("id", combinationId)
      .single()

    if (fetchError) throw fetchError
    if (!combination) throw new Error("Combination not found")

    // Deactivate the combination
    const { error: deleteError } = await this.supabase
      .from("table_combinations")
      .update({ is_active: false })
      .eq("id", combinationId)

    if (deleteError) throw deleteError

    // Update both tables' combinable_with arrays
    await this.updateTableCombinableWith(
      combination.primary_table_id, 
      combination.secondary_table_id, 
      'remove'
    )
    await this.updateTableCombinableWith(
      combination.secondary_table_id, 
      combination.primary_table_id, 
      'remove'
    )
  }

  /**
   * Update a table's combinable_with array
   */
  private async updateTableCombinableWith(
    tableId: string, 
    otherTableId: string, 
    action: 'add' | 'remove'
  ): Promise<void> {
    const { data: tableData, error: fetchError } = await this.supabase
      .from("restaurant_tables")
      .select("combinable_with")
      .eq("id", tableId)
      .single()

    if (fetchError) {
      console.error("Error fetching table data:", fetchError)
      return
    }

    const currentCombinableWith = tableData?.combinable_with || []
    let updatedCombinableWith: string[]

    if (action === 'add') {
      updatedCombinableWith = currentCombinableWith.includes(otherTableId) 
        ? currentCombinableWith 
        : [...currentCombinableWith, otherTableId]
    } else {
      updatedCombinableWith = currentCombinableWith.filter(id => id !== otherTableId)
    }

    const { error: updateError } = await this.supabase
      .from("restaurant_tables")
      .update({ combinable_with: updatedCombinableWith })
      .eq("id", tableId)

    if (updateError) {
      console.error("Error updating table combinable_with:", updateError)
    }
  }

  /**
   * Get all combinations that should exist based on combinable_with arrays
   * This can be used to sync missing combinations
   */
  async syncAllCombinations(restaurantId: string): Promise<void> {
    // Get all tables with their combinable_with data
    const { data: tables, error: tablesError } = await this.supabase
      .from("restaurant_tables")
      .select("id, combinable_with, max_capacity")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)

    if (tablesError) throw tablesError
    if (!tables) return

    // Get existing combinations
    const { data: existingCombinations, error: combinationsError } = await this.supabase
      .from("table_combinations")
      .select("primary_table_id, secondary_table_id")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)

    if (combinationsError) throw combinationsError

    // Create a set of existing combinations for quick lookup
    const existingPairs = new Set(
      existingCombinations?.map(combo => 
        [combo.primary_table_id, combo.secondary_table_id].sort().join(':')
      ) || []
    )

    const combinationsToCreate: Array<{
      restaurant_id: string
      primary_table_id: string
      secondary_table_id: string
      combined_capacity: number
    }> = []

    // Check each table's combinable_with array
    for (const table of tables) {
      if (!table.combinable_with?.length) continue

      for (const otherTableId of table.combinable_with) {
        const sortedPair = [table.id, otherTableId].sort().join(':')
        
        // Skip if combination already exists
        if (existingPairs.has(sortedPair)) continue

        // Find the other table to get its capacity
        const otherTable = tables.find(t => t.id === otherTableId)
        if (!otherTable) continue

        combinationsToCreate.push({
          restaurant_id: restaurantId,
          primary_table_id: table.id,
          secondary_table_id: otherTableId,
          combined_capacity: table.max_capacity + otherTable.max_capacity
        })

        // Mark this pair as added to avoid duplicates
        existingPairs.add(sortedPair)
      }
    }

    // Insert missing combinations
    if (combinationsToCreate.length > 0) {
      const { error: insertError } = await this.supabase
        .from("table_combinations")
        .insert(combinationsToCreate)

      if (insertError) {
        console.error("Error creating missing combinations:", insertError)
        throw insertError
      }
    }
  }
}

export const tableCombinationsService = new TableCombinationsService()