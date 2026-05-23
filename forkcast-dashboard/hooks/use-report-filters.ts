import { useState, useEffect } from 'react'

export type DateRange = {
  from: string
  to: string
}

export type ReportFilters = {
  restaurantId: string
  dateRange: DateRange
}

export function useReportFilters() {
  const [filters, setFilters] = useState<ReportFilters>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('report-filters')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Failed to parse saved filters', e)
        }
      }
    }
    
    // Default values
    return {
      restaurantId: 'all',
      dateRange: {
        from: '',
        to: ''
      }
    }
  })

  // Save to localStorage when filters change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('report-filters', JSON.stringify(filters))
    }
  }, [filters])

  const updateFilters = (updates: Partial<ReportFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }))
  }

  const resetFilters = () => {
    setFilters({
      restaurantId: 'all',
      dateRange: { from: '', to: '' }
    })
  }

  const getDateFilter = () => {
    const { from, to } = filters.dateRange
    return {
      from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined
    }
  }

  return {
    filters,
    updateFilters,
    resetFilters,
    getDateFilter
  }
}

