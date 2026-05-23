// components/floorplan/section-combinations-manager.tsx
"use client"

import { useMemo, useState } from 'react'
import { useTableCombinations, useCreateTableCombination, useDeleteTableCombination } from '@/lib/hooks/use-table-combinations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash2, Users, Link2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SectionCombinationsManagerProps {
  restaurantId: string
  /** Tables that belong to the section being edited.
   *  Only tables already persisted (have a real DB id, no `isNew`) are eligible. */
  tables: Array<{ id: string; table_number: string; max_capacity: number; isNew?: boolean }>
}

export function SectionCombinationsManager({ restaurantId, tables }: SectionCombinationsManagerProps) {
  const { data: allCombinations = [], isLoading } = useTableCombinations(restaurantId)
  const createMutation = useCreateTableCombination()
  const deleteMutation = useDeleteTableCombination()

  // Eligible tables: persisted (have stable id) and active (parent component already filters out inactives in tables list).
  const eligibleTables = useMemo(
    () => tables.filter(t => !t.isNew && t.id),
    [tables]
  )
  const eligibleIds = useMemo(() => new Set(eligibleTables.map(t => t.id)), [eligibleTables])

  // Only combinations whose BOTH ends are tables in this section.
  const sectionCombinations = useMemo(
    () => allCombinations.filter((c: any) =>
      eligibleIds.has(c.primary_table_id) && eligibleIds.has(c.secondary_table_id)
    ),
    [allCombinations, eligibleIds]
  )

  const [primaryId, setPrimaryId] = useState<string>('')
  const [secondaryId, setSecondaryId] = useState<string>('')
  const [combinedCapacity, setCombinedCapacity] = useState<number | ''>('')

  // Auto-suggest the combined capacity as the sum of the two tables' max_capacity.
  const suggestedCapacity = useMemo(() => {
    const a = eligibleTables.find(t => t.id === primaryId)?.max_capacity ?? 0
    const b = eligibleTables.find(t => t.id === secondaryId)?.max_capacity ?? 0
    return a + b
  }, [primaryId, secondaryId, eligibleTables])

  const isDuplicate = useMemo(() => {
    if (!primaryId || !secondaryId) return false
    return sectionCombinations.some((c: any) =>
      (c.primary_table_id === primaryId && c.secondary_table_id === secondaryId) ||
      (c.primary_table_id === secondaryId && c.secondary_table_id === primaryId)
    )
  }, [primaryId, secondaryId, sectionCombinations])

  const handleCreate = () => {
    if (!primaryId || !secondaryId) return
    if (primaryId === secondaryId) return
    const cap = typeof combinedCapacity === 'number' && combinedCapacity > 0
      ? combinedCapacity
      : suggestedCapacity
    if (!cap || cap <= 0) return
    createMutation.mutate(
      {
        restaurantId,
        primaryTableId: primaryId,
        secondaryTableId: secondaryId,
        combinedCapacity: cap,
      },
      {
        onSuccess: () => {
          setPrimaryId('')
          setSecondaryId('')
          setCombinedCapacity('')
        },
      }
    )
  }

  const handleDelete = (id: string) => {
    deleteMutation.mutate({ id, restaurantId })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3 py-2">
      {/* Add new combination */}
      <div className="rounded-lg border p-2 space-y-2 bg-muted/20">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Combine two tables
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Table A</Label>
            <Select value={primaryId} onValueChange={setPrimaryId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick" />
              </SelectTrigger>
              <SelectContent>
                {eligibleTables
                  .filter(t => t.id !== secondaryId)
                  .map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      T{t.table_number} ({t.max_capacity})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Table B</Label>
            <Select value={secondaryId} onValueChange={setSecondaryId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick" />
              </SelectTrigger>
              <SelectContent>
                {eligibleTables
                  .filter(t => t.id !== primaryId)
                  .map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      T{t.table_number} ({t.max_capacity})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Combined max capacity
            {primaryId && secondaryId && (
              <span className="ml-1 normal-case font-normal">
                · suggested {suggestedCapacity}
              </span>
            )}
          </Label>
          <Input
            type="number"
            min={1}
            max={50}
            placeholder={suggestedCapacity > 0 ? String(suggestedCapacity) : 'e.g. 8'}
            value={combinedCapacity}
            onChange={(e) =>
              setCombinedCapacity(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 0))
            }
            className="h-8 text-xs"
          />
        </div>
        {isDuplicate && (
          <p className="text-[10px] text-destructive">
            These two tables are already combined.
          </p>
        )}
        <Button
          type="button"
          size="sm"
          className="w-full h-8 text-xs"
          disabled={
            !primaryId ||
            !secondaryId ||
            primaryId === secondaryId ||
            isDuplicate ||
            createMutation.isPending
          }
          onClick={handleCreate}
        >
          {createMutation.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Plus className="w-3 h-3 mr-1" />
          )}
          Add combination
        </Button>
      </div>

      {/* Existing combinations */}
      <div>
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">
          Active combinations ({sectionCombinations.length})
        </div>
        <ScrollArea className="max-h-[40vh]">
          {sectionCombinations.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No combinations yet. Tables can only be combined when explicitly defined here.
            </p>
          ) : (
            <ul className="space-y-1">
              {sectionCombinations.map((c: any) => {
                const a = eligibleTables.find(t => t.id === c.primary_table_id)
                const b = eligibleTables.find(t => t.id === c.secondary_table_id)
                if (!a || !b) return null
                return (
                  <li
                    key={c.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5 text-xs'
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Link2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">
                        T{a.table_number} + T{b.table_number}
                      </span>
                      <span className="flex items-center gap-0.5 text-muted-foreground tabular-nums">
                        <Users className="w-3 h-3" />
                        {c.combined_capacity}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => handleDelete(c.id)}
                      title="Delete combination"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
        {tables.some(t => t.isNew) && (
          <p className="mt-2 text-[10px] text-muted-foreground italic px-1">
            Save the section first to combine newly added tables.
          </p>
        )}
      </div>
    </div>
  )
}
