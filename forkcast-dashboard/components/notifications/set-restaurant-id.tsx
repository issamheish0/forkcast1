"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SetRestaurantId() {
  const [restaurantId, setRestaurantId] = useState('')
  const [currentId, setCurrentId] = useState('')

  React.useEffect(() => {
    const stored = localStorage.getItem('selected-restaurant-id')
    setCurrentId(stored || 'None')
  }, [])

  const setRestaurant = () => {
    if (restaurantId.trim()) {
      localStorage.setItem('selected-restaurant-id', restaurantId.trim())
      setCurrentId(restaurantId.trim())
      console.log('✅ Set restaurant ID to:', restaurantId.trim())
      alert(`Restaurant ID set to: ${restaurantId.trim()}`)
    }
  }

  const clearRestaurant = () => {
    localStorage.removeItem('selected-restaurant-id')
    setCurrentId('None')
    console.log('🗑️ Cleared restaurant ID')
    alert('Restaurant ID cleared')
  }

  return (
    <div className="fixed top-44 right-4 z-50 bg-purple-500 text-white p-3 rounded text-xs max-w-xs">
      <div className="font-bold mb-2">Set Restaurant ID</div>
      <div className="mb-2">Current: {currentId}</div>
      <Input
        value={restaurantId}
        onChange={(e) => setRestaurantId(e.target.value)}
        placeholder="Enter restaurant ID"
        className="text-black text-xs mb-2"
      />
      <div className="flex gap-1">
        <Button
          onClick={setRestaurant}
          size="sm"
          className="bg-white text-purple-500 text-xs px-2 py-1 h-6"
        >
          Set
        </Button>
        <Button
          onClick={clearRestaurant}
          size="sm"
          className="bg-red-500 text-white text-xs px-2 py-1 h-6"
        >
          Clear
        </Button>
      </div>
    </div>
  )
}
