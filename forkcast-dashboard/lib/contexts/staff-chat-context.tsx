'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { conversationMemory, ConversationMessage } from '@/lib/services/conversation-memory'

interface StaffChatContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  restaurantId: string
  sessionId: string | null
  setSessionId: (sessionId: string | null) => void
  addMessage: (role: 'user' | 'assistant' | 'system', content: string) => void
  getConversationHistory: () => ConversationMessage[]
  clearConversation: () => void
  resetConversation: () => void
  isSessionExpired: () => boolean
  getSessionInfo: () => { sessionId: string; restaurantId: string; messageCount: number } | null
}

const StaffChatContext = createContext<StaffChatContextValue | undefined>(undefined)

interface StaffChatProviderProps {
  children: React.ReactNode
  restaurantId: string
}

export function StaffChatProvider({ children, restaurantId }: StaffChatProviderProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Initialize conversation memory when component mounts or restaurant changes
  useEffect(() => {
    const initSessionId = conversationMemory.initSession(restaurantId, sessionId || undefined)
    if (initSessionId !== sessionId) {
      setSessionId(initSessionId)
    }
  }, [restaurantId, sessionId])

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  // Conversation memory methods
  const addMessage = useCallback((role: 'user' | 'assistant' | 'system', content: string) => {
    conversationMemory.addMessage(role, content)
  }, [])

  const getConversationHistory = useCallback(() => {
    return conversationMemory.getConversationHistory()
  }, [])

  const clearConversation = useCallback(() => {
    conversationMemory.clearSession()
    setSessionId(null)
    // Reinitialize with new session
    const newSessionId = conversationMemory.initSession(restaurantId)
    setSessionId(newSessionId)
  }, [restaurantId])

  const resetConversation = useCallback(() => {
    conversationMemory.resetConversation()
  }, [])

  const isSessionExpired = useCallback(() => {
    return conversationMemory.isSessionExpired()
  }, [])

  const getSessionInfo = useCallback(() => {
    return conversationMemory.getSessionInfo()
  }, [])

  const value: StaffChatContextValue = useMemo(() => ({
    isOpen,
    open,
    close,
    toggle,
    restaurantId,
    sessionId,
    setSessionId,
    addMessage,
    getConversationHistory,
    clearConversation,
    resetConversation,
    isSessionExpired,
    getSessionInfo,
  }), [isOpen, open, close, toggle, restaurantId, sessionId, addMessage, getConversationHistory, clearConversation, resetConversation, isSessionExpired, getSessionInfo])

  return (
    <StaffChatContext.Provider value={value}>
      {children}
    </StaffChatContext.Provider>
  )
}

export function useStaffChat() {
  const ctx = useContext(StaffChatContext)
  if (!ctx) {
    throw new Error('useStaffChat must be used within a StaffChatProvider')
  }
  return ctx
}


