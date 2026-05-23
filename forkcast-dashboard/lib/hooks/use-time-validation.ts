import { useState, useEffect } from 'react'
import { getTimeRangeError } from '@/lib/utils/time-utils'

interface UseTimeValidationProps {
  startTime?: string
  endTime?: string
  allowOvernight?: boolean
  enabled?: boolean
}

export function useTimeValidation({
  startTime,
  endTime,
  allowOvernight = false,
  enabled = true
}: UseTimeValidationProps) {
  const [error, setError] = useState<string | null>(null)
  const [isValid, setIsValid] = useState(true)

  useEffect(() => {
    // Only validate when we have both values and validation is enabled
    if (!enabled) {
      setError(null)
      setIsValid(true)
      return
    }

    // Don't show validation errors until both times are provided
    if (!startTime || !endTime) {
      setError(null)
      setIsValid(true)
      return
    }

    const validationError = getTimeRangeError(startTime, endTime, allowOvernight)
    setError(validationError)
    setIsValid(validationError === null)
  }, [startTime, endTime, allowOvernight, enabled])

  return {
    error,
    isValid,
    hasError: error !== null
  }
}