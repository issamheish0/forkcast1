"use client"

import React, { useState } from 'react'

export function StateTest() {
  const [count, setCount] = useState(0)

  const testState = () => {
    console.log('🧪 Testing state update, current count:', count)
    setCount(prev => {
      const newCount = prev + 1
      console.log('🧪 State update: prev =', prev, 'new =', newCount)
      return newCount
    })
  }

  return (
    <div className="fixed top-32 right-4 z-50 bg-green-500 text-white p-2 rounded text-xs">
      <div>State Test</div>
      <div>Count: {count}</div>
      <button 
        onClick={testState}
        className="bg-white text-green-500 px-2 py-1 rounded text-xs mt-1"
      >
        Test State
      </button>
    </div>
  )
}
