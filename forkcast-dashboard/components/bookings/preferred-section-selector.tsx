// components/bookings/preferred-section-selector.tsx
"use client"

import { useState } from "react"
import { useActiveSections } from "@/hooks/use-restaurant-sections"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Grid, Home, Users, Wine, Coffee, Sun, Shield, Star } from "lucide-react"

const ICON_MAP = {
  grid: Grid,
  home: Home,
  users: Users,
  wine: Wine,
  coffee: Coffee,
  sun: Sun,
  shield: Shield,
  star: Star,
}

interface PreferredSectionSelectorProps {
  restaurantId: string
  onSectionSelect: (sectionName: string | undefined) => void
  disabled?: boolean
  value?: string
  className?: string
}

export function PreferredSectionSelector({
  restaurantId,
  onSectionSelect,
  disabled = false,
  value,
  className
}: PreferredSectionSelectorProps) {
  const { data: sections, isLoading } = useActiveSections(restaurantId)
  const [selectedSection, setSelectedSection] = useState<string | undefined>(value)

  const handleSectionChange = (sectionName: string) => {
    const newValue = sectionName === "none" ? undefined : sectionName
    setSelectedSection(newValue)
    onSectionSelect(newValue)
  }

  if (isLoading) {
    return (
      <div className={className}>
        <Label>Preferred Section</Label>
        <div className="mt-2 text-sm text-muted-foreground">Loading sections...</div>
      </div>
    )
  }

  if (!sections || sections.length === 0) {
    return null // Don't show the selector if there are no sections
  }

  return (
    <div className={className}>
      <Label htmlFor="preferred_section">Preferred Section (Optional)</Label>
      <Select
        value={selectedSection || "none"}
        onValueChange={handleSectionChange}
        disabled={disabled}
      >
        <SelectTrigger className="mt-2">
          <SelectValue placeholder="Select a preferred section..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <div className="flex items-center gap-2">
              <span>No preference</span>
            </div>
          </SelectItem>
          {sections.map((section) => {
            const IconComponent = ICON_MAP[section.icon as keyof typeof ICON_MAP] || Grid
            
            return (
              <SelectItem key={section.id} value={section.name}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: section.color }}
                  />
                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                  <span>{section.name}</span>
                  {section.description && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({section.description})
                    </span>
                  )}
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      
      {selectedSection && (
        <div className="mt-2">
          <Badge variant="outline" className="px-2 py-1 text-xs">
            Selected: {selectedSection}
          </Badge>
        </div>
      )}
    </div>
  )
}
